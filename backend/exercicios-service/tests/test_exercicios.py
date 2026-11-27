import uuid

from tests.conftest import PACIENTE_ID, TOKEN_PACIENTE

EXERCICIO = {
    "nome": "Vibração de lábios",
    "descricao": "3 séries de 10 repetições, em tom confortável.",
    "link_video": "https://exemplo.com/video",
}


async def _novo_exercicio(client, login):
    profissional = login("PROFISSIONAL")
    r = await client.post("/exercicios/catalogo", json=EXERCICIO)
    assert r.status_code == 201, r.text
    return profissional, r.json()


async def _prescrever(client, login, frequencia="3x por semana"):
    profissional, exercicio = await _novo_exercicio(client, login)
    r = await client.post(
        "/exercicios/prescricoes",
        json={
            "paciente_id": str(PACIENTE_ID),
            "exercicio_id": exercicio["id"],
            "frequencia": frequencia,
        },
    )
    assert r.status_code == 201, r.text
    return profissional, exercicio, r.json()


# ---------- autenticacao e perfis ----------

async def test_sem_token_retorna_401(client):
    assert (await client.get("/exercicios/catalogo")).status_code == 401
    assert (await client.post("/exercicios/catalogo", json=EXERCICIO)).status_code == 401
    assert (await client.get(f"/exercicios/prescricoes?paciente_id={PACIENTE_ID}")).status_code == 401


async def test_atendente_e_admin_nao_acessam(client, login):
    for perfil in ("ATENDENTE", "ADMIN"):
        login(perfil)
        assert (await client.get("/exercicios/catalogo")).status_code == 403
        assert (await client.post("/exercicios/catalogo", json=EXERCICIO)).status_code == 403
        assert (await client.get(f"/exercicios/prescricoes?paciente_id={PACIENTE_ID}")).status_code == 403


# ---------- catalogo ----------

async def test_apenas_profissional_cria_exercicio(client, login):
    login("PACIENTE", token=TOKEN_PACIENTE)
    assert (await client.post("/exercicios/catalogo", json=EXERCICIO)).status_code == 403

    login("PROFISSIONAL")
    criado = await client.post("/exercicios/catalogo", json=EXERCICIO)
    assert criado.status_code == 201

    login("PACIENTE", token=TOKEN_PACIENTE)
    lista = await client.get("/exercicios/catalogo")
    assert lista.status_code == 200 and len(lista.json()) == 1


async def test_link_de_video_precisa_ser_http(client, login):
    login("PROFISSIONAL")
    r = await client.post("/exercicios/catalogo", json={**EXERCICIO, "link_video": "javascript:alert(1)"})
    assert r.status_code == 422


# ---------- prescricoes ----------

async def test_profissional_prescreve_e_e_o_responsavel(client, login):
    profissional, exercicio = await _novo_exercicio(client, login)
    outro = str(uuid.uuid4())
    r = await client.post(
        "/exercicios/prescricoes",
        json={
            "paciente_id": str(PACIENTE_ID),
            "exercicio_id": exercicio["id"],
            "frequencia": "3x por semana",
            "profissional_id": outro,
        },
    )
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["profissional_id"] == str(profissional)  # vem do token, nao do corpo
    assert corpo["ativa"] is True
    assert corpo["exercicio"]["nome"] == EXERCICIO["nome"]


async def test_prescrever_exercicio_ou_paciente_inexistente_retorna_404(client, login):
    _, exercicio = await _novo_exercicio(client, login)
    sem_exercicio = await client.post(
        "/exercicios/prescricoes",
        json={"paciente_id": str(PACIENTE_ID), "exercicio_id": str(uuid.uuid4()), "frequencia": "diária"},
    )
    assert sem_exercicio.status_code == 404
    sem_paciente = await client.post(
        "/exercicios/prescricoes",
        json={"paciente_id": str(uuid.uuid4()), "exercicio_id": exercicio["id"], "frequencia": "diária"},
    )
    assert sem_paciente.status_code == 404


async def test_frequencia_vazia_retorna_422(client, login):
    _, exercicio = await _novo_exercicio(client, login)
    r = await client.post(
        "/exercicios/prescricoes",
        json={"paciente_id": str(PACIENTE_ID), "exercicio_id": exercicio["id"], "frequencia": "  "},
    )
    assert r.status_code == 422


async def test_profissional_precisa_informar_o_paciente_na_listagem(client, login):
    login("PROFISSIONAL")
    assert (await client.get("/exercicios/prescricoes")).status_code == 422


