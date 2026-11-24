"""Consultas ao pacientes-service usando o mesmo token do usuario.

O prontuario referencia o paciente pelo id do cadastro (pacientes.id) e nao
copia nenhum dado cadastral.
"""
from uuid import UUID

import httpx
from fastapi import HTTPException

from src.core.config import settings


async def _get(caminho: str, token: str) -> httpx.Response:
    url = settings.pacientes_service_url.rstrip("/") + caminho
    try:
        async with httpx.AsyncClient(timeout=settings.pacientes_timeout_segundos) as cliente:
            return await cliente.get(url, headers={"Authorization": f"Bearer {token}"})
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Serviço de pacientes indisponível.")


async def obter_paciente_id_da_conta(token: str) -> UUID | None:
    """Id do cadastro vinculado a conta do token, ou None se nao houver vinculo."""
    resposta = await _get("/api/v1/pacientes/me", token)
    if resposta.status_code == 404:
        return None
    if resposta.status_code != 200:
        raise HTTPException(status_code=502, detail="Falha ao consultar o serviço de pacientes.")
    return UUID(resposta.json()["id"])


async def paciente_existe(token: str, paciente_id: UUID) -> bool:
    resposta = await _get(f"/api/v1/pacientes/{paciente_id}", token)
    if resposta.status_code == 200:
        return True
    if resposta.status_code == 404:
        return False
    raise HTTPException(status_code=502, detail="Falha ao consultar o serviço de pacientes.")
