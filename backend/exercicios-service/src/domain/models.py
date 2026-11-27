from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from src.infrastructure.database import Base


class Exercicio(Base):
    __tablename__ = "exercicios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    categoria = Column(String(50), nullable=False)
    descricao = Column(Text, nullable=False)
    instrucoes = Column(Text, nullable=False)
    url_midia = Column(String(255), nullable=True)

    prescricoes = relationship("Prescricao", back_populates="exercicio")


class Prescricao(Base):
    __tablename__ = "prescricoes"

    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, nullable=False, index=True)
    profissional_id = Column(Integer, nullable=False, index=True)
    exercicio_id = Column(Integer, ForeignKey("exercicios.id"), nullable=False)

    frequencia = Column(String(100), nullable=False)
    data_criacao = Column(DateTime, default=datetime.utcnow)
    ativa = Column(Boolean, default=True)

    exercicio = relationship("Exercicio", back_populates="prescricoes")
    registros = relationship("RegistroRealizacao", back_populates="prescricao")


class RegistroRealizacao(Base):
    __tablename__ = "registros_realizacao"

    id = Column(Integer, primary_key=True, index=True)
    prescricao_id = Column(Integer, ForeignKey("prescricoes.id"), nullable=False)
    data_realizacao = Column(DateTime, default=datetime.utcnow)
    nivel_dor = Column(Integer, nullable=True)
    observacoes = Column(Text, nullable=True)

    prescricao = relationship("Prescricao", back_populates="registros")