async def test_paciente_le_apenas_as_proprias_prescricoes(client, login):
    _, _, prescricao = await _prescrever(client, login)

    login("PACIENTE", token=TOKEN_PACIENTE)
    lista = await client.get("/exercicios/prescricoes")
    assert lista.status_code == 200 and len(lista.json()) == 1
    assert (await client.get(f"/exercicios/prescricoes/{prescricao['id']}")).status_code == 200

    login("PACIENTE", token="token-de-outro-paciente")
    assert (await client.get("/exercicios/prescricoes")).json() == []
    assert (await client.get(f"/exercicios/prescricoes/{prescricao['id']}")).status_code == 403


async def test_paciente_com_cadastro_nao_consulta_o_id_de_outro(client, login):
    await _prescrever(client, login)
    login("PACIENTE", token=TOKEN_PACIENTE)
    r = await client.get(f"/exercicios/prescricoes?paciente_id={uuid.uuid4()}")
    assert r.status_code == 403


async def test_so_o_responsavel_altera_a_prescricao(client, login):
    profissional, _, prescricao = await _prescrever(client, login)
    url = f"/exercicios/prescricoes/{prescricao['id']}"

    login("PROFISSIONAL")  # outro profissional
    assert (await client.patch(url, json={"frequencia": "diária"})).status_code == 403

    login("PROFISSIONAL", user_id=profissional)
    alterada = await client.patch(url, json={"frequencia": "diária"})
    assert alterada.status_code == 200 and alterada.json()["frequencia"] == "diária"
    assert (await client.patch(url, json={})).status_code == 422


async def test_inativar_tira_a_prescricao_da_listagem_padrao(client, login):
    profissional, _, prescricao = await _prescrever(client, login)
    url = f"/exercicios/prescricoes/{prescricao['id']}"
    assert (await client.patch(url, json={"ativa": False})).json()["ativa"] is False

    padrao = await client.get(f"/exercicios/prescricoes?paciente_id={PACIENTE_ID}")
    assert padrao.json() == []
    todas = await client.get(f"/exercicios/prescricoes?paciente_id={PACIENTE_ID}&apenas_ativas=false")
    assert len(todas.json()) == 1


async def test_nao_existe_exclusao(client, login):
    _, _, prescricao = await _prescrever(client, login)
    assert (await client.delete(f"/exercicios/prescricoes/{prescricao['id']}")).status_code == 405


# ---------- registros de realizacao (autodeclarados) ----------

async def test_paciente_registra_realizacao_autodeclarada(client, login):
    _, _, prescricao = await _prescrever(client, login)
    url = f"/exercicios/prescricoes/{prescricao['id']}/registros"

    login("PACIENTE", token=TOKEN_PACIENTE)
    r = await client.post(url, json={"nivel_dor": 3, "observacoes": "Leve cansaço."})
    assert r.status_code == 201
    assert r.json()["autodeclarado"] is True and r.json()["nivel_dor"] == 3

    lista = await client.get(url)
    assert lista.status_code == 200 and len(lista.json()) == 1


async def test_nivel_de_dor_fora_de_0_a_10_retorna_422(client, login):
    _, _, prescricao = await _prescrever(client, login)
    url = f"/exercicios/prescricoes/{prescricao['id']}/registros"
    login("PACIENTE", token=TOKEN_PACIENTE)
    assert (await client.post(url, json={"nivel_dor": 11})).status_code == 422
    assert (await client.post(url, json={"nivel_dor": -1})).status_code == 422
    assert (await client.post(url, json={"nivel_dor": 0})).status_code == 201


async def test_so_o_paciente_dono_registra_realizacao(client, login):
    profissional, _, prescricao = await _prescrever(client, login)
    url = f"/exercicios/prescricoes/{prescricao['id']}/registros"

    login("PROFISSIONAL", user_id=profissional)
    assert (await client.post(url, json={})).status_code == 403

    login("PACIENTE", token="token-de-outro-paciente")
    assert (await client.post(url, json={})).status_code == 403
    assert (await client.get(url)).status_code == 403


async def test_prescricao_inativa_nao_aceita_registro(client, login):
    profissional, _, prescricao = await _prescrever(client, login)
    await client.patch(f"/exercicios/prescricoes/{prescricao['id']}", json={"ativa": False})

    login("PACIENTE", token=TOKEN_PACIENTE)
    r = await client.post(f"/exercicios/prescricoes/{prescricao['id']}/registros", json={})
    assert r.status_code == 409
