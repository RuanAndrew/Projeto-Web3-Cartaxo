from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from src.core.config import settings
from src.api.routers import auth
from src.infrastructure.cache import redis_client
from src.infrastructure.database import SessionLocal, engine
from src.infrastructure.seeds import seed_admin, seed_usuarios_genericos


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        if await seed_admin():
            print("[startup] ADMIN inicial criado")
        criadas = await seed_usuarios_genericos()
        if criadas:
            print(f"[startup] {criadas} conta(s) genérica(s) de perfil criada(s)")
    except Exception as erro:
        print(f"[aviso] seed dos usuários iniciais não executado: {erro}")

    yield

    await engine.dispose()
    await redis_client.aclose()


app = FastAPI(
    title="Serviço de Autenticação e Usuários",
    description=(
        "Microsserviço responsável pela autenticação, pelos perfis de acesso "
        "(Paciente, Profissional, Atendente e Administrador) e pelas "
        "permissões dos usuários da clínica."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origens_cors,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health():
    try:
        async with SessionLocal() as db:
            await db.execute(text("SELECT 1"))
        database_ok = True
    except Exception as erro:
        print(f"[health] PostgreSQL indisponível: {erro}")
        database_ok = False

    try:
        await redis_client.ping()
        redis_ok = True
    except Exception as erro:
        print(f"[health] Redis indisponível: {erro}")
        redis_ok = False

    if not database_ok:
        return JSONResponse(
            status_code=503,
            content={"status": "degradado", "database": False, "redis": redis_ok},
        )
    return {
        "status": "ok",
        "servico": "auth-service",
        "database": database_ok,
        "redis": redis_ok,
    }


app.include_router(auth.router)
