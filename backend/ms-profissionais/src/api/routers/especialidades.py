from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.api.common import commit_ou_conflito, get_or_404
from src.api.schemas import EspecialidadeCreate, EspecialidadeRead, EspecialidadeUpdate
from src.domain.models import Especialidade
from src.infrastructure.database import get_db

router = APIRouter(prefix="/especialidades", tags=["Especialidades (UC06)"])

MSG_DUPLICADA = "Já existe uma especialidade com esse nome."


@router.post("", response_model=EspecialidadeRead, status_code=status.HTTP_201_CREATED)
def criar_especialidade(dados: EspecialidadeCreate, db: Session = Depends(get_db)):
    especialidade = Especialidade(nome=dados.nome)
    db.add(especialidade)
    commit_ou_conflito(db, MSG_DUPLICADA)
    return especialidade


@router.get("", response_model=list[EspecialidadeRead])
def listar_especialidades(db: Session = Depends(get_db)):
    return db.scalars(select(Especialidade).order_by(Especialidade.nome)).all()


@router.get("/{especialidade_id}", response_model=EspecialidadeRead)
def obter_especialidade(especialidade_id: int, db: Session = Depends(get_db)):
    return get_or_404(db, Especialidade, especialidade_id, "Especialidade")


@router.put("/{especialidade_id}", response_model=EspecialidadeRead)
def atualizar_especialidade(
    especialidade_id: int, dados: EspecialidadeUpdate, db: Session = Depends(get_db)
):
    especialidade = get_or_404(db, Especialidade, especialidade_id, "Especialidade")
    especialidade.nome = dados.nome
    commit_ou_conflito(db, MSG_DUPLICADA)
    return especialidade


@router.delete("/{especialidade_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_especialidade(especialidade_id: int, db: Session = Depends(get_db)):
    # Os vínculos com profissionais são removidos em cascata pela FK.
    especialidade = get_or_404(db, Especialidade, especialidade_id, "Especialidade")
    db.delete(especialidade)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

