
from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.database.connection import Base


class AgendamentoDB(Base):
    __tablename__ = "agendamentos"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, index=True
    )
    paciente_id: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    profissional_id: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    data_hora: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    duracao_minutos: Mapped[int] = mapped_column(
        Integer, nullable=False, default=30
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="agendado"
    )
