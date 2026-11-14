from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.api.common import buscar_especialidades, commit_ou_conflito, get_or_404
from src.api.schemas import (
    EspecialidadeIds,
    ProfissionalCreate,
    ProfissionalDetail,
    ProfissionalPatch,
    ProfissionalRead,
    ProfissionalUpdate,
)
from src.domain.models import Especialidade, Profissional
from src.infrastructure.database import get_db

router = APIRouter(prefix="/profissionais", tags=["Profissionais (UC05)"])

MSG_DOC_DUPLICADO = "Já existe um profissional com esse documento de registro."


# --------------------------------------------------------------------------- #
# CRUD (UC05)
# --------------------------------------------------------------------------- #
@router.post("", response_model=ProfissionalDetail, status_code=status.HTTP_201_CREATED)
def criar_profissional(dados: ProfissionalCreate, db: Session = Depends(get_db)):
    profissional = Profissional(
        nome=dados.nome,
        documento_registro=dados.documento_registro,
        ativo=dados.ativo,
        especialidades=buscar_especialidades(db, dados.especialidade_ids),
    )
    db.add(profissional)
    commit_ou_conflito(db, MSG_DOC_DUPLICADO)
    return profissional


@router.get("", response_model=list[ProfissionalRead])
def listar_profissionais(
    nome: str | None = Query(None, description="Busca parcial, sem diferenciar maiúsculas"),
    ativo: bool | None = None,
    especialidade_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    stmt = select(Profissional).options(selectinload(Profissional.especialidades))
    if nome:
        stmt = stmt.where(Profissional.nome.ilike(f"%{nome}%"))
    if ativo is not None:
        stmt = stmt.where(Profissional.ativo == ativo)
    if especialidade_id is not None:
        stmt = stmt.where(Profissional.especialidades.any(Especialidade.id == especialidade_id))
    stmt = stmt.order_by(Profissional.nome).offset(skip).limit(limit)
    return db.scalars(stmt).all()


@router.get("/{profissional_id}", response_model=ProfissionalDetail)
def obter_profissional(profissional_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Profissional, profissional_id, "Profissional")


@router.put("/{profissional_id}", response_model=ProfissionalDetail)
def atualizar_profissional(
    profissional_id: int, dados: ProfissionalUpdate, db: Session = Depends(get_db)
):
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    for campo, valor in dados.model_dump().items():
        setattr(profissional, campo, valor)
    commit_ou_conflito(db, MSG_DOC_DUPLICADO)
    return profissional


@router.patch("/{profissional_id}", response_model=ProfissionalDetail)
def atualizar_parcial_profissional(
    profissional_id: int, dados: ProfissionalPatch, db: Session = Depends(get_db)
):
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    for campo, valor in dados.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(profissional, campo, valor)
    commit_ou_conflito(db, MSG_DOC_DUPLICADO)
    return profissional


@router.delete("/{profissional_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_profissional(profissional_id: int, db: Session = Depends(get_db)):
    # Disponibilidades e vínculos com especialidades são removidos em cascata.
    # Para apenas inativar, use PATCH com {"ativo": false}.
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    db.delete(profissional)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --------------------------------------------------------------------------- #
# Associação com especialidades
# --------------------------------------------------------------------------- #
@router.post("/{profissional_id}/especialidades", response_model=ProfissionalRead)
def associar_especialidades(
    profissional_id: int, dados: EspecialidadeIds, db: Session = Depends(get_db)
):
    """Adiciona especialidades ao profissional (as já vinculadas são ignoradas)."""
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    atuais = {e.id for e in profissional.especialidades}
    for especialidade in buscar_especialidades(db, dados.especialidade_ids):
        if especialidade.id not in atuais:
            profissional.especialidades.append(especialidade)
    db.commit()
    return profissional


@router.put("/{profissional_id}/especialidades", response_model=ProfissionalRead)
def substituir_especialidades(
    profissional_id: int, dados: EspecialidadeIds, db: Session = Depends(get_db)
):
    """Substitui todo o conjunto de especialidades do profissional."""
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    profissional.especialidades = buscar_especialidades(db, dados.especialidade_ids)
    db.commit()
    return profissional


@router.delete("/{profissional_id}/especialidades", response_model=ProfissionalRead)
def desassociar_especialidades(
    profissional_id: int,
    especialidade_ids: list[int] = Query(..., min_length=1, description="Ex.: ?especialidade_ids=1&especialidade_ids=2"),
    db: Session = Depends(get_db),
):
    """Remove os vínculos indicados (ids não vinculados são ignorados)."""
    profissional = get_or_404(db, Profissional, profissional_id, "Profissional")
    remover = set(especialidade_ids)
    profissional.especialidades = [e for e in profissional.especialidades if e.id not in remover]
    db.commit()
    return profissional

