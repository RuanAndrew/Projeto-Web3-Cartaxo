import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import jwt
from passlib.context import CryptContext

from src.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha_pura: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha_pura, senha_hash)


def criar_token_acesso(usuario: Any) -> tuple[str, str, int]:
    agora = datetime.now(timezone.utc)
    expira_em = agora + timedelta(minutes=settings.jwt_access_token_expire_minutes)
    jti = uuid4().hex

    claims = {
        "sub": str(usuario.id),
        "perfil": usuario.perfil.value,
        "permissao_especial": bool(usuario.permissao_especial),
        "jti": jti,
        "iat": agora,
        "exp": expira_em,
        "typ": "access",
    }
    token = jwt.encode(claims, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    vida_segundos = int((expira_em - agora).total_seconds())
    return token, jti, vida_segundos


def decodificar_token(token: str) -> dict[str, Any]:
    return jwt.decode(
        token,
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )


def gerar_refresh_token() -> str:
    return secrets.token_urlsafe(64)
