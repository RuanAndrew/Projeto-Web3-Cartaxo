import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from src.core.config import settings

bearer = HTTPBearer()

class Usuario(BaseModel):
    id: uuid.UUID
    papel: str

def get_current_user(
    credenciais: HTTPAuthorizationCredentials = Depends(bearer),
) -> Usuario:
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

    papel = str(
        payload.get("perfil") or payload.get("role", "paciente")
    ).lower()

    try:
        id_usuario = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificador de usuário válido.",
        )

    return Usuario(
        id=id_usuario,
        papel=papel,
    )

def exigir_profissional(
    usuario: Usuario = Depends(get_current_user),
) -> Usuario:
    if usuario.papel not in ("profissional", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas profissionais de saúde podem executar esta ação.",
        )

    return usuario