from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from src.api.routers import disponibilidades, especialidades, profissionais
from src.domain import models  # noqa: F401  (registra os modelos no metadata)
from src.infrastructure.database import Base, engine, get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cria as tabelas na inicialização e aplica migração incremental da coluna data_atendimento.
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE disponibilidades "
                "ADD COLUMN IF NOT EXISTS data_atendimento DATE"
            )
        )
    yield


app = FastAPI(
    title="MS Profissionais",
    description="Microsserviço responsável pelos profissionais de saúde, suas especialidades e disponibilidades.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(profissionais.router)
app.include_router(especialidades.router)
app.include_router(disponibilidades.router)


@app.get("/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "ok"}

