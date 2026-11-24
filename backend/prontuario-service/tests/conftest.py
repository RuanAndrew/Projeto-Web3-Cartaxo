import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src import models  # noqa: F401  (registra as tabelas)
from src.core.security import UsuarioAutenticado, get_current_user
from src.infrastructure import pacientes_client
from src.infrastructure.database import Base, get_db
from src.main import app

PACIENTE_ID = uuid.UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")  # id do cadastro (pacientes.id)
TOKEN_PACIENTE = "token-do-paciente"  # a conta com este token tem o cadastro acima


@pytest_asyncio.fixture
async def client(monkeypatch):
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conexao:
        await conexao.run_sync(Base.metadata.create_all)
    fabrica = async_sessionmaker(engine, expire_on_commit=False)

    async def _get_db():
        async with fabrica() as sessao:
            yield sessao

    async def _paciente_existe(token, paciente_id):
        return paciente_id == PACIENTE_ID

    async def _paciente_da_conta(token):
        return PACIENTE_ID if token == TOKEN_PACIENTE else None

    monkeypatch.setattr(pacientes_client, "paciente_existe", _paciente_existe)
    monkeypatch.setattr(pacientes_client, "obter_paciente_id_da_conta", _paciente_da_conta)
    app.dependency_overrides[get_db] = _get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.fixture
def login():
    """Autentica as proximas chamadas como o perfil informado e devolve o id do usuario."""

    def _login(perfil: str, user_id=None, token: str = "token-qualquer"):
        uid = user_id or uuid.uuid4()
        app.dependency_overrides[get_current_user] = lambda: UsuarioAutenticado(
            id=uid, perfil=perfil, token=token
        )
        return uid

    return _login
