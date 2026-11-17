import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from src.core.config import settings

bearer = HTTPBearer()


class UsuarioAutenticado(BaseModel):
    id: uuid.UUID
    perfil: str  # ADMIN, PROFISSIONAL, ATENDENTE, PACIENTE


def get_current_user(
    credenciais: HTTPAuthorizationCredentials = Depends(bearer),
) -> UsuarioAutenticado:
    """Valida o JWT localmente usando o segredo compartilhado do sistema."""
    try:
        payload = jwt.decode(
            credenciais.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        )

    perfil = str(
        payload.get("perfil") or payload.get("role") or "PACIENTE"
    ).upper()

    try:
        id_usuario = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificador de usuário válido.",
        )

    return UsuarioAutenticado(
        id=id_usuario,
        perfil=perfil,
    )


def exigir_staff(
    usuario: UsuarioAutenticado = Depends(get_current_user),
) -> UsuarioAutenticado:
    """Permite acesso apenas para equipe interna (Admin, Atendente ou Profissional)."""
    if usuario.perfil not in ("ADMIN", "ATENDENTE", "PROFISSIONAL"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito à equipe da clínica.",
        )
    return usuario