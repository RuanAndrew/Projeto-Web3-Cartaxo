from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routers import documentos
from src.infrastructure import storage


@asynccontextmanager
async def lifespan(app: FastAPI):
    # O esquema do banco é gerenciado pelo Alembic (alembic upgrade head).
    try:
        storage.garantir_bucket()
    except Exception as erro:  # não derruba o serviço se o storage ainda não subiu
        print(f"[aviso] bucket não verificado: {erro}")
    yield


app = FastAPI(
    title="API de Documentos Clínicos",
    description="Receitas, exames, laudos e anexos dos atendimentos.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "servico": "documentos-service"}


app.include_router(documentos.router)
