import logging
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Paciente
from .repository import PacienteRepository
from .schemas import PacienteCreate, PacienteUpdate

audit = logging.getLogger("pacientes.audit")

class PacienteService:
    def __init__(self, db: AsyncSession): self.db, self.repo = db, PacienteRepository(db)
    async def create(self, data: PacienteCreate, actor: str):
        if await self.repo.cpf_exists(data.cpf): raise HTTPException(409, "CPF já cadastrado")
        if data.email and await self.repo.email_exists(str(data.email)): raise HTTPException(409, "E-mail já cadastrado")
        patient = Paciente(**data.model_dump())
        self.db.add(patient)
        try:
            await self.db.commit(); await self.db.refresh(patient)
        except IntegrityError:
            await self.db.rollback(); raise HTTPException(409, "CPF ou e-mail já cadastrado")
        audit.info("paciente criado id=%s actor=%s", patient.id, actor)
        return patient
    async def get(self, patient_id: UUID):
        patient = await self.repo.get(patient_id)
        if not patient: raise HTTPException(404, "Paciente não encontrado")
        return patient
    async def update(self, patient_id: UUID, data: PacienteUpdate, actor: str):
        patient = await self.get(patient_id); values = data.model_dump(exclude_unset=True)
        if values.get("cpf") and await self.repo.cpf_exists(values["cpf"], patient_id): raise HTTPException(409, "CPF já cadastrado")
        if values.get("email") and await self.repo.email_exists(str(values["email"]), patient_id): raise HTTPException(409, "E-mail já cadastrado")
        for key, value in values.items(): setattr(patient, key, value)
        try:
            await self.db.commit(); await self.db.refresh(patient)
        except IntegrityError:
            await self.db.rollback(); raise HTTPException(409, "CPF ou e-mail já cadastrado")
        audit.info("paciente atualizado id=%s actor=%s fields=%s", patient.id, actor, ",".join(values))
        return patient
    async def deactivate(self, patient_id: UUID, actor: str):
        patient = await self.get(patient_id); patient.ativo = False
        await self.db.commit(); await self.db.refresh(patient)
        audit.info("paciente inativado id=%s actor=%s", patient.id, actor)
        return patient
