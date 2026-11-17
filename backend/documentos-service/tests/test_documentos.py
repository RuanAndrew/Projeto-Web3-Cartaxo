
import uuid

from fastapi.testclient import TestClient
from jose import jwt

from src.core.config import settings
from src.main import app


client = TestClient(app)


# Identificadores de teste
ID_PROFISSIONAL = uuid.UUID(
    "11111111-1111-4111-8111-111111111111"
)

ID_PACIENTE = uuid.UUID(
    "22222222-2222-4222-8222-222222222222"
)

ID_OUTRO_PACIENTE = uuid.UUID(
    "33333333-3333-4333-8333-333333333333"
)


def criar_headers(user_id: uuid.UUID, perfil: str) -> dict:
    token = jwt.encode(
        {
            "sub": str(user_id),
            "perfil": perfil.upper(),
            "typ": "access",
        },
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )

    return {
        "Authorization": f"Bearer {token}"
    }


prof = criar_headers(ID_PROFISSIONAL, "PROFISSIONAL")

pac = criar_headers(ID_PACIENTE, "PACIENTE")

outro_pac = criar_headers(
    ID_OUTRO_PACIENTE,
    "PACIENTE",
)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_sem_token_e_negado():
    r = client.get(
        f"/documentos/paciente/{ID_PACIENTE}"
    )

    assert r.status_code in (401, 403)


def test_paciente_nao_ve_documentos_de_outro_paciente():
    r = client.get(
        f"/documentos/paciente/{ID_OUTRO_PACIENTE}",
        headers=pac,
    )

    assert r.status_code == 403, r.text


def test_paciente_nao_pode_criar_documento():
    r = client.post(
        "/documentos",
        headers=pac,
        data={
            "paciente_id": str(ID_PACIENTE),
            "tipo": "receita",
            "titulo": "x",
        },
        files={
            "arquivo": (
                "a.pdf",
                b"%PDF-1.4",
                "application/pdf",
            )
        },
    )

    assert r.status_code == 403, r.text


def test_upload_rejeita_arquivo_que_finge_ser_pdf():
    r = client.post(
        "/documentos",
        headers=prof,
        data={
            "paciente_id": str(ID_PACIENTE),
            "tipo": "receita",
            "titulo": "falso",
        },
        files={
            "arquivo": (
                "falso.pdf",
                b"isto nao e um pdf",
                "application/pdf",
            )
        },
    )

    assert r.status_code == 415, r.text


def test_upload_rejeita_png_declarado_como_pdf():
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16

    r = client.post(
        "/documentos",
        headers=prof,
        data={
            "paciente_id": str(ID_PACIENTE),
            "tipo": "receita",
            "titulo": "troca",
        },
        files={
            "arquivo": (
                "img.pdf",
                png,
                "application/pdf",
            )
        },
    )

    assert r.status_code == 415, r.text
