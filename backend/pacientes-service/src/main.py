import logging
from uuid import UUID
from fastapi import Depends, FastAPI, Query
from sqlalchemy.ext.asyncio import AsyncSession
from .auth import admin_only, admin_staff, current_user, service_only
from .config import get_db
from .repository import PacienteRepository
from .schemas import PaginaPacientes, PacienteCreate, PacienteOut, PacienteUpdate
from .service import PacienteService

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Microsserviço de Pacientes", version="1.0.0")

@app.get("/health")
async def health(): return {"status": "ok", "servico": "pacientes"}

@app.post("/api/v1/pacientes", response_model=PacienteOut, status_code=201)
async def create(data: PacienteCreate, db: AsyncSession = Depends(get_db), user=Depends(admin_staff)):
    return await PacienteService(db).create(data, str(user["user_id"]))

@app.get("/api/v1/pacientes", response_model=PaginaPacientes)
async def list_patients(busca: str | None = None, ativo: bool | None = None, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100), db: AsyncSession = Depends(get_db), _=Depends(admin_staff)):
    items, total = await PacienteRepository(db).list(busca, ativo, page, limit)
    return {"items": items, "page": page, "limit": limit, "total": total}

@app.get("/api/v1/pacientes/{paciente_id}", response_model=PacienteOut)
async def get_patient(paciente_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(current_user)):
    patient = await PacienteService(db).get(paciente_id)
    if user["role"] not in {"admin", "administrador", "recepcao", "recepção", "profissional"} and patient.user_account_id != user["user_id"]:
        from fastapi import HTTPException
        raise HTTPException(403, "Acesso não autorizado")
    return patient

@app.put("/api/v1/pacientes/{paciente_id}", response_model=PacienteOut)
async def update_patient(paciente_id: UUID, data: PacienteUpdate, db: AsyncSession = Depends(get_db), user=Depends(current_user)):
    role = user["role"]
    staff = role in {"admin", "administrador", "recepcao", "recepção"}
    patient = await PacienteService(db).get(paciente_id)
    if not staff and patient.user_account_id != user["user_id"]:
        from fastapi import HTTPException
        raise HTTPException(403, "Acesso não autorizado")
    if not staff:
        forbidden = set(data.model_fields_set) - {"telefone_principal", "telefone_secundario", "email", "endereco", "contato_emergencia"}
        if forbidden:
            from fastapi import HTTPException
            raise HTTPException(403, "Paciente só pode atualizar dados de contato")
    return await PacienteService(db).update(paciente_id, data, str(user["user_id"]))

@app.patch("/api/v1/pacientes/{paciente_id}/inativar", response_model=PacienteOut)
async def deactivate(paciente_id: UUID, db: AsyncSession = Depends(get_db), user=Depends(admin_only)):
    return await PacienteService(db).deactivate(paciente_id, str(user["user_id"]))

@app.get("/api/v1/pacientes/by-user/{user_account_id}", response_model=PacienteOut)
async def by_user(user_account_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(service_only)):
    patient = await PacienteRepository(db).by_user(user_account_id)
    if not patient:
        from fastapi import HTTPException
        raise HTTPException(404, "Paciente não encontrado")
    return patient
