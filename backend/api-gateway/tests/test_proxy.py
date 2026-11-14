import httpx
from fastapi.testclient import TestClient
from jose import jwt

from src.core.config import settings
from src.main import app


def auth(user_id: int = 1, papel: str = "paciente") -> dict:
    t = jwt.encode({"sub": str(user_id), "role": papel},
                   settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return {"Authorization": f"Bearer {t}"}


def cliente(handler) -> TestClient:
    """TestClient cujo 'upstream' é uma função Python (sem rede)."""
    app.state.http_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return TestClient(app)


async def upstream_ok(request):
    return httpx.Response(200, json={"ok": True})


def test_health():
    assert TestClient(app).get("/health").json()["status"] == "ok"


def test_sem_token_retorna_401():
    r = cliente(upstream_ok).get("/documentos/paciente/1")
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


def test_token_invalido_retorna_401():
    r = cliente(upstream_ok).get("/documentos/paciente/1",
                                 headers={"Authorization": "Bearer lixo"})
    assert r.status_code == 401


def test_token_assinado_com_outra_chave_retorna_401():
    falso = jwt.encode({"sub": "1", "role": "profissional"}, "outra-chave", algorithm="HS256")
    r = cliente(upstream_ok).get("/documentos/paciente/1",
                                 headers={"Authorization": f"Bearer {falso}"})
    assert r.status_code == 401


def test_prefixo_desconhecido_retorna_404_mesmo_sem_token():
    assert cliente(upstream_ok).get("/inexistente/x").status_code == 404


def test_get_e_repassado_com_query_e_cabecalhos():
    visto = {}

    async def handler(request):
        visto["url"] = str(request.url)
        visto["auth"] = request.headers.get("authorization")
        visto["rid"] = request.headers.get("x-request-id")
        visto["corpo"] = await request.aread()
        return httpx.Response(
            200, json=[{"id": 1}], headers={"access-control-allow-origin": "*"}
        )

    cabecalhos = auth()
    r = cliente(handler).get("/documentos/paciente/1?tipo=exame", headers=cabecalhos)

    assert r.status_code == 200 and r.json() == [{"id": 1}]
    assert visto["url"] == "http://documentos-service:8000/documentos/paciente/1?tipo=exame"
    assert visto["auth"] == cabecalhos["Authorization"]
    assert visto["corpo"] == b""
    assert r.headers["x-request-id"] == visto["rid"]
    # O CORS do serviço é descartado para não duplicar com o do gateway.
    assert "access-control-allow-origin" not in r.headers


def test_post_repassa_o_corpo_e_o_status_do_servico():
    visto = {}

    async def handler(request):
        visto["metodo"] = request.method
        visto["tipo"] = request.headers.get("content-type")
        visto["corpo"] = await request.aread()
        return httpx.Response(201, json={"id": 7})

    r = cliente(handler).post(
        "/documentos", content=b"conteudo-do-upload",
        headers={**auth(10, "profissional"), "Content-Type": "application/octet-stream"},
    )

    assert r.status_code == 201 and r.json() == {"id": 7}
    assert visto["metodo"] == "POST"
    assert visto["tipo"] == "application/octet-stream"
    assert visto["corpo"] == b"conteudo-do-upload"


def test_erro_do_servico_e_repassado_sem_alteracao():
    async def handler(request):
        return httpx.Response(403, json={"detail": "Acesso negado ao documento."})

    r = cliente(handler).get("/documentos/1/url", headers=auth())
    assert r.status_code == 403
    assert r.json() == {"detail": "Acesso negado ao documento."}


def test_servico_fora_do_ar_retorna_502():
    async def handler(request):
        raise httpx.ConnectError("recusou", request=request)

    assert cliente(handler).get("/documentos/paciente/1", headers=auth()).status_code == 502


def test_timeout_do_servico_retorna_504():
    async def handler(request):
        raise httpx.ReadTimeout("lento", request=request)

    assert cliente(handler).get("/documentos/paciente/1", headers=auth()).status_code == 504


def test_requisicao_grande_demais_retorna_413(monkeypatch):
    monkeypatch.setattr(settings, "tamanho_maximo_requisicao_bytes", 5)
    r = cliente(upstream_ok).post("/documentos", content=b"0123456789", headers=auth())
    assert r.status_code == 413


def test_preflight_cors_do_frontend_e_aceito():
    origem = settings.lista_cors_origins[0]
    r = TestClient(app).options(
        "/documentos",
        headers={
            "Origin": origem,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == origem
