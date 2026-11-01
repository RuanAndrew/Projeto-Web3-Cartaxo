import re
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from .models import Sexo

def validar_cpf(value: str) -> str:
    cpf = re.sub(r"\D", "", value)
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        raise ValueError("CPF inválido")
    for size in (9, 10):
        total = sum(int(cpf[i]) * (size + 1 - i) for i in range(size))
        digit = (total * 10 % 11) % 10
        if digit != int(cpf[size]):
            raise ValueError("CPF inválido")
    return cpf

class Endereco(BaseModel):
    model_config = ConfigDict(extra="forbid")
    cep: str | None = Field(default=None, pattern=r"^\d{5}-?\d{3}$")
    logradouro: str | None = Field(default=None, max_length=200)
    numero: str | None = Field(default=None, max_length=30)
    complemento: str | None = Field(default=None, max_length=100)
    bairro: str | None = Field(default=None, max_length=100)
    cidade: str | None = Field(default=None, max_length=100)
    uf: str | None = Field(default=None, pattern=r"^[A-Za-z]{2}$")

class ContatoEmergencia(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nome: str = Field(min_length=2, max_length=200)
    parentesco: str = Field(min_length=2, max_length=80)
    telefone: str = Field(min_length=8, max_length=30)

class PacienteBase(BaseModel):
    nome_completo: str = Field(min_length=2, max_length=200)
    cpf: str
    data_nascimento: date
    sexo: Sexo = Sexo.NAO_INFORMAR
    telefone_principal: str = Field(min_length=8, max_length=30)
    telefone_secundario: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    endereco: Endereco | None = None
    contato_emergencia: ContatoEmergencia | None = None
    observacoes_gerais: str | None = Field(default=None, max_length=5000)

    @field_validator("cpf")
    @classmethod
    def cpf_valido(cls, value):
        return validar_cpf(value)

    @field_validator("data_nascimento")
    @classmethod
    def nascimento_no_passado(cls, value):
        if value >= date.today():
            raise ValueError("Data de nascimento deve ser anterior a hoje")
        return value

class PacienteCreate(PacienteBase):
    user_account_id: UUID | None = None

class PacienteUpdate(BaseModel):
    nome_completo: str | None = Field(default=None, min_length=2, max_length=200)
    cpf: str | None = None
    data_nascimento: date | None = None
    sexo: Sexo | None = None
    telefone_principal: str | None = Field(default=None, min_length=8, max_length=30)
    telefone_secundario: str | None = Field(default=None, max_length=30)
    email: EmailStr | None = None
    endereco: Endereco | None = None
    contato_emergencia: ContatoEmergencia | None = None
    observacoes_gerais: str | None = Field(default=None, max_length=5000)
    user_account_id: UUID | None = None

    @field_validator("cpf")
    @classmethod
    def cpf_valido(cls, value):
        return validar_cpf(value) if value is not None else value

    @field_validator("data_nascimento")
    @classmethod
    def nascimento_no_passado(cls, value):
        if value is not None and value >= date.today():
            raise ValueError("Data de nascimento deve ser anterior a hoje")
        return value

class PacienteOut(PacienteBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    user_account_id: UUID | None
    ativo: bool
    created_at: datetime
    updated_at: datetime

class PaginaPacientes(BaseModel):
    items: list[PacienteOut]
    page: int
    limit: int
    total: int
