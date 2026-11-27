import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database import Base


def _agora() -> datetime:
    return datetime.now(timezone.utc)


class Exercicio(Base):
    """Catalogo global de exercicios."""

    __tablename__ = "exercicios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(100))
    descricao: Mapped[str] = mapped_column(Text)
    link_video: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criado_por: Mapped[uuid.UUID] = mapped_column(Uuid())
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_agora, server_default=func.now()
    )


class Prescricao(Base):
    """Rotina prescrita a um paciente (paciente_id = pacientes.id)."""

    __tablename__ = "prescricoes"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    paciente_id: Mapped[uuid.UUID] = mapped_column(Uuid(), index=True)
    profissional_id: Mapped[uuid.UUID] = mapped_column(Uuid(), index=True)
    exercicio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("exercicios.id", ondelete="RESTRICT")
    )
    frequencia: Mapped[str] = mapped_column(String(100))
    ativa: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_agora, server_default=func.now()
    )


class RegistroRealizacao(Base):
    """Marcacao AUTODECLARADA pelo paciente. Nao ha verificacao de execucao correta."""

    __tablename__ = "registros_realizacao"
    __table_args__ = (
        CheckConstraint(
            "nivel_dor IS NULL OR (nivel_dor >= 0 AND nivel_dor <= 10)",
            name="ck_registro_nivel_dor",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)
    prescricao_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(), ForeignKey("prescricoes.id", ondelete="RESTRICT"), index=True
    )
    nivel_dor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    realizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_agora, server_default=func.now()
    )
