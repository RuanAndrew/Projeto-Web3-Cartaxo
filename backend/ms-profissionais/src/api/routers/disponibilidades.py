from collections.abc import Iterable

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.api.common import get_or_404
from src.api.schemas import (
    DisponibilidadeBase,
    DisponibilidadeCreate,
    DisponibilidadeRead,
    DisponibilidadeUpdate,
    HorarioDisponivel,
)
from src.domain.models import DiaSemana, Disponibilidade, Especialidade, Profissional
from src.infrastructure.database import get_db

router = APIRouter(tags=["Disponibilidades (UC07/UC08)"])

ORDEM_DIAS = {dia: i for i, dia in enumerate(DiaSemana)}


def _chave_ordenacao(d: Disponibilidade) -> tuple:
    return (ORDEM_DIAS[d.dia_semana], d.horario_inicio)


def _sobrepoe(a: DisponibilidadeBase | Disponibilidade, b: DisponibilidadeBase | Disponibilidade) -> bool:
    return (
        a.dia_semana == b.dia_semana
        and a.horario_inicio < b.horario_fim
        and b.horario_inicio < a.horario_fim
    )


def _validar_sem_conflito(novo: DisponibilidadeBase, existentes: Iterable[Disponibilidade]) -> None:
    for d in existentes:
        if _sobrepoe(novo, d):
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Conflito com a disponibilidade {d.id} ({d.dia_semana.value} "
                f"{d.horario_inicio:%H:%M}-{d.horario_fim:%H:%M}).",
            )


# --------------------------------------------------------------------------- #
# Cadastro e atualização de disponibilidades (UC07)
# --------------------------------------------------------------------------- #
@router.get(
    "/profissionais/{profissional_id}/disponibilidades",
    response_model=list[DisponibilidadeRead],
)
def listar_disponibilidades(profissional_id: int, db: Session = Depends(get_db)):
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    return sorted(profissional.disponibilidades, key=_chave_ordenacao)


@router.post(
    "/profissionais/{profissional_id}/disponibilidades",
    response_model=DisponibilidadeRead,
    status_code=status.HTTP_201_CREATED,
)
def adicionar_disponibilidade(
    profissional_id: int, dados: DisponibilidadeCreate, db: Session = Depends(get_db)
):
    """Adiciona um intervalo à agenda; recusa sobreposição no mesmo dia (409)."""
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    _validar_sem_conflito(dados, profissional.disponibilidades)
    disponibilidade = Disponibilidade(**dados.model_dump())
    profissional.disponibilidades.append(disponibilidade)
    db.commit()
    return disponibilidade


@router.put(
    "/profissionais/{profissional_id}/disponibilidades",
    response_model=list[DisponibilidadeRead],
)
def substituir_disponibilidades(
    profissional_id: int, dados: list[DisponibilidadeCreate], db: Session = Depends(get_db)
):
    """Substitui toda a agenda semanal do profissional (lista vazia limpa a agenda)."""
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    for i, a in enumerate(dados):
        for b in dados[i + 1 :]:
            if _sobrepoe(a, b):
                raise HTTPException(
                    status.HTTP_409_CONFLICT,
                    f"Intervalos sobrepostos em {a.dia_semana.value}: "
                    f"{a.horario_inicio:%H:%M}-{a.horario_fim:%H:%M} e "
                    f"{b.horario_inicio:%H:%M}-{b.horario_fim:%H:%M}.",
                )
    profissional.disponibilidades = [Disponibilidade(**d.model_dump()) for d in dados]
    db.commit()
    return sorted(profissional.disponibilidades, key=_chave_ordenacao)


# --------------------------------------------------------------------------- #
# Busca de horários disponíveis (UC08)
# Declarada antes de /disponibilidades/{id} por clareza de roteamento.
# --------------------------------------------------------------------------- #
@router.get("/disponibilidades/busca", response_model=list[HorarioDisponivel])
def buscar_horarios(
    profissional_id: int | None = None,
    especialidade_id: int | None = None,
    dia_semana: DiaSemana | None = None,
    db: Session = Depends(get_db),
):
    """
    Lista os horários de atendimento de profissionais **ativos**, filtrando por
    profissional, especialidade e/ou dia da semana.
    """
    stmt = (
        select(Disponibilidade)
        .join(Disponibilidade.profissional)
        .where(Profissional.ativo.is_(True))
        .options(
            selectinload(Disponibilidade.profissional).selectinload(Profissional.especialidades)
        )
    )
    if profissional_id is not None:
        stmt = stmt.where(Disponibilidade.profissional_id == profissional_id)
    if especialidade_id is not None:
        stmt = stmt.where(Profissional.especialidades.any(Especialidade.id == especialidade_id))
    if dia_semana is not None:
        stmt = stmt.where(Disponibilidade.dia_semana == dia_semana)

    resultados = sorted(
        db.scalars(stmt).all(),
        key=lambda d: (d.profissional.nome, *_chave_ordenacao(d)),
    )
    return [
        HorarioDisponivel(
            disponibilidade_id=d.id,
            profissional_id=d.profissional_id,
            profissional_nome=d.profissional.nome,
            especialidades=d.profissional.especialidades,
            dia_semana=d.dia_semana,
            horario_inicio=d.horario_inicio,
            horario_fim=d.horario_fim,
        )
        for d in resultados
    ]


@router.put("/disponibilidades/{disponibilidade_id}", response_model=DisponibilidadeRead)
def atualizar_disponibilidade(
    disponibilidade_id: int, dados: DisponibilidadeUpdate, db: Session = Depends(get_db)
):
    disponibilidade = get_or_404(db, Disponibilidade, disponibilidade_id, "Disponibilidade")
    outras = (d for d in disponibilidade.profissional.disponibilidades if d.id != disponibilidade.id)
    _validar_sem_conflito(dados, outras)
    for campo, valor in dados.model_dump().items():
        setattr(disponibilidade, campo, valor)
    db.commit()
    return disponibilidade


@router.delete("/disponibilidades/{disponibilidade_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_disponibilidade(disponibilidade_id: int, db: Session = Depends(get_db)):
    disponibilidade = get_or_404(db, Disponibilidade, disponibilidade_id, "Disponibilidade")
    db.delete(disponibilidade)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

