"""Fixtures dos testes de integração.

Usam o Postgres e o MinIO do docker compose, mas em um banco (documentos_test)
e um bucket (clinica-documentos-test) próprios, para nunca tocar nos dados de
desenvolvimento. Se algum dos dois estiver indisponível, os testes são pulados.
"""
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from botocore.exceptions import ClientError
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from uuid import UUID

from src.core.config import settings
from src.infrastructure import storage
from src.infrastructure.database import get_db
from src.main import app

from uuid import UUID

from tests.integration.identificadores import (
    ID_PROFISSIONAL,
    ID_PACIENTE,
    ID_OUTRO_PACIENTE,
)

RAIZ = Path(__file__).resolve().parents[2]
NOME_BANCO_TESTE = "documentos_test"
BUCKET_TESTE = "clinica-documentos-test"


def pytest_collection_modifyitems(items):
    for item in items:
        if "tests/integration" in str(item.fspath).replace("\\", "/"):
            item.add_marker(pytest.mark.integration)


# ---------- Banco ----------

@pytest.fixture(scope="session")
def url_banco_teste():
    return make_url(settings.database_url).set(database=NOME_BANCO_TESTE)


@pytest.fixture(scope="session")
def config_alembic(url_banco_teste):
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "alembic"))
    url = url_banco_teste.render_as_string(hide_password=False)
    cfg.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    return cfg


@pytest.fixture(scope="session")
def banco_teste(url_banco_teste):
    admin = create_engine(
        url_banco_teste.set(database="postgres"),
        isolation_level="AUTOCOMMIT",
        poolclass=NullPool,
    )
    try:
        with admin.connect() as conn:
            conn.execute(text(f"DROP DATABASE IF EXISTS {NOME_BANCO_TESTE} WITH (FORCE)"))
            conn.execute(text(f"CREATE DATABASE {NOME_BANCO_TESTE}"))
    except Exception as erro:
        pytest.skip(f"Postgres indisponível: {erro}")
    yield
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {NOME_BANCO_TESTE} WITH (FORCE)"))
    admin.dispose()


@pytest.fixture(scope="session")
def engine_teste(banco_teste, url_banco_teste, config_alembic):
    # Aplicar as migrations já valida que elas funcionam do zero.
    command.upgrade(config_alembic, "head")
    engine = create_engine(url_banco_teste, poolclass=NullPool)
    yield engine
    engine.dispose()


@pytest.fixture()
def consulta(engine_teste):
    """Executa SQL puro e devolve a lista de linhas (dicts)."""
    def _consulta(sql: str, **parametros):
        with engine_teste.connect() as conn:
            return [dict(l) for l in conn.execute(text(sql), parametros).mappings().all()]
    return _consulta


# ---------- Storage ----------

@pytest.fixture(scope="session")
def bucket_teste():
    if not settings.s3_endpoint_url:
        pytest.skip("S3_ENDPOINT_URL vazio: os testes não rodam contra a AWS real.")

    original = settings.aws_s3_bucket
    settings.aws_s3_bucket = BUCKET_TESTE
    s3 = storage._client(settings.s3_endpoint_url)
    try:
        try:
            s3.head_bucket(Bucket=BUCKET_TESTE)
        except ClientError:
            s3.create_bucket(Bucket=BUCKET_TESTE)
    except Exception as erro:
        settings.aws_s3_bucket = original
        pytest.skip(f"MinIO indisponível: {erro}")

    yield s3

    try:
        for pagina in s3.get_paginator("list_objects_v2").paginate(Bucket=BUCKET_TESTE):
            for obj in pagina.get("Contents", []):
                s3.delete_object(Bucket=BUCKET_TESTE, Key=obj["Key"])
        s3.delete_bucket(Bucket=BUCKET_TESTE)
    finally:
        settings.aws_s3_bucket = original


# ---------- API ----------

@pytest.fixture()
def client(engine_teste, bucket_teste):
    sessao_teste = sessionmaker(autocommit=False, autoflush=False, bind=engine_teste)

    def _get_db():
        db = sessao_teste()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    with engine_teste.begin() as conn:
        conn.execute(text("TRUNCATE TABLE documentos RESTART IDENTITY"))
    yield TestClient(app)
    app.dependency_overrides.clear()

# ---------- API ----------

def _cabecalho(user_id: UUID, papel: str) -> dict:
    t = jwt.encode(
        {
            "sub": str(user_id),
            "perfil": papel.upper(),
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return {"Authorization": f"Bearer {t}"}


@pytest.fixture()
def prof():
    return _cabecalho(ID_PROFISSIONAL, "profissional")


@pytest.fixture()
def pac():
    return _cabecalho(ID_PACIENTE, "paciente")


@pytest.fixture()
def outro_pac():
    return _cabecalho(ID_OUTRO_PACIENTE, "paciente")