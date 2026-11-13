from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from src.domain.models import PerfilUsuario, StatusUsuario



class UsuarioOut(BaseModel):

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    email: EmailStr
    cpf: str | None
    perfil: PerfilUsuario
    status: StatusUsuario
    permissao_especial: bool
    criado_em: datetime
    atualizado_em: datetime
    inativado_em: datetime | None


class SessaoOut(BaseModel):

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expira_em: int
    usuario: UsuarioOut


class MensagemSaida(BaseModel):
    mensagem: str



class CadastroIn(BaseModel):

    nome: str = Field(min_length=1, max_length=150)
    email: EmailStr
    senha: str = Field(min_length=8, max_length=72)
    perfil: PerfilUsuario
    cpf: str | None = Field(default=None, pattern="^[0-9]{11}$")


class LoginIn(BaseModel):

    email: str = Field(min_length=3, max_length=255)
    senha: str = Field(min_length=1, max_length=72)


class RenovarIn(BaseModel):

    refresh_token: str = Field(min_length=1)


class LogoutIn(BaseModel):

    refresh_token: str | None = None


class ValidacaoOut(BaseModel):

    valido: bool
    id: UUID
    perfil: PerfilUsuario
    status: StatusUsuario
    permissao_especial: bool
