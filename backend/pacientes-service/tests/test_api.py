from datetime import date, datetime, timezone
from uuid import UUID, uuid4
import pytest
from httpx import ASGITransport, AsyncClient
from src.auth import current_user
from src.config import get_db
from src.main import app
import src.main as main

ACCOUNT = uuid4()
PATIENT_ID = uuid4()
NOW = datetime.now(timezone.utc)
RECORD = {
    "id": PATIENT_ID, "user_account_id": ACCOUNT, "nome_completo": "Maria Silva",
    "cpf": "52998224725", "data_nascimento": date(1990, 1, 1), "sexo": "FEMININO",
    "telefone_principal": "+5511999999999", "telefone_secundario": None,
    "email": "maria@example.com", "endereco": None, "contato_emergencia": None,
    "observacoes_gerais": None, "ativo": True, "created_at": NOW, "updated_at": NOW,
}

@pytest.mark.asyncio
async def test_crud_http(monkeypatch):
    record = dict(RECORD)
    class FakeService:
        def __init__(self, db): pass
        async def create(self, data, actor):
            record.update(data.model_dump()); return record
        async def get(self, patient_id): return record
        async def update(self, patient_id, data, actor):
            record.update(data.model_dump(exclude_unset=True)); return record
        async def deactivate(self, patient_id, actor):
            record["ativo"] = False; return record
    class FakeRepository:
        def __init__(self, db): pass
        async def list(self, busca, ativo, page, limit): return ([record], 1)
        async def by_user(self, user_id): return record
    monkeypatch.setattr(main, "PacienteService", FakeService)
    monkeypatch.setattr(main, "PacienteRepository", FakeRepository)
    app.dependency_overrides[get_db] = lambda: None
    app.dependency_overrides[current_user] = lambda: {"user_id": ACCOUNT, "role": "admin"}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            payload = {"nome_completo": "Maria Silva", "cpf": "529.982.247-25", "data_nascimento": "1990-01-01", "sexo": "FEMININO", "telefone_principal": "11999999999"}
            created = await client.post("/api/v1/pacientes", json=payload)
            assert created.status_code == 201
            patient_id = created.json()["id"]
            assert UUID(patient_id) == PATIENT_ID
            listed = await client.get("/api/v1/pacientes?busca=Maria&ativo=true")
            assert listed.status_code == 200 and listed.json()["total"] == 1
            updated = await client.put(f"/api/v1/pacientes/{patient_id}", json={"telefone_principal": "11988887777"})
            assert updated.status_code == 200 and updated.json()["telefone_principal"] == "11988887777"
            detail = await client.get(f"/api/v1/pacientes/{patient_id}")
            assert detail.status_code == 200
            inactive = await client.patch(f"/api/v1/pacientes/{patient_id}/inativar")
            assert inactive.status_code == 200 and inactive.json()["ativo"] is False
    finally:
        app.dependency_overrides.clear()
