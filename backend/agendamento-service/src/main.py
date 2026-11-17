import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import UsuarioAutenticado, get_current_user
from src.infrastructure.database.connection import get_db
from src.models import AgendamentoDB

StatusAgendamento = Literal["agendado", "aguardando", "concluido", "cancelado"]
ModalidadeAgendamento = Literal["presencial", "teleconsulta"]

app = FastAPI(
    title="Microsserviço de Agendamentos",
    description="API para gerenciar os agendamentos presenciais e teleconsultas da clínica.",
    version="0.3.0",
)


def _validar_data_futura(valor: datetime) -> datetime:
    if valor.tzinfo is None:
        valor = valor.replace(tzinfo=timezone.utc)
    if valor <= datetime.now(timezone.utc):
        raise ValueError("A data e hora do agendamento devem estar no futuro.")
    return valor


def _validar_url_teleconsulta(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpo = valor.strip()
    if not limpo:
        return None
    if not (limpo.startswith("https://") or limpo.startswith("http://")):
        raise ValueError("O link da teleconsulta deve começar com http:// ou https://.")
    return limpo


class AgendamentoCreate(BaseModel):
    paciente_id: uuid.UUID
    profissional_id: uuid.UUID
    data_hora: datetime
    duracao_minutos: int = Field(default=30, gt=0, le=480)
    modalidade: ModalidadeAgendamento = "presencial"
    link_teleconsulta: str | None = Field(default=None, max_length=500)

    @field_validator("data_hora")
    @classmethod
    def validar_data_hora(cls, valor: datetime) -> datetime:
        return _validar_data_futura(valor)

    @field_validator("link_teleconsulta")
    @classmethod
    def validar_link(cls, valor: str | None) -> str | None:
        return _validar_url_teleconsulta(valor)

    @model_validator(mode="after")
    def validar_consistencia_modalidade(self):
        if self.modalidade == "presencial" and self.link_teleconsulta:
            raise ValueError("Consultas presenciais não devem possuir link de teleconsulta.")
        return self


class AgendamentoRemarcar(BaseModel):
    data_hora: datetime
    duracao_minutos: int | None = Field(default=None, gt=0, le=480)

    @field_validator("data_hora")
    @classmethod
    def validar_data_hora(cls, valor: datetime) -> datetime:
        return _validar_data_futura(valor)


class TeleconsultaLinkUpdate(BaseModel):
    link_teleconsulta: str = Field(..., min_length=8, max_length=500)

    @field_validator("link_teleconsulta")
    @classmethod
    def validar_link(cls, valor: str) -> str:
        validado = _validar_url_teleconsulta(valor)
        if not validado:
            raise ValueError("Informe uma URL válida para a teleconsulta.")
        return validado


class Agendamento(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    paciente_id: uuid.UUID
    profissional_id: uuid.UUID
    data_hora: datetime
    duracao_minutos: int
    modalidade: ModalidadeAgendamento = "presencial"
    link_teleconsulta: str | None = None
    status: StatusAgendamento = "agendado"


async def _verificar_conflito_com_lock(
    db: AsyncSession,
    profissional_id: uuid.UUID,
    inicio_novo: datetime,
    duracao_minutos: int,
    ignorar_agendamento_id: uuid.UUID | None = None,
) -> None:
    """Adquire lock transacional por profissional e verifica sobreposição de horário."""
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:prof_id))"),
        {"prof_id": str(profissional_id)},
    )

    fim_novo = inicio_novo + timedelta(minutes=duracao_minutos)

    consulta = select(AgendamentoDB).where(
        AgendamentoDB.profissional_id == profissional_id,
        AgendamentoDB.status.in_(["agendado", "aguardando"]),
    )
    if ignorar_agendamento_id is not None:
        consulta = consulta.where(AgendamentoDB.id != ignorar_agendamento_id)

    resultado = await db.execute(consulta)
    existentes = resultado.scalars().all()

    for existente in existentes:
        inicio_existente = existente.data_hora
        if inicio_existente.tzinfo is None:
            inicio_existente = inicio_existente.replace(tzinfo=timezone.utc)

        fim_existente = inicio_existente + timedelta(minutes=existente.duracao_minutos)

        if inicio_novo < fim_existente and inicio_existente < fim_novo:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Conflito de horário para este profissional.",
            )


def _verificar_acesso_agendamento(
    agendamento: AgendamentoDB,
    usuario: UsuarioAutenticado,
) -> None:
    if usuario.perfil == "PACIENTE" and agendamento.paciente_id != usuario.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado a agendamento de outro paciente.",
        )
    if usuario.perfil == "PROFISSIONAL" and agendamento.profissional_id != usuario.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado à agenda de outro profissional.",
        )


@app.get("/")
def inicio():
    return {"mensagem": "Microsserviço de agendamentos funcionando!"}


@app.get("/health")
def verificar_saude():
    return {"status": "ok"}


