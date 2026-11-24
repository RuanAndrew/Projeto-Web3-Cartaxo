import logging
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
audit_logger = logging.getLogger("agendamento.auditoria")

StatusAgendamento = Literal[
    "agendado",
    "aguardando",
    "concluido",
    "cancelado",
    "nao_compareceu",
]
ModalidadeAgendamento = Literal["presencial", "teleconsulta"]

app = FastAPI(
    title="Microsserviço de Agendamentos",
    description="API para gerenciar os agendamentos presenciais e teleconsultas da clínica.",
    version="0.4.0",
)


def _registrar_auditoria(
    acao: str,
    agendamento_id: uuid.UUID,
    usuario: UsuarioAutenticado,
    detalhes: str = "",
) -> None:
    """Registra eventos operacionais e de auditoria (RF24 / RNF12 / RNF16)."""
    audit_logger.info(
        "acao=%s agendamento_id=%s usuario_id=%s perfil=%s detalhes=%s",
        acao,
        agendamento_id,
        usuario.id,
        usuario.perfil,
        detalhes,
    )


FUSO_CLINICA = timezone(timedelta(hours=-3))


def _data_local_clinica(valor: datetime) -> datetime.date:
    if valor.tzinfo is None:
        valor = valor.replace(tzinfo=timezone.utc)
    return valor.astimezone(FUSO_CLINICA).date()


def _hoje_local_clinica() -> datetime.date:
    return datetime.now(timezone.utc).astimezone(FUSO_CLINICA).date()


def _agendamento_vencido_nao_iniciado(agendamento: AgendamentoDB) -> bool:
    return (
        agendamento.status in ("agendado", "aguardando")
        and _data_local_clinica(agendamento.data_hora) < _hoje_local_clinica()
    )


def _validar_data_futura(valor: datetime) -> datetime:
    if valor.tzinfo is None:
        valor = valor.replace(tzinfo=timezone.utc)
    agora = datetime.now(timezone.utc)
    # Permite horários comerciais do dia atual (segundos/microssegundos zerados) e bloqueia datas/timestamps no passado
    hoje_inicio = (agora - timedelta(hours=4)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    if valor.second == 0 and valor.microsecond == 0 and valor >= hoje_inicio:
        return valor
    if valor <= agora:
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

    if inicio_novo.tzinfo is None:
        inicio_novo = inicio_novo.replace(tzinfo=timezone.utc)

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
        if ignorar_agendamento_id is not None and existente.id == ignorar_agendamento_id:
            continue
        if existente.status not in ("agendado", "aguardando"):
            continue

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

    _registrar_auditoria(
        "CRIAR_AGENDAMENTO",
        novo_agendamento.id,
        usuario,
        f"modalidade={novo_agendamento.modalidade} data_hora={novo_agendamento.data_hora.isoformat()}",
    )

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
    lista = list(resultado.scalars().all())

    alterou_vencidos = False
    for ag in lista:
        if _agendamento_vencido_nao_iniciado(ag):
            ag.status = "cancelado"
            alterou_vencidos = True
            _registrar_auditoria(
                "CANCELAR_AUTOMATICO_PRAZO_EXPIRADO",
                ag.id,
                usuario,
                f"data_hora={ag.data_hora.isoformat()}",
            )

    if alterou_vencidos:
        await db.commit()

    return lista


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

    if _agendamento_vencido_nao_iniciado(agendamento):
        agendamento.status = "cancelado"
        await db.commit()
        await db.refresh(agendamento)
        _registrar_auditoria(
            "CANCELAR_AUTOMATICO_PRAZO_EXPIRADO",
            agendamento.id,
            usuario,
            f"data_hora={agendamento.data_hora.isoformat()}",
        )

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

    if agendamento.status in ("cancelado", "concluido", "nao_compareceu"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não é possível alterar link de agendamento '{agendamento.status}'.",
        )

    agendamento.link_teleconsulta = dados.link_teleconsulta
    await db.commit()
    await db.refresh(agendamento)

    _registrar_auditoria(
        "ATUALIZAR_LINK_TELECONSULTA",
        agendamento.id,
        usuario,
        "link_registrado=True",
    )
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

    if agendamento.status in ("cancelado", "concluido", "nao_compareceu"):
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

    _registrar_auditoria(
        "REMARCAR_AGENDAMENTO",
        agendamento.id,
        usuario,
        f"nova_data_hora={agendamento.data_hora.isoformat()}",
    )
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

    _registrar_auditoria("MARCAR_AGUARDANDO", agendamento.id, usuario)
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

    _registrar_auditoria("CONCLUIR_AGENDAMENTO", agendamento.id, usuario)
    return agendamento


@app.patch("/agendamentos/{agendamento_id}/nao-compareceu", response_model=Agendamento)
async def marcar_nao_compareceu(
    agendamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    if usuario.perfil == "PACIENTE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas equipe da clínica pode registrar ausência.",
        )

    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _verificar_acesso_agendamento(agendamento, usuario)
    agendamento.status = "nao_compareceu"
    await db.commit()
    await db.refresh(agendamento)

    _registrar_auditoria("MARCAR_NAO_COMPARECEU", agendamento.id, usuario)
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

    _registrar_auditoria("CANCELAR_AGENDAMENTO", agendamento.id, usuario)
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

    _verificar_acesso_agendamento(agendamento, usuario)

    if _data_local_clinica(agendamento.data_hora) < _hoje_local_clinica():
        if agendamento.status in ("agendado", "aguardando"):
            agendamento.status = "cancelado"
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta consulta é de uma data passada e não foi realizada no dia agendado. Não é possível retomá-la.",
        )

    await _verificar_conflito_com_lock(
        db=db,
        profissional_id=agendamento.profissional_id,
        inicio_novo=agendamento.data_hora,
        duracao_minutos=agendamento.duracao_minutos,
        ignorar_agendamento_id=agendamento.id,
    )

    status_anterior = agendamento.status
    agendamento.status = "agendado"
    await db.commit()
    await db.refresh(agendamento)

    _registrar_auditoria(
        "REATIVAR_AGENDAMENTO",
        agendamento.id,
        usuario,
        f"status_anterior={status_anterior}",
    )
    return agendamento


@app.delete(
    "/agendamentos/{agendamento_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def excluir_agendamento(
    agendamento_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    usuario: UsuarioAutenticado = Depends(get_current_user),
):
    if usuario.perfil == "PACIENTE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pacientes não podem excluir agendamentos.",
        )

    agendamento = await db.get(AgendamentoDB, agendamento_id)
    if agendamento is None:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

    _verificar_acesso_agendamento(agendamento, usuario)

    if _data_local_clinica(agendamento.data_hora) < _hoje_local_clinica():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não é permitido excluir registros de consultas de datas passadas.",
        )

    status_anterior = agendamento.status

    await db.delete(agendamento)
    await db.commit()

    _registrar_auditoria(
        "EXCLUIR_AGENDAMENTO",
        agendamento_id,
        usuario,
        f"status_anterior={status_anterior}",
    )
    return None