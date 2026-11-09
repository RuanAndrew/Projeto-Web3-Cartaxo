import enum
from datetime import time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Enum,
    ForeignKey,
    Integer,
    String,
    Table,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.infrastructure.database import Base


class DiaSemana(str, enum.Enum):
    SEGUNDA = "SEGUNDA"
    TERCA = "TERCA"
    QUARTA = "QUARTA"
    QUINTA = "QUINTA"
    SEXTA = "SEXTA"
    SABADO = "SABADO"
    DOMINGO = "DOMINGO"


# Tabela associativa N:N entre Profissional e Especialidade.
# A chave primária composta impede vincular a mesma especialidade duas vezes.
profissional_especialidade = Table(
    "profissional_especialidade",
    Base.metadata,
    Column(
        "profissional_id",
        Integer,
        ForeignKey("profissionais.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "especialidade_id",
        Integer,
        ForeignKey("especialidades.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Profissional(Base):
    __tablename__ = "profissionais"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(150))
    # Registro no conselho de classe (ex.: CRM, CREFITO, CRFa).
    documento_registro: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # N:N
    especialidades: Mapped[list["Especialidade"]] = relationship(
        secondary=profissional_especialidade,
        back_populates="profissionais",
    )

    # 1:N — as disponibilidades pertencem ao profissional e são removidas junto com ele.
    disponibilidades: Mapped[list["Disponibilidade"]] = relationship(
        back_populates="profissional",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Especialidade(Base):
    __tablename__ = "especialidades"

    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(100), unique=True)

    profissionais: Mapped[list[Profissional]] = relationship(
        secondary=profissional_especialidade,
        back_populates="especialidades",
    )


class Disponibilidade(Base):
    __tablename__ = "disponibilidades"
    __table_args__ = (
        CheckConstraint("horario_fim > horario_inicio", name="ck_disponibilidade_intervalo"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    profissional_id: Mapped[int] = mapped_column(
        ForeignKey("profissionais.id", ondelete="CASCADE"),
        index=True,
    )
    # Armazenado como VARCHAR + CHECK (native_enum=False) para facilitar futuras migrações.
    dia_semana: Mapped[DiaSemana] = mapped_column(
        Enum(DiaSemana, native_enum=False, create_constraint=True, length=10, name="dia_semana")
    )
    horario_inicio: Mapped[time] = mapped_column(Time)
    horario_fim: Mapped[time] = mapped_column(Time)

    profissional: Mapped[Profissional] = relationship(back_populates="disponibilidades")

