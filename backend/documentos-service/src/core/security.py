from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from src.core.config import settings

bearer = HTTPBearer()


class Usuario(BaseModel):
    id: str
    papel: str  # "profissional" | "paciente" | "admin"


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

    papel = str(payload.get("perfil") or payload.get("role", "paciente")).lower()

    sub = str(payload.get("sub", ""))
    try:
        id_usuario = int(sub)
    except ValueError:
        id_usuario = sub

    return Usuario(id=str(id_usuario), papel=papel)


def exigir_profissional(usuario: Usuario = Depends(get_current_user)) -> Usuario:
    if usuario.papel not in ("profissional", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas profissionais de saúde podem executar esta ação.",
        )
    return usuario
