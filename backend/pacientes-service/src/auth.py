import os
from uuid import UUID
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

bearer = HTTPBearer(auto_error=False)
SECRET = os.getenv("JWT_SECRET_KEY", "changeme-super-secret")
ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

async def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials:
        raise HTTPException(401, "Token de acesso obrigatório")
    try:
        claims = jwt.decode(credentials.credentials, SECRET, algorithms=[ALGORITHM])
        user_id = claims.get("sub") or claims.get("user_id")
        if not user_id:
            raise ValueError("sub ausente")
        return {**claims, "user_id": UUID(str(user_id)), "role": str(claims.get("role", claims.get("perfil", ""))).lower()}
    except (JWTError, ValueError, TypeError):
        raise HTTPException(401, "Token inválido")

def require_roles(*roles):
    async def dependency(user=Depends(current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Acesso não autorizado")
        return user
    return dependency

admin_staff = require_roles("admin", "administrador", "recepcao", "recepção", "profissional")
admin_only = require_roles("admin", "administrador")
service_only = require_roles("service", "servico", "serviço")
