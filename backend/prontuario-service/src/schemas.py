from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

CAMPOS_CLINICOS = ("anamnese", "evolucao", "diagnostico", "conduta")


class ProntuarioCreate(BaseModel):
    """Abertura do prontuario. O profissional vem do token, nunca do corpo."""

    model_config = ConfigDict(str_strip_whitespace=True)

    paciente_id: UUID
    atendimento_id: UUID | None = None
    anamnese: str = Field(default="", max_length=10000)
    evolucao: str = Field(default="", max_length=10000)
    diagnostico: str = Field(default="", max_length=5000)
    conduta: str = Field(default="", max_length=10000)

    @model_validator(mode="after")
    def exigir_conteudo(self) -> "ProntuarioCreate":
        if not any(getattr(self, campo) for campo in CAMPOS_CLINICOS):
            raise ValueError("Informe pelo menos um campo clínico.")
        return self


class VersaoCreate(BaseModel):
    """Complemento. Campos omitidos (ou null) repetem o valor da versao anterior."""

    model_config = ConfigDict(str_strip_whitespace=True)

    anamnese: str | None = Field(default=None, max_length=10000)
    evolucao: str | None = Field(default=None, max_length=10000)
    diagnostico: str | None = Field(default=None, max_length=5000)
    conduta: str | None = Field(default=None, max_length=10000)

    @model_validator(mode="after")
    def exigir_alteracao(self) -> "VersaoCreate":
        if not any(getattr(self, campo) is not None for campo in CAMPOS_CLINICOS):
            raise ValueError("Informe pelo menos um campo clínico.")
        return self


class VersaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    numero: int
    anamnese: str
    evolucao: str
    diagnostico: str
    conduta: str
    autor_id: UUID
    criado_em: datetime


class ProntuarioOut(BaseModel):
    id: UUID
    paciente_id: UUID
    profissional_id: UUID
    atendimento_id: UUID | None
    criado_em: datetime
    versao_atual: VersaoOut
