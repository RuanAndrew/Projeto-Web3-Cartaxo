import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from src.core.config import settings

bearer = HTTPBearer(auto_error=False)


class UsuarioAutenticado(BaseModel):
    id: uuid.UUID
    perfil: str  # ADMIN, PROFISSIONAL, ATENDENTE, PACIENTE
    token: str   # repassado ao pacientes-service nas consultas entre servicos


def get_current_user(
    credenciais: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> UsuarioAutenticado:
    """Valida o JWT localmente usando o segredo compartilhado do sistema."""
    if credenciais is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso ausente.",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("typ") not in (None, "access"):
        raise HTTPException(status_code=401, detail="Tipo de token não aceito.")

    try:
        id_usuario = uuid.UUID(str(payload.get("sub")))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificador de usuário válido.",
        )

    perfil = str(payload.get("perfil") or payload.get("role") or "").upper()
    return UsuarioAutenticado(id=id_usuario, perfil=perfil, token=credenciais.credentials)


def exigir_perfil(*perfis: str):
    permitidos = {p.upper() for p in perfis}

    def _verificar(
        usuario: UsuarioAutenticado = Depends(get_current_user),
    ) -> UsuarioAutenticado:
        if usuario.perfil not in permitidos:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Acesso não autorizado.",
            )
        return usuario

    return _verificar
