from uuid import UUID
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Paciente

class PacienteRepository:
    def __init__(self, db: AsyncSession): self.db = db
    async def get(self, paciente_id: UUID): return await self.db.get(Paciente, paciente_id)
    async def by_user(self, user_id: UUID):
        return await self.db.scalar(select(Paciente).where(Paciente.user_account_id == user_id))
    async def cpf_exists(self, cpf: str, exclude: UUID | None = None):
        query = select(Paciente.id).where(Paciente.cpf == cpf)
        if exclude: query = query.where(Paciente.id != exclude)
        return await self.db.scalar(query) is not None
    async def email_exists(self, email: str, exclude: UUID | None = None):
        query = select(Paciente.id).where(func.lower(Paciente.email) == email.lower())
        if exclude: query = query.where(Paciente.id != exclude)
        return await self.db.scalar(query) is not None
    async def list(self, busca, ativo, page, limit):
        query = select(Paciente)
        if busca:
            term = f"%{busca.strip()}%"
            digits = "".join(c for c in busca if c.isdigit())
            query = query.where(or_(Paciente.nome_completo.ilike(term), Paciente.cpf.ilike(f"%{digits or busca}%")))
        if ativo is not None: query = query.where(Paciente.ativo == ativo)
        total = await self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        result = await self.db.scalars(query.order_by(Paciente.nome_completo).offset((page - 1) * limit).limit(limit))
        return list(result), total
