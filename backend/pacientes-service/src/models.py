import enum
import uuid
from datetime import date, datetime
from sqlalchemy import Boolean, Date, DateTime, Enum, Index, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from .config import Base

class Sexo(str, enum.Enum):
    MASCULINO = "MASCULINO"
    FEMININO = "FEMININO"
    OUTRO = "OUTRO"
    NAO_INFORMAR = "NAO_INFORMAR"

class Paciente(Base):
    __tablename__ = "pacientes"
    __table_args__ = (UniqueConstraint("cpf", name="uq_pacientes_cpf"), Index("uq_pacientes_email_lower", text("lower(email)"), unique=True), Index("ix_pacientes_user_account_id", "user_account_id"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    nome_completo: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    cpf: Mapped[str] = mapped_column(String(11), nullable=False)
    data_nascimento: Mapped[date] = mapped_column(Date, nullable=False)
    sexo: Mapped[Sexo] = mapped_column(Enum(Sexo, name="sexo_paciente"), nullable=False, default=Sexo.NAO_INFORMAR)
    telefone_principal: Mapped[str] = mapped_column(String(30), nullable=False)
    telefone_secundario: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(254))
    endereco: Mapped[dict | None] = mapped_column(JSONB)
    contato_emergencia: Mapped[dict | None] = mapped_column(JSONB)
    observacoes_gerais: Mapped[str | None] = mapped_column(Text)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
