
import os

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="API Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AGENDAMENTO_SERVICE_URL = os.getenv(
    "AGENDAMENTO_SERVICE_URL",
    "http://localhost:8002",
).rstrip("/")
PACIENTES_SERVICE_URL = os.getenv("PACIENTES_SERVICE_URL", "http://localhost:8005").rstrip("/")


async def encaminhar_agendamento(
    caminho: str,
    request: Request,
    metodo: str,
):
    url = f"{AGENDAMENTO_SERVICE_URL}{caminho}"

    corpo = await request.body()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resposta = await client.request(
                method=metodo,
                url=url,
                content=corpo if corpo else None,
                headers={
                    "content-type": request.headers.get(
                        "content-type", "application/json"
                ),
                **({"authorization": request.headers["authorization"]} if "authorization" in request.headers else {}),
                },
            )

        return Response(
            content=resposta.content,
            status_code=resposta.status_code,
            media_type=resposta.headers.get(
                "content-type", "application/json"
            ),
        )

    except httpx.RequestError:
        return JSONResponse(
            status_code=502,
            content={
                "detail": "Não foi possível acessar o serviço de agendamento."
            },
        )


async def encaminhar_pacientes(caminho: str, request: Request, metodo: str):
    url = f"{PACIENTES_SERVICE_URL}{caminho}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resposta = await client.request(
                method=metodo, url=url, params=request.query_params,
                content=await request.body() or None,
                headers={"content-type": request.headers.get("content-type", "application/json"), **({"authorization": request.headers["authorization"]} if "authorization" in request.headers else {})},
            )
        return Response(content=resposta.content, status_code=resposta.status_code, media_type=resposta.headers.get("content-type", "application/json"))
    except httpx.RequestError:
        return JSONResponse(status_code=502, content={"detail": "Não foi possível acessar o serviço de pacientes."})


@app.get("/health")
async def health():
    return {"status": "ok", "servico": "api-gateway"}


@app.api_route("/api/v1/pacientes", methods=["GET", "POST"])
async def pacientes(request: Request):
    return await encaminhar_pacientes("/api/v1/pacientes", request, request.method)


@app.api_route("/api/v1/pacientes/{resto:path}", methods=["GET", "PUT", "PATCH"])
async def paciente_por_caminho(resto: str, request: Request):
    return await encaminhar_pacientes(f"/api/v1/pacientes/{resto}", request, request.method)


@app.get("/agendamentos")
async def listar_agendamentos(request: Request):
    return await encaminhar_agendamento(
        "/agendamentos", request, "GET"
    )


@app.post("/agendamentos")
async def criar_agendamento(request: Request):
    return await encaminhar_agendamento(
        "/agendamentos", request, "POST"
    )


@app.get("/agendamentos/{agendamento_id}")
async def buscar_agendamento(
    agendamento_id: int,
    request: Request,
):
    return await encaminhar_agendamento(
        f"/agendamentos/{agendamento_id}", request, "GET"
    )


@app.patch("/agendamentos/{agendamento_id}/cancelar")
async def cancelar_agendamento(
    agendamento_id: int,
    request: Request,
):
    return await encaminhar_agendamento(
        f"/agendamentos/{agendamento_id}/cancelar",
        request,
        "PATCH",
    )
