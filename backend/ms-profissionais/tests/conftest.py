"""
Infraestrutura de testes.

Os testes rodam contra um PostgreSQL real (banco `profissionais_test`, criado
automaticamente se não existir) para validar também as constraints do banco
(CHECK, UNIQUE, ON DELETE CASCADE). Cada teste começa com as tabelas vazias.
"""

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from src.infrastructure.database import Base, get_db
from src.main import app

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://profissionais_user:profissionais_pass@localhost:5437/profissionais_test",
)


def _garantir_banco_de_teste(url: str) -> None:
    url_obj = make_url(url)
    admin = create_engine(url_obj.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        existe = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :nome"), {"nome": url_obj.database}
        )
        if not existe:
            conn.execute(text(f'CREATE DATABASE "{url_obj.database}"'))
    admin.dispose()


@pytest.fixture(scope="session")
def engine():
    _garantir_banco_de_teste(TEST_DATABASE_URL)
    eng = create_engine(TEST_DATABASE_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture(scope="session")
def SessionTeste(engine):
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture(autouse=True)
def limpar_tabelas(engine):
    yield
    nomes = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {nomes} RESTART IDENTITY CASCADE"))


@pytest.fixture
def db_session(SessionTeste):
    with SessionTeste() as session:
        yield session


@pytest.fixture
def client(SessionTeste):
    def _get_db_teste():
        with SessionTeste() as session:
            yield session

    app.dependency_overrides[get_db] = _get_db_teste
    # Sem "with": o lifespan (create_all no banco de desenvolvimento) não é executado.
    yield TestClient(app)
    app.dependency_overrides.clear()


# --------------------------------------------------------------------------- #
# Fábricas auxiliares
# --------------------------------------------------------------------------- #
@pytest.fixture
def criar_especialidade(client):
    def _criar(nome: str) -> dict:
        resp = client.post("/especialidades", json={"nome": nome})
        assert resp.status_code == 201, resp.text
        return resp.json()

    return _criar


@pytest.fixture
def criar_profissional(client):
    contador = iter(range(1, 10_000))

    def _criar(nome: str = "Profissional Teste", **extras) -> dict:
        payload = {"nome": nome, "documento_registro": f"REG-{next(contador)}", **extras}
        resp = client.post("/profissionais", json=payload)
        assert resp.status_code == 201, resp.text
        return resp.json()

    return _criar

