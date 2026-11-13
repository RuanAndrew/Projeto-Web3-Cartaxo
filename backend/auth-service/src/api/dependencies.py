import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.security import decodificar_token
from src.domain.models import PerfilUsuario, StatusUsuario, Usuario
from src.infrastructure.database import get_db
from src.infrastructure.sessoes import token_acesso_revogado

portador = HTTPBearer(auto_error=False)


async def obter_usuario_atual(
    credenciais: HTTPAuthorizationCredentials | None = Depends(portador),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    if credenciais is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso ausente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        claims = decodificar_token(credenciais.credentials)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if claims.get("typ") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tipo de token não aceito neste endpoint.",
        )

    if await token_acesso_revogado(claims.get("jti", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sessão encerrada. Faça login novamente.",
        )

    try:
        id_usuario = uuid.UUID(str(claims.get("sub")))
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Token inválido.")

    usuario = (
        await db.execute(select(Usuario).where(Usuario.id == id_usuario))
    ).scalar_one_or_none()
    if usuario is None:
        raise HTTPException(status_code=401, detail="Usuário não encontrado.")

    if usuario.status != StatusUsuario.ATIVO:
        raise HTTPException(status_code=403, detail="Conta inativa.")

    return usuario


def exigir_perfil(*perfis: PerfilUsuario):

    async def _verificar(usuario: Usuario = Depends(obter_usuario_atual)) -> Usuario:
        if usuario.perfil not in perfis:
            permitidos = ", ".join(p.value for p in perfis)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acesso restrito aos perfis: {permitidos}.",
            )
        return usuario

    return _verificar
