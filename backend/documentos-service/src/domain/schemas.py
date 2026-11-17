from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from src.domain.models import StatusDocumento, TipoDocumento


class DocumentoResponse(BaseModel):
    id: int
    paciente_id: UUID
    profissional_id: UUID
    atendimento_id: Optional[int] = None
    tipo: TipoDocumento
    status: StatusDocumento
    titulo: str
    descricao: Optional[str] = None
    nome_arquivo: str
    content_type: str
    tamanho_bytes: int
    criado_em: datetime
    liberado_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class UrlAssinadaResponse(BaseModel):
    url: str
    expira_em_segundos: int
