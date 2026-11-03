from fastapi.testclient import TestClient
from jose import jwt

from src.core.config import settings
from src.main import app

client = TestClient(app)


def token(user_id: int, role: str) -> dict:
    t = jwt.encode({"sub": str(user_id), "role": role},
                   settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return {"Authorization": f"Bearer {t}"}


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_sem_token_e_negado():
    assert client.get("/documentos/paciente/1").status_code in (401, 403)


def test_paciente_nao_ve_documentos_de_outro_paciente():
    r = client.get("/documentos/paciente/2", headers=token(1, "paciente"))
    assert r.status_code == 403


def test_paciente_nao_pode_criar_documento():
    r = client.post(
        "/documentos",
        headers=token(1, "paciente"),
        data={"paciente_id": 1, "tipo": "receita", "titulo": "x"},
        files={"arquivo": ("a.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 403


def test_upload_rejeita_arquivo_que_finge_ser_pdf():
    r = client.post(
        "/documentos",
        headers=token(10, "profissional"),
        data={"paciente_id": 1, "tipo": "receita", "titulo": "falso"},
        files={"arquivo": ("falso.pdf", b"isto nao e um pdf", "application/pdf")},
    )
    assert r.status_code == 415


def test_upload_rejeita_png_declarado_como_pdf():
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
    r = client.post(
        "/documentos",
        headers=token(10, "profissional"),
        data={"paciente_id": 1, "tipo": "receita", "titulo": "troca"},
        files={"arquivo": ("img.pdf", png, "application/pdf")},
    )
    assert r.status_code == 415
