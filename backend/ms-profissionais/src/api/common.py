from typing import TypeVar

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.domain.models import Especialidade
from src.infrastructure.database import Base

M = TypeVar("M", bound=Base)


def get_or_404(db: Session, model: type[M], obj_id: int, nome: str) -> M:
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{nome} {obj_id} não encontrado(a).")
    return obj


def buscar_especialidades(db: Session, ids: list[int]) -> list[Especialidade]:
    """Retorna as especialidades pedidas ou 404 listando as inexistentes."""
    ids_unicos = set(ids)
    if not ids_unicos:
        return []
    encontradas = db.scalars(select(Especialidade).where(Especialidade.id.in_(ids_unicos))).all()
    faltando = ids_unicos - {e.id for e in encontradas}
    if faltando:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            f"Especialidade(s) não encontrada(s): {sorted(faltando)}",
        )
    return list(encontradas)


def commit_ou_conflito(db: Session, mensagem: str) -> None:
    """Faz commit convertendo violações de unicidade/integridade em HTTP 409."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, mensagem)

