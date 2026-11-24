import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database import Base


def _agora() -> datetime:
    return datetime.now(timezone.utc)


class Prontuario(Base):
    """Cabecalho do prontuario. Nunca e alterado nem apagado."""

    __tablename__ = "prontuarios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    paciente_id: Mapped[uuid.UUID] = mapped_column(Uuid(), index=True)
    profissional_id: Mapped[uuid.UUID] = mapped_column(Uuid(), index=True)
    atendimento_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(), nullable=True)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_agora, server_default=func.now()
    )


class ProntuarioVersao(Base):
    """Cada gravacao e uma versao nova (append-only). A atual e a de maior numero."""

    __tablename__ = "prontuario_versoes"
    __table_args__ = (UniqueConstraint("prontuario_id", "numero", name="uq_versao_numero"),)

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    prontuario_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("prontuarios.id", ondelete="RESTRICT"), index=True
    )
    numero: Mapped[int] = mapped_column(Integer)
    anamnese: Mapped[str] = mapped_column(Text, default="", server_default="")
    evolucao: Mapped[str] = mapped_column(Text, default="", server_default="")
    diagnostico: Mapped[str] = mapped_column(Text, default="", server_default="")
    conduta: Mapped[str] = mapped_column(Text, default="", server_default="")
    autor_id: Mapped[uuid.UUID] = mapped_column(Uuid())
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_agora, server_default=func.now()
    )
