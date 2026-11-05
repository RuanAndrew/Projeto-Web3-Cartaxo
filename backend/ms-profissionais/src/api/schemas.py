from datetime import time
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from src.domain.models import DiaSemana

Nome = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
NomeEspecialidade = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
DocumentoRegistro = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=50)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------------------------------- #
# Especialidades (UC06)
# --------------------------------------------------------------------------- #
class EspecialidadeCreate(BaseModel):
    nome: NomeEspecialidade


class EspecialidadeUpdate(EspecialidadeCreate):
    pass


class EspecialidadeRead(ORMModel):
    id: int
    nome: str


# --------------------------------------------------------------------------- #
# Disponibilidades (UC07)
# --------------------------------------------------------------------------- #
class DisponibilidadeBase(BaseModel):
    dia_semana: DiaSemana
    horario_inicio: time
    horario_fim: time

    @model_validator(mode="after")
    def validar_intervalo(self):
        if self.horario_fim <= self.horario_inicio:
            raise ValueError("horario_fim deve ser posterior a horario_inicio")
        return self


class DisponibilidadeCreate(DisponibilidadeBase):
    pass


class DisponibilidadeUpdate(DisponibilidadeBase):
    pass


class DisponibilidadeRead(ORMModel):
    id: int
    profissional_id: int
    dia_semana: DiaSemana
    horario_inicio: time
    horario_fim: time


# --------------------------------------------------------------------------- #
# Profissionais (UC05)
# --------------------------------------------------------------------------- #
class ProfissionalCreate(BaseModel):
    nome: Nome
    documento_registro: DocumentoRegistro
    ativo: bool = True
    especialidade_ids: list[int] = Field(default_factory=list)


class ProfissionalUpdate(BaseModel):
    """Atualização completa (PUT)."""

    nome: Nome
    documento_registro: DocumentoRegistro
    ativo: bool


class ProfissionalPatch(BaseModel):
    """Atualização parcial (PATCH) — ex.: apenas ativar/inativar."""

    nome: Nome | None = None
    documento_registro: DocumentoRegistro | None = None
    ativo: bool | None = None


class ProfissionalRead(ORMModel):
    id: int
    nome: str
    documento_registro: str
    ativo: bool
    especialidades: list[EspecialidadeRead]


class ProfissionalDetail(ProfissionalRead):
    disponibilidades: list[DisponibilidadeRead]


class EspecialidadeIds(BaseModel):
    especialidade_ids: list[int] = Field(min_length=1)


# --------------------------------------------------------------------------- #
# Busca de horários (UC08)
# --------------------------------------------------------------------------- #
class HorarioDisponivel(BaseModel):
    disponibilidade_id: int
    profissional_id: int
    profissional_nome: str
    especialidades: list[EspecialidadeRead]
    dia_semana: DiaSemana
    horario_inicio: time
    horario_fim: time

