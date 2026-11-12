import logging
import uuid
from typing import Dict

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from jose import JWTError, jwt

from src.core.config import settings

logger = logging.getLogger("gateway")

router = APIRouter()

METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"]

# Cabeçalhos que valem só para uma conexão e não podem ser repassados.
HOP_BY_HOP = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade",
}


def rotas() -> Dict[str, str]:
    """Primeiro segmento do caminho -> URL do microsserviço."""
    return {
        "auth": settings.auth_service_url,
        "documentos": settings.documentos_service_url,
    }


ROTAS_PUBLICAS = {("auth", "login"), ("auth", "refresh")}


def validar_token(request: Request) -> None:
    """Barra no gateway quem não tem JWT válido. Os serviços revalidam por conta
    própria (defesa em profundidade) e aplicam as regras de papel."""
    cabecalho = request.headers.get("authorization", "")
    esquema, _, token = cabecalho.partition(" ")
    desafio = {"WWW-Authenticate": "Bearer"}
    if esquema.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Token de acesso ausente.", headers=desafio)
    try:
        jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado.", headers=desafio)


@router.api_route("/{prefixo}", methods=METODOS)
@router.api_route("/{prefixo}/{caminho:path}", methods=METODOS)
async def encaminhar(prefixo: str, request: Request, caminho: str = ""):
    destino = rotas().get(prefixo)
    if destino is None:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")

    if (prefixo, caminho) not in ROTAS_PUBLICAS:
        validar_token(request)

    tamanho = request.headers.get("content-length", "")
    if tamanho.isdigit() and int(tamanho) > settings.tamanho_maximo_requisicao_bytes:
        raise HTTPException(status_code=413, detail="Requisição acima do tamanho permitido.")

    url = destino.rstrip("/") + request.url.path
    if request.url.query:
        url += "?" + request.url.query

    id_requisicao = request.headers.get("x-request-id") or uuid.uuid4().hex
    cabecalhos = {
        k: v for k, v in request.headers.items()
        if k.lower() not in HOP_BY_HOP and k.lower() != "host"
    }
    cabecalhos["x-request-id"] = id_requisicao
    if request.client:
        anterior = request.headers.get("x-forwarded-for")
        cabecalhos["x-forwarded-for"] = (
            f"{anterior}, {request.client.host}" if anterior else request.client.host
        )

    # O corpo (ex.: upload de PDF) é repassado em fluxo, sem carregar tudo em memória.
    tem_corpo = tamanho not in ("", "0") or "transfer-encoding" in request.headers
    corpo = request.stream() if tem_corpo else None

    cliente: httpx.AsyncClient = request.app.state.http_client
    requisicao = cliente.build_request(request.method, url, headers=cabecalhos, content=corpo)
    try:
        resposta = await cliente.send(requisicao)
    except httpx.TimeoutException:
        logger.warning("Timeout em %s %s [%s]", request.method, url, id_requisicao)
        raise HTTPException(status_code=504, detail="O serviço demorou demais para responder.")
    except httpx.RequestError:
        logger.exception("Falha ao contatar %s [%s]", url, id_requisicao)
        raise HTTPException(status_code=502, detail="Serviço indisponível.")

    # O CORS é responsabilidade do gateway; descarta o que o serviço tenha enviado.
    ignorar = HOP_BY_HOP | {"content-length", "content-encoding"}
    cabecalhos_resposta = {
        k: v for k, v in resposta.headers.items()
        if k.lower() not in ignorar and not k.lower().startswith("access-control-")
    }
    cabecalhos_resposta["x-request-id"] = id_requisicao
    return Response(
        content=resposta.content,
        status_code=resposta.status_code,
        headers=cabecalhos_resposta,
    )
