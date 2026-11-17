from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

import src.main as main
from src.auth import current_user
from src.config import get_db
from src.main import app

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


@asynccontextmanager
async def cliente_como(monkeypatch, role: str, user_id):
    """Cliente HTTP autenticado com o perfil informado, sem banco de dados."""
    record = dict(RECORD)

    class FakeService:
        def __init__(self, db): pass
        async def get(self, patient_id): return record
        async def update(self, patient_id, data, actor):
            record.update(data.model_dump(exclude_unset=True))
            return record

    class FakeRepository:
        def __init__(self, db): pass
        async def by_user(self, uid):
            # Só a conta dona do cadastro tem paciente vinculado.
            return record if uid == ACCOUNT else None

    monkeypatch.setattr(main, "PacienteService", FakeService)
    monkeypatch.setattr(main, "PacienteRepository", FakeRepository)
    app.dependency_overrides[get_db] = lambda: None
    app.dependency_overrides[current_user] = lambda: {"user_id": user_id, "role": role}
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            yield client
    finally:
        app.dependency_overrides.clear()


async def test_atendente_consulta_e_edita_cadastro(monkeypatch):
    # user_id diferente da conta do paciente: o acesso vem do perfil, não da posse.
    async with cliente_como(monkeypatch, "atendente", uuid4()) as client:
        detalhe = await client.get(f"/api/v1/pacientes/{PATIENT_ID}")
        assert detalhe.status_code == 200

        edicao = await client.put(
            f"/api/v1/pacientes/{PATIENT_ID}",
            json={"telefone_principal": "11988887777"},
        )
        assert edicao.status_code == 200


async def test_paciente_acessa_o_proprio_cadastro_em_me(monkeypatch):
    async with cliente_como(monkeypatch, "paciente", ACCOUNT) as client:
        resposta = await client.get("/api/v1/pacientes/me")
        assert resposta.status_code == 200
        assert resposta.json()["id"] == str(PATIENT_ID)


async def test_me_sem_cadastro_vinculado_retorna_404(monkeypatch):
    async with cliente_como(monkeypatch, "paciente", uuid4()) as client:
        resposta = await client.get("/api/v1/pacientes/me")
        assert resposta.status_code == 404