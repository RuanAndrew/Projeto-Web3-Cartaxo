from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# --------------------------------------------------------------------------- #
# Catalogo
# --------------------------------------------------------------------------- #
class ExercicioCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nome: str = Field(min_length=1, max_length=100)
    descricao: str = Field(min_length=1, max_length=5000)
    link_video: str | None = Field(default=None, max_length=255)

    @field_validator("link_video")
    @classmethod
    def validar_link(cls, valor: str | None) -> str | None:
        if valor and not valor.lower().startswith(("http://", "https://")):
            raise ValueError("O link do vídeo deve começar com http:// ou https://.")
        return valor or None


class ExercicioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nome: str
    descricao: str
    link_video: str | None
    criado_em: datetime


# --------------------------------------------------------------------------- #
# Prescricoes
# --------------------------------------------------------------------------- #
class PrescricaoCreate(BaseModel):
    """O profissional vem do token, nunca do corpo."""

    model_config = ConfigDict(str_strip_whitespace=True)

    paciente_id: UUID
    exercicio_id: UUID
    frequencia: str = Field(min_length=1, max_length=100, description='Ex.: "3x por semana"')


class PrescricaoUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    frequencia: str | None = Field(default=None, min_length=1, max_length=100)
    ativa: bool | None = None

    @model_validator(mode="after")
    def exigir_alteracao(self) -> "PrescricaoUpdate":
        if self.frequencia is None and self.ativa is None:
            raise ValueError("Informe frequencia e/ou ativa.")
        return self


class PrescricaoOut(BaseModel):
    id: UUID
    paciente_id: UUID
    profissional_id: UUID
    frequencia: str
    ativa: bool
    criado_em: datetime
    exercicio: ExercicioOut


# --------------------------------------------------------------------------- #
# Registros de realizacao
# --------------------------------------------------------------------------- #
class RegistroCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    nivel_dor: int | None = Field(default=None, ge=0, le=10, description="Escala de 0 a 10")
    observacoes: str | None = Field(default=None, max_length=2000)


class RegistroOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    prescricao_id: UUID
    nivel_dor: int | None
    observacoes: str | None
    realizado_em: datetime
    # Informado pelo proprio paciente; nao ha verificacao automatica (UC-09).
    autodeclarado: bool = True
