import hashlib

from src.infrastructure.cache import redis_client

PREFIXO_DENYLIST = "auth:denylist:jti:"
PREFIXO_REFRESH = "auth:refresh:"


def _impressao(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()



async def revogar_token_acesso(jti: str, exp: int) -> None:
    from time import time
    ttl = max(1, int(exp) - int(time()))
    await redis_client.set(PREFIXO_DENYLIST + jti, "revogado", ex=ttl)


async def token_acesso_revogado(jti: str) -> bool:
    return (await redis_client.exists(PREFIXO_DENYLIST + jti)) == 1



async def salvar_refresh(token: str, id_usuario: str, ttl_segundos: int) -> None:
    await redis_client.set(
        PREFIXO_REFRESH + _impressao(token), id_usuario, ex=ttl_segundos
    )


async def buscar_usuario_do_refresh(token: str) -> str | None:
    return await redis_client.get(PREFIXO_REFRESH + _impressao(token))


async def revogar_refresh(token: str) -> None:
    await redis_client.delete(PREFIXO_REFRESH + _impressao(token))
