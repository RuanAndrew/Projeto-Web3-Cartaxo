from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from src.infrastructure.database import engine, Base, get_db
from src.domain import models, schemas

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API de Exercícios Terapêuticos",
    description="Microsserviço responsável pelo gerenciamento e acompanhamento de exercícios prescritos."
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"status": "ok", "mensagem": "Microsserviço de Exercícios operante!"}


# --- 1. CATÁLOGO DE EXERCÍCIOS (Biblioteca Global) ---

@app.post("/exercicios", response_model=schemas.ExercicioResponse, status_code=status.HTTP_201_CREATED)
def criar_exercicio(exercicio: schemas.ExercicioCreate, db: Session = Depends(get_db)):
    db_exercicio = models.Exercicio(**exercicio.model_dump())
    db.add(db_exercicio)
    db.commit()
    db.refresh(db_exercicio)
    return db_exercicio


@app.get("/exercicios", response_model=List[schemas.ExercicioResponse])
def listar_exercicios(db: Session = Depends(get_db)):
    return db.query(models.Exercicio).order_by(models.Exercicio.id.desc()).all()


@app.get("/exercicios/{exercicio_id}", response_model=schemas.ExercicioResponse)
def obter_exercicio(exercicio_id: int, db: Session = Depends(get_db)):
    exercicio = db.query(models.Exercicio).filter(models.Exercicio.id == exercicio_id).first()
    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado.")
    return exercicio


@app.put("/exercicios/{exercicio_id}", response_model=schemas.ExercicioResponse)
def atualizar_exercicio(
    exercicio_id: int,
    dados: schemas.ExercicioUpdate,
    db: Session = Depends(get_db)
):
    exercicio = db.query(models.Exercicio).filter(models.Exercicio.id == exercicio_id).first()
    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado.")

    for campo, valor in dados.model_dump().items():
        setattr(exercicio, campo, valor)

    db.commit()
    db.refresh(exercicio)
    return exercicio


@app.delete("/exercicios/{exercicio_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir_exercicio(exercicio_id: int, db: Session = Depends(get_db)):
    exercicio = db.query(models.Exercicio).filter(models.Exercicio.id == exercicio_id).first()
    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado.")

    db.delete(exercicio)
    db.commit()
    return None


# --- 2. PRESCRIÇÕES ---

@app.post("/prescricoes", response_model=schemas.PrescricaoResponse, status_code=status.HTTP_201_CREATED)
def criar_prescricao(prescricao: schemas.PrescricaoCreate, db: Session = Depends(get_db)):
    exercicio = db.query(models.Exercicio).filter(models.Exercicio.id == prescricao.exercicio_id).first()
    if not exercicio:
        raise HTTPException(status_code=404, detail="Exercício não encontrado no catálogo.")

    db_prescricao = models.Prescricao(**prescricao.model_dump())
    db.add(db_prescricao)
    db.commit()
    db.refresh(db_prescricao)
    return db_prescricao


@app.get("/prescricoes/paciente/{paciente_id}", response_model=List[schemas.PrescricaoResponse])
def listar_prescricoes_paciente(paciente_id: int, db: Session = Depends(get_db)):
    return db.query(models.Prescricao).filter(
        models.Prescricao.paciente_id == paciente_id,
        models.Prescricao.ativa == True
    ).all()


# --- 3. REGISTROS DE REALIZAÇÃO E HISTÓRICO ---

@app.post("/registros", response_model=schemas.RegistroRealizacaoResponse, status_code=status.HTTP_201_CREATED)
def registrar_realizacao(registro: schemas.RegistroRealizacaoCreate, db: Session = Depends(get_db)):
    prescricao = db.query(models.Prescricao).filter(models.Prescricao.id == registro.prescricao_id).first()
    if not prescricao:
        raise HTTPException(status_code=404, detail="Prescrição não encontrada.")

    db_registro = models.RegistroRealizacao(**registro.model_dump())
    db.add(db_registro)
    db.commit()
    db.refresh(db_registro)
    return db_registro


@app.get("/registros/prescricao/{prescricao_id}", response_model=List[schemas.RegistroRealizacaoResponse])
def listar_registros_prescricao(prescricao_id: int, db: Session = Depends(get_db)):
    return db.query(models.RegistroRealizacao).filter(
        models.RegistroRealizacao.prescricao_id == prescricao_id
    ).all()