@app.post(
    "/agendamentos",
    response_model=Agendamento,
    status_code=status.HTTP_201_CREATED,
)
async def criar_agendamento(
    dados: AgendamentoCreate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    if usuario.perfil == "PACIENTE" and dados.paciente_id != usuario.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Paciente só pode criar agendamentos para si mesmo.",
        )

    await _verificar_conflito_com_lock(
        db=db,
        profissional_id=dados.profissional_id,
        inicio_novo=dados.data_hora,
        duracao_minutos=dados.duracao_minutos,
    )

    novo_agendamento = AgendamentoDB(
        **dados.model_dump(),
        status="agendado",
    )

    db.add(novo_agendamento)
    await db.commit()
    await db.refresh(novo_agendamento)

    return novo_agendamento


@app.get("/agendamentos", response_model=list[Agendamento])
async def listar_agendamentos(
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    consulta = select(AgendamentoDB).order_by(AgendamentoDB.data_hora)

    if usuario.perfil == "PACIENTE":
        consulta = consulta.where(AgendamentoDB.paciente_id == usuario.id)
    elif usuario.perfil == "PROFISSIONAL":
        consulta = consulta.where(AgendamentoDB.profissional_id == usuario.id)

    resultado = await db.execute(consulta)
    return resultado.scalars().all()


@app.get("/agendamentos/{agendamento_id}", response_model=Agendamento)
async def buscar_agendamento(
    agendamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _verificar_acesso_agendamento(agendamento, usuario)
    return agendamento


@app.patch("/agendamentos/{agendamento_id}/teleconsulta", response_model=Agendamento)
async def registrar_link_teleconsulta(
    agendamento_id: uuid.UUID,
    dados: TeleconsultaLinkUpdate,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    if usuario.perfil == "PACIENTE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas profissionais ou equipe da clínica podem registrar o link da teleconsulta.",
        )

    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _verificar_acesso_agendamento(agendamento, usuario)

    if agendamento.modalidade != "teleconsulta":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este agendamento é presencial e não aceita link de teleconsulta.",
        )

    if agendamento.status in ("cancelado", "concluido"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não é possível alterar link de agendamento '{agendamento.status}'.",
        )

    agendamento.link_teleconsulta = dados.link_teleconsulta
    await db.commit()
    await db.refresh(agendamento)
    return agendamento


@app.patch("/agendamentos/{agendamento_id}/remarcar", response_model=Agendamento)
async def remarcar_agendamento(
    agendamento_id: uuid.UUID,
    dados: AgendamentoRemarcar,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _verificar_acesso_agendamento(agendamento, usuario)

    if agendamento.status in ("cancelado", "concluido"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não é possível remarcar um agendamento com status '{agendamento.status}'.",
        )

    nova_duracao = dados.duracao_minutos or agendamento.duracao_minutos

    await _verificar_conflito_com_lock(
        db=db,
        profissional_id=agendamento.profissional_id,
        inicio_novo=dados.data_hora,
        duracao_minutos=nova_duracao,
        ignorar_agendamento_id=agendamento.id,
    )

    agendamento.data_hora = dados.data_hora
    agendamento.duracao_minutos = nova_duracao
    agendamento.status = "agendado"

    await db.commit()
    await db.refresh(agendamento)
    return agendamento


@app.patch("/agendamentos/{agendamento_id}/aguardando", response_model=Agendamento)
async def marcar_aguardando(
    agendamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    if usuario.perfil == "PACIENTE":
        raise HTTPException(status_code=403, detail="Ação restrita à equipe da clínica.")

    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    agendamento.status = "aguardando"
    await db.commit()
    await db.refresh(agendamento)
    return agendamento


@app.patch("/agendamentos/{agendamento_id}/concluir", response_model=Agendamento)
async def concluir_agendamento(
    agendamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    if usuario.perfil not in ("ADMIN", "PROFISSIONAL"):
        raise HTTPException(
            status_code=403,
            detail="Apenas profissionais ou administradores podem concluir atendimentos.",
        )

    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _verificar_acesso_agendamento(agendamento, usuario)
    agendamento.status = "concluido"
    await db.commit()
    await db.refresh(agendamento)
    return agendamento


@app.patch("/agendamentos/{agendamento_id}/cancelar", response_model=Agendamento)
async def cancelar_agendamento(
    agendamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _verificar_acesso_agendamento(agendamento, usuario)
    agendamento.status = "cancelado"

    await db.commit()
    await db.refresh(agendamento)
    return agendamento


@app.patch("/agendamentos/{agendamento_id}/reativar", response_model=Agendamento)
async def reativar_agendamento(
    agendamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    if usuario.perfil == "PACIENTE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pacientes não podem reativar agendamentos diretamente.",
        )

    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    await _verificar_conflito_com_lock(
        db=db,
        profissional_id=agendamento.profissional_id,
        inicio_novo=agendamento.data_hora,
        duracao_minutos=agendamento.duracao_minutos,
        ignorar_agendamento_id=agendamento.id,
    )

    agendamento.status = "agendado"
    await db.commit()
    await db.refresh(agendamento)
    return agendamento