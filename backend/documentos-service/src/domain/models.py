import enum
from datetime import datetime

from sqlalchemy import BigInteger, Column, DateTime, Enum, Integer, String, Text

from src.infrastructure.database import Base


class TipoDocumento(str, enum.Enum):
    receita = "receita"
    exame = "exame"
    laudo = "laudo"
    anexo = "anexo"


class StatusDocumento(str, enum.Enum):
    pendente_liberacao = "pendente_liberacao"  # só o profissional enxerga
    liberado = "liberado"                      # visível ao paciente


class Documento(Base):
    __tablename__ = "documentos"

    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, nullable=False, index=True)
    profissional_id = Column(Integer, nullable=False, index=True)
    atendimento_id = Column(Integer, nullable=True, index=True)

    tipo = Column(Enum(TipoDocumento), nullable=False)
    status = Column(Enum(StatusDocumento), nullable=False,
                    default=StatusDocumento.pendente_liberacao)
    titulo = Column(String(150), nullable=False)
    descricao = Column(Text, nullable=True)

    chave_s3 = Column(String(500), nullable=False, unique=True)
    nome_arquivo = Column(String(255), nullable=False)
    content_type = Column(String(100), nullable=False)
    tamanho_bytes = Column(BigInteger, nullable=False)

    criado_em = Column(DateTime, default=datetime.utcnow, nullable=False)
    liberado_em = Column(DateTime, nullable=True)
    # Prontuário não pode ser apagado fisicamente: apenas marcado como excluído.
    excluido_em = Column(DateTime, nullable=True)
    excluido_por = Column(Integer, nullable=True)
