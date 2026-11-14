import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from src.infrastructure.database import Base


class PerfilUsuario(str, enum.Enum):

    PACIENTE = "PACIENTE"
    PROFISSIONAL = "PROFISSIONAL"
    ATENDENTE = "ATENDENTE"
    ADMIN = "ADMIN"


class StatusUsuario(str, enum.Enum):

    ATIVO = "ATIVO"
    INATIVO = "INATIVO"


class Usuario(Base):

    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(), primary_key=True, default=uuid.uuid4)

    nome: Mapped[str] = mapped_column(String(150))

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)

    cpf: Mapped[str | None] = mapped_column(String(11), unique=True, index=True)

    senha_hash: Mapped[str] = mapped_column(String(255))

    perfil: Mapped[PerfilUsuario] = mapped_column(
        Enum(
            PerfilUsuario,
            native_enum=False,
            create_constraint=True,
            length=12,
            name="perfil_usuario",
        )
    )

    status: Mapped[StatusUsuario] = mapped_column(
        Enum(
            StatusUsuario,
            native_enum=False,
            create_constraint=True,
            length=7,
            name="status_usuario",
        ),
        default=StatusUsuario.ATIVO,
        server_default="ATIVO",
    )

    permissao_especial: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default="false",
    )

    criado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    atualizado_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    inativado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Usuario {self.perfil.value} ativo={self.status.value}>"
