from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.core.config import settings
from src.routers import proxy


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.timeout_segundos, connect=5.0),
        follow_redirects=False,
    )
    yield
    await app.state.http_client.aclose()


app = FastAPI(
    title="API Gateway da Clínica",
    description="Ponto único de entrada: valida o JWT e encaminha para os microsserviços.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.lista_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


@app.get("/health")
def health():
    return {"status": "ok", "servico": "api-gateway"}


app.include_router(proxy.router)
