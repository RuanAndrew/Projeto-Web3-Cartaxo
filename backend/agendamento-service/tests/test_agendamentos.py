import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from jose import jwt

from src.core.config import settings
from src.infrastructure.database.connection import get_db
from src.main import app
from src.models import AgendamentoDB


def gerar_token(perfil: str, user_id: uuid.UUID | None = None) -> str:
    sub = str(user_id or uuid.uuid4())
    payload = {
        "sub": sub,
        "perfil": perfil,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


class FakeDB:
    """Simula a sessão assíncrona do SQLAlchemy em memória para testes unitários."""

    def __init__(self):
        self.itens: dict[uuid.UUID, AgendamentoDB] = {}

    async def execute(self, stmt, *args, **kwargs):
        # Ignora chamadas de lock (pg_advisory_xact_lock) no mock
        sql_str = str(stmt)
        if "pg_advisory_xact_lock" in sql_str:
            return MagicMock()

        # Filtra registros em memória para simular SELECT
        resultado = list(self.itens.values())
        mock_scalars = MagicMock()
        mock_scalars.all.return_value = resultado
        mock_res = MagicMock()
        mock_res.scalars.return_value = mock_scalars
        return mock_res

    def add(self, obj: AgendamentoDB):
        if obj.id is None:
            obj.id = uuid.uuid4()
        self.itens[obj.id] = obj

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass

    async def get(self, model, item_id: uuid.UUID):
        return self.itens.get(item_id)

    async def delete(self, obj: AgendamentoDB):
        self.itens.pop(obj.id, None)


@pytest.fixture
def fake_db():
    return FakeDB()


@pytest.fixture
async def client(fake_db):
    async def override_get_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


async def test_acesso_sem_token_bloqueado(client: AsyncClient):
    resp = await client.get("/agendamentos")
    assert resp.status_code in (401, 403)


async def test_criar_e_listar_agendamento_como_atendente(client: AsyncClient):
    token = gerar_token("ATENDENTE")
    headers = {"Authorization": f"Bearer {token}"}
    data_futura = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()

    payload = {
        "paciente_id": str(uuid.uuid4()),
        "profissional_id": str(uuid.uuid4()),
        "data_hora": data_futura,
        "duracao_minutos": 30,
    }

    resp_post = await client.post("/agendamentos", json=payload, headers=headers)
    assert resp_post.status_code == 201
    criado = resp_post.json()
    assert criado["status"] == "agendado"
    assert criado["paciente_id"] == payload["paciente_id"]

    resp_get = await client.get("/agendamentos", headers=headers)
    assert resp_get.status_code == 200
    assert len(resp_get.json()) == 1


async def test_conflito_horario_mesmo_profissional_retorna_409(client: AsyncClient):
    token = gerar_token("ATENDENTE")
    headers = {"Authorization": f"Bearer {token}"}
    prof_id = str(uuid.uuid4())
    data_futura = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()

    payload_1 = {
        "paciente_id": str(uuid.uuid4()),
        "profissional_id": prof_id,
        "data_hora": data_futura,
        "duracao_minutos": 45,
    }
    resp1 = await client.post("/agendamentos", json=payload_1, headers=headers)
    assert resp1.status_code == 201

    # Mesmo profissional, 15 minutos depois (sobreposição)
    data_conflito = (
        datetime.fromisoformat(data_futura) + timedelta(minutes=15)
    ).isoformat()
    payload_2 = {
        "paciente_id": str(uuid.uuid4()),
        "profissional_id": prof_id,
        "data_hora": data_conflito,
        "duracao_minutos": 30,
    }
    resp2 = await client.post("/agendamentos", json=payload_2, headers=headers)
    assert resp2.status_code == 409


async def test_rejeitar_data_no_passado(client: AsyncClient):
    token = gerar_token("ATENDENTE")
    headers = {"Authorization": f"Bearer {token}"}
    data_passada = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()

    payload = {
        "paciente_id": str(uuid.uuid4()),
        "profissional_id": str(uuid.uuid4()),
        "data_hora": data_passada,
        "duracao_minutos": 30,
    }
    resp = await client.post("/agendamentos", json=payload, headers=headers)
    assert resp.status_code == 422


async def test_paciente_nao_pode_agendar_para_outro_paciente(client: AsyncClient):
    meu_id = uuid.uuid4()
    outro_paciente_id = uuid.uuid4()
    token = gerar_token("PACIENTE", user_id=meu_id)
    headers = {"Authorization": f"Bearer {token}"}
    data_futura = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()

    payload = {
        "paciente_id": str(outro_paciente_id),
        "profissional_id": str(uuid.uuid4()),
        "data_hora": data_futura,
        "duracao_minutos": 30,
    }
    resp = await client.post("/agendamentos", json=payload, headers=headers)
    assert resp.status_code == 403


async def test_cancelar_e_bloquear_reativacao_por_paciente(client: AsyncClient):
    paciente_id = uuid.uuid4()
    token_paciente = gerar_token("PACIENTE", user_id=paciente_id)
    headers_paciente = {"Authorization": f"Bearer {token_paciente}"}
    data_futura = (datetime.now(timezone.utc) + timedelta(days=4)).isoformat()

    payload = {
        "paciente_id": str(paciente_id),
        "profissional_id": str(uuid.uuid4()),
        "data_hora": data_futura,
        "duracao_minutos": 30,
    }
    resp_create = await client.post("/agendamentos", json=payload, headers=headers_paciente)
    assert resp_create.status_code == 201
    agendamento_id = resp_create.json()["id"]

    # Paciente pode cancelar o próprio agendamento
    resp_cancel = await client.patch(
        f"/agendamentos/{agendamento_id}/cancelar", headers=headers_paciente
    )
    assert resp_cancel.status_code == 200
    assert resp_cancel.json()["status"] == "cancelado"

    # Paciente NÃO pode reativar diretamente
    resp_reativar = await client.patch(
        f"/agendamentos/{agendamento_id}/reativar", headers=headers_paciente
    )
    assert resp_reativar.status_code == 403

async def test_criar_teleconsulta_e_registrar_link_meet(client: AsyncClient):
    prof_id = uuid.uuid4()
    token_prof = gerar_token("PROFISSIONAL", user_id=prof_id)
    headers_prof = {"Authorization": f"Bearer {token_prof}"}
    data_futura = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()

    payload = {
        "paciente_id": str(uuid.uuid4()),
        "profissional_id": str(prof_id),
        "data_hora": data_futura,
        "duracao_minutos": 30,
        "modalidade": "teleconsulta",
    }
    resp_create = await client.post("/agendamentos", json=payload, headers=headers_prof)
    assert resp_create.status_code == 201
    criado = resp_create.json()
    assert criado["modalidade"] == "teleconsulta"
    assert criado["link_teleconsulta"] is None

    link_meet = "https://meet.google.com/abc-defg-hij"
    resp_link = await client.patch(
        f"/agendamentos/{criado['id']}/teleconsulta",
        json={"link_teleconsulta": link_meet},
        headers=headers_prof,
    )
    assert resp_link.status_code == 200
    assert resp_link.json()["link_teleconsulta"] == link_meet


async def test_paciente_nao_pode_alterar_link_teleconsulta(client: AsyncClient):
    paciente_id = uuid.uuid4()
    token_paciente = gerar_token("PACIENTE", user_id=paciente_id)
    headers_paciente = {"Authorization": f"Bearer {token_paciente}"}
    data_futura = (datetime.now(timezone.utc) + timedelta(days=6)).isoformat()

    payload = {
        "paciente_id": str(paciente_id),
        "profissional_id": str(uuid.uuid4()),
        "data_hora": data_futura,
        "modalidade": "teleconsulta",
    }
    resp_create = await client.post("/agendamentos", json=payload, headers=headers_paciente)
    assert resp_create.status_code == 201
    agendamento_id = resp_create.json()["id"]

    resp_link = await client.patch(
        f"/agendamentos/{agendamento_id}/teleconsulta",
        json={"link_teleconsulta": "https://meet.google.com/xyz-1234-uvw"},
        headers=headers_paciente,
    )
    assert resp_link.status_code == 403

async def test_marcar_nao_compareceu_e_bloquear_paciente(client: AsyncClient):
    paciente_id = uuid.uuid4()
    prof_id = uuid.uuid4()
    token_atendente = gerar_token("ATENDENTE")
    token_paciente = gerar_token("PACIENTE", user_id=paciente_id)
    data_futura = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

    resp_create = await client.post(
        "/agendamentos",
        json={
            "paciente_id": str(paciente_id),
            "profissional_id": str(prof_id),
            "data_hora": data_futura,
        },
        headers={"Authorization": f"Bearer {token_atendente}"},
    )
    assert resp_create.status_code == 201
    agendamento_id = resp_create.json()["id"]

    # Paciente não pode marcar ausência
    resp_pac = await client.patch(
        f"/agendamentos/{agendamento_id}/nao-compareceu",
        headers={"Authorization": f"Bearer {token_paciente}"},
    )
    assert resp_pac.status_code == 403

    # Atendente pode marcar não compareceu
    resp_atend = await client.patch(
        f"/agendamentos/{agendamento_id}/nao-compareceu",
        headers={"Authorization": f"Bearer {token_atendente}"},
    )
    assert resp_atend.status_code == 200
    assert resp_atend.json()["status"] == "nao_compareceu"


async def test_reabrir_consulta_concluida_e_bloquear_outro_profissional(client: AsyncClient):
    prof_id = uuid.uuid4()
    outro_prof_id = uuid.uuid4()
    token_prof = gerar_token("PROFISSIONAL", user_id=prof_id)
    token_outro = gerar_token("PROFISSIONAL", user_id=outro_prof_id)
    data_futura = (datetime.now(timezone.utc) + timedelta(days=8)).isoformat()

    resp_create = await client.post(
        "/agendamentos",
        json={
            "paciente_id": str(uuid.uuid4()),
            "profissional_id": str(prof_id),
            "data_hora": data_futura,
        },
        headers={"Authorization": f"Bearer {token_prof}"},
    )
    assert resp_create.status_code == 201
    agendamento_id = resp_create.json()["id"]

    resp_concluir = await client.patch(
        f"/agendamentos/{agendamento_id}/concluir",
        headers={"Authorization": f"Bearer {token_prof}"},
    )
    assert resp_concluir.status_code == 200
    assert resp_concluir.json()["status"] == "concluido"

    # Outro profissional não pode reabrir consulta de terceiro
    resp_outro = await client.patch(
        f"/agendamentos/{agendamento_id}/reativar",
        headers={"Authorization": f"Bearer {token_outro}"},
    )
    assert resp_outro.status_code == 403

    # O próprio profissional pode reverter conclusão voltando para agendado
    resp_reabrir = await client.patch(
        f"/agendamentos/{agendamento_id}/reativar",
        headers={"Authorization": f"Bearer {token_prof}"},
    )
    assert resp_reabrir.status_code == 200
    assert resp_reabrir.json()["status"] == "agendado"


async def test_excluir_agendamento_permissoes_e_remocao(client: AsyncClient):
    paciente_id = uuid.uuid4()
    prof_id = uuid.uuid4()
    outro_prof_id = uuid.uuid4()
    token_prof = gerar_token("PROFISSIONAL", user_id=prof_id)
    token_outro = gerar_token("PROFISSIONAL", user_id=outro_prof_id)
    token_paciente = gerar_token("PACIENTE", user_id=paciente_id)
    data_futura = (datetime.now(timezone.utc) + timedelta(days=9)).isoformat()

    resp_create = await client.post(
        "/agendamentos",
        json={
            "paciente_id": str(paciente_id),
            "profissional_id": str(prof_id),
            "data_hora": data_futura,
        },
        headers={"Authorization": f"Bearer {token_prof}"},
    )
    assert resp_create.status_code == 201
    agendamento_id = resp_create.json()["id"]

    # Paciente não pode excluir
    resp_pac = await client.delete(
        f"/agendamentos/{agendamento_id}",
        headers={"Authorization": f"Bearer {token_paciente}"},
    )
    assert resp_pac.status_code == 403

    # Outro profissional não pode excluir
    resp_outro = await client.delete(
        f"/agendamentos/{agendamento_id}",
        headers={"Authorization": f"Bearer {token_outro}"},
    )
    assert resp_outro.status_code == 403

    # Profissional responsável pode excluir
    resp_del = await client.delete(
        f"/agendamentos/{agendamento_id}",
        headers={"Authorization": f"Bearer {token_prof}"},
    )
    assert resp_del.status_code == 204

    resp_get = await client.get(
        f"/agendamentos/{agendamento_id}",
        headers={"Authorization": f"Bearer {token_prof}"},
    )
    assert resp_get.status_code == 404