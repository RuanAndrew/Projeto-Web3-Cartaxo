from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

# --- SCHEMAS DE EXERCÍCIO ---
class ExercicioBase(BaseModel):
    nome: str
    descricao: str
    link_video: Optional[str] = None

class ExercicioCreate(ExercicioBase):
    pass

class ExercicioResponse(ExercicioBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- SCHEMAS DE PRESCRIÇÃO ---
class PrescricaoBase(BaseModel):
    paciente_id: int
    profissional_id: int
    exercicio_id: int
    frequencia: str

class PrescricaoCreate(PrescricaoBase):
    pass

class PrescricaoResponse(PrescricaoBase):
    id: int
    data_criacao: datetime
    ativa: bool
    exercicio: ExercicioResponse

    model_config = ConfigDict(from_attributes=True)


# --- SCHEMAS DE REGISTRO DE REALIZAÇÃO ---
class RegistroRealizacaoBase(BaseModel):
    prescricao_id: int
    nivel_dor: Optional[int] = None
    observacoes: Optional[str] = None

class RegistroRealizacaoCreate(RegistroRealizacaoBase):
    pass

class RegistroRealizacaoResponse(RegistroRealizacaoBase):
    id: int
    data_realizacao: datetime

    model_config = ConfigDict(from_attributes=True)