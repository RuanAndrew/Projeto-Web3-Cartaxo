from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from src.core.config import settings

bearer = HTTPBearer()


class Usuario(BaseModel):
    id: int
    papel: str  # "profissional" | "paciente" | "admin"


def get_current_user(
    credenciais: HTTPAuthorizationCredentials = Depends(bearer),
) -> Usuario:
    """Valida o JWT localmente até o auth-service existir.
    Claims esperadas: sub (id do usuário) e role (papel)."""
    try:
        payload = jwt.decode(
            credenciais.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
        return Usuario(id=int(payload["sub"]), papel=payload.get("role", "paciente"))
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado.",
        )


def exigir_profissional(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    if usuario.papel not in ("profissional", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas profissionais de saúde podem executar esta ação.",
        )
    return usuario
