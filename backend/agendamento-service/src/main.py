
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from infrastructure.database.connection import Base, engine, get_db
from models import AgendamentoDB


app = FastAPI(
    title="Microsserviço de Agendamentos",
    description="API para gerenciar os agendamentos da clínica.",
    version="0.1.0",
)


@app.on_event("startup")
async def criar_tabelas():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# Dados recebidos ao criar um agendamento
class AgendamentoCreate(BaseModel):
    paciente_id: int = Field(gt=0)
    profissional_id: int = Field(gt=0)
    data_hora: datetime
    duracao_minutos: int = Field(default=30, gt=0, le=480)

    @field_validator("data_hora")
    @classmethod
    def normalizar_data_hora(cls, valor: datetime) -> datetime:
        if valor.tzinfo is None:
            valor = valor.replace(tzinfo=timezone.utc)
        return valor


# Formato de resposta da API
class Agendamento(AgendamentoCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: Literal["agendado", "cancelado"] = "agendado"


@app.get("/")
def inicio():
    return {"mensagem": "Microsserviço de agendamentos funcionando!"}


@app.get("/health")
def verificar_saude():
    return {"status": "ok"}


# Cadastrar agendamento
@app.post(
    "/agendamentos",
    response_model=Agendamento,
    status_code=status.HTTP_201_CREATED,
)
async def criar_agendamento(
    dados: AgendamentoCreate,
    db: AsyncSession = Depends(get_db),
):
    inicio_novo = dados.data_hora
    fim_novo = inicio_novo + timedelta(
        minutes=dados.duracao_minutos
    )

    consulta = select(AgendamentoDB).where(
        AgendamentoDB.profissional_id == dados.profissional_id,
        AgendamentoDB.status == "agendado",
    )

    resultado = await db.execute(consulta)
    existentes = resultado.scalars().all()

    for existente in existentes:
        inicio_existente = existente.data_hora

        # Garante comparação correta entre datas com fuso horário
        if inicio_existente.tzinfo is None:
            inicio_existente = inicio_existente.replace(
                tzinfo=timezone.utc
            )

        fim_existente = inicio_existente + timedelta(
            minutes=existente.duracao_minutos
        )

        if inicio_novo < fim_existente and inicio_existente < fim_novo:
            raise HTTPException(
                status_code=409,
                detail="Conflito de horário para este profissional.",
            )

    novo_agendamento = AgendamentoDB(
        **dados.model_dump(),
        status="agendado",
    )

    db.add(novo_agendamento)
    await db.commit()
    await db.refresh(novo_agendamento)

    return novo_agendamento


# Listar todos os agendamentos
@app.get("/agendamentos", response_model=list[Agendamento])
async def listar_agendamentos(
    db: AsyncSession = Depends(get_db),
):
    consulta = select(AgendamentoDB).order_by(AgendamentoDB.id)
    resultado = await db.execute(consulta)

    return resultado.scalars().all()


# Consultar um agendamento pelo ID
@app.get("/agendamentos/{agendamento_id}", response_model=Agendamento)
async def buscar_agendamento(
    agendamento_id: int,
    db: AsyncSession = Depends(get_db),
):
    agendamento = await db.get(AgendamentoDB, agendamento_id)

    if agendamento is None:
        raise HTTPException(
            status_code=404,
            detail="Agendamento não encontrado.",
        )

    return agendamento


# Cancelar agendamento
@app.patch(
    "/agendamentos/{agendamento_id}/cancelar",
    response_model=Agendamento,
)
async def cancelar_agendamento(
    agendamento_id: int,
    db: AsyncSession = Depends(get_db),
):
    agendamento = await db.get(AgendamentoDB, agendamento_id)

    if agendamento is None:
        raise HTTPException(
            status_code=404,
            detail="Agendamento não encontrado.",
        )

    agendamento.status = "cancelado"

    await db.commit()
    await db.refresh(agendamento)

    return agendamento
