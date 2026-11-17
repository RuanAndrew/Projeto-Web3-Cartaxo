from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from src.infrastructure.database import Base

class Exercicio(Base):
    __tablename__ = "exercicios"

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    descricao = Column(Text, nullable=False)
    link_video = Column(String(255), nullable=True) # Opcional para guiar o paciente

    prescricoes = relationship("Prescricao", back_populates="exercicio")


class Prescricao(Base):
    __tablename__ = "prescricoes"

    id = Column(Integer, primary_key=True, index=True)
    paciente_id = Column(Integer, nullable=False, index=True)      # ID vindo do serviço de usuários/clínico
    profissional_id = Column(Integer, nullable=False, index=True)  # ID do profissional que prescreveu
    exercicio_id = Column(Integer, ForeignKey("exercicios.id"), nullable=False)
    
    frequencia = Column(String(100), nullable=False) # Ex: "3x por semana"
    data_criacao = Column(DateTime, default=datetime.utcnow)
    ativa = Column(Boolean, default=True)

    exercicio = relationship("Exercicio", back_populates="prescricoes")
    registros = relationship("RegistroRealizacao", back_populates="prescricao")


class RegistroRealizacao(Base):
    __tablename__ = "registros_realizacao"

    id = Column(Integer, primary_key=True, index=True)
    prescricao_id = Column(Integer, ForeignKey("prescricoes.id"), nullable=False)
    data_realizacao = Column(DateTime, default=datetime.utcnow)
    nivel_dor = Column(Integer, nullable=True) # Escala de dor de 0 a 10
    observacoes = Column(Text, nullable=True)

    prescricao = relationship("Prescricao", back_populates="registros")