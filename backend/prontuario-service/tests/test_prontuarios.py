import uuid

from tests.conftest import PACIENTE_ID, TOKEN_PACIENTE

PAYLOAD = {
    "paciente_id": str(PACIENTE_ID),
    "anamnese": "Queixa de zumbido ha 2 semanas.",
    "conduta": "Retorno em 30 dias.",
}


async def _abrir(client, login):
    profissional = login("PROFISSIONAL")
    resposta = await client.post("/prontuarios", json=PAYLOAD)
    assert resposta.status_code == 201, resposta.text
    return profissional, resposta.json()


# ---------- autenticacao e perfis ----------

async def test_sem_token_retorna_401(client):
    assert (await client.post("/prontuarios", json=PAYLOAD)).status_code == 401
    assert (await client.get(f"/prontuarios?paciente_id={PACIENTE_ID}")).status_code == 401


async def test_atendente_e_admin_nao_acessam_conteudo_clinico(client, login):
    _, prontuario = await _abrir(client, login)
    for perfil in ("ATENDENTE", "ADMIN"):
        login(perfil)
        assert (await client.post("/prontuarios", json=PAYLOAD)).status_code == 403
        assert (await client.get(f"/prontuarios?paciente_id={PACIENTE_ID}")).status_code == 403
        assert (await client.get(f"/prontuarios/{prontuario['id']}")).status_code == 403


# ---------- abertura ----------

async def test_profissional_abre_prontuario_e_e_o_responsavel(client, login):
    profissional = login("PROFISSIONAL")
    outro = str(uuid.uuid4())
    resposta = await client.post("/prontuarios", json={**PAYLOAD, "profissional_id": outro})

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["profissional_id"] == str(profissional)  # vem do token, nao do corpo
    assert corpo["versao_atual"]["numero"] == 1
    assert corpo["versao_atual"]["anamnese"] == PAYLOAD["anamnese"]


async def test_paciente_inexistente_retorna_404(client, login):
    login("PROFISSIONAL")
    resposta = await client.post("/prontuarios", json={**PAYLOAD, "paciente_id": str(uuid.uuid4())})
    assert resposta.status_code == 404


async def test_conteudo_clinico_vazio_retorna_422(client, login):
    login("PROFISSIONAL")
    resposta = await client.post("/prontuarios", json={"paciente_id": str(PACIENTE_ID)})
    assert resposta.status_code == 422


# ---------- versionamento (UC-04) ----------

async def test_complemento_gera_nova_versao_e_preserva_a_anterior(client, login):
    profissional, prontuario = await _abrir(client, login)
    login("PROFISSIONAL", user_id=profissional)

    resposta = await client.post(
        f"/prontuarios/{prontuario['id']}/versoes", json={"evolucao": "Melhora parcial."}
    )
    assert resposta.status_code == 201
    assert resposta.json()["numero"] == 2
    assert resposta.json()["anamnese"] == PAYLOAD["anamnese"]  # campo omitido e repetido

    historico = (await client.get(f"/prontuarios/{prontuario['id']}/versoes")).json()
    assert [v["numero"] for v in historico] == [1, 2]
    assert historico[0]["evolucao"] == ""                      # v1 intacta
    assert historico[1]["evolucao"] == "Melhora parcial."

    atual = (await client.get(f"/prontuarios/{prontuario['id']}")).json()
    assert atual["versao_atual"]["numero"] == 2


async def test_outro_profissional_nao_complementa(client, login):
    _, prontuario = await _abrir(client, login)
    login("PROFISSIONAL")  # outro usuario
    resposta = await client.post(
        f"/prontuarios/{prontuario['id']}/versoes", json={"evolucao": "x"}
    )
    assert resposta.status_code == 403


async def test_complemento_sem_campos_retorna_422(client, login):
    profissional, prontuario = await _abrir(client, login)
    login("PROFISSIONAL", user_id=profissional)
    resposta = await client.post(f"/prontuarios/{prontuario['id']}/versoes", json={})
    assert resposta.status_code == 422


async def test_nao_existe_exclusao_nem_edicao_destrutiva(client, login):
    _, prontuario = await _abrir(client, login)
    url = f"/prontuarios/{prontuario['id']}"
    for metodo in ("DELETE", "PUT", "PATCH"):
        resposta = await client.request(metodo, url, json={"anamnese": "x"})
        assert resposta.status_code == 405, metodo


# ---------- leitura ----------

async def test_profissional_precisa_informar_o_paciente_na_listagem(client, login):
    login("PROFISSIONAL")
    assert (await client.get("/prontuarios")).status_code == 422


async def test_paciente_le_apenas_o_proprio_prontuario(client, login):
    _, prontuario = await _abrir(client, login)

    login("PACIENTE", token=TOKEN_PACIENTE)
    lista = await client.get("/prontuarios")
    assert lista.status_code == 200 and len(lista.json()) == 1
    assert (await client.get(f"/prontuarios/{prontuario['id']}")).status_code == 200


async def test_paciente_nao_le_prontuario_de_outro(client, login):
    _, prontuario = await _abrir(client, login)

    login("PACIENTE", token="token-de-outro-paciente")
    assert (await client.get("/prontuarios")).json() == []
    assert (await client.get(f"/prontuarios/{prontuario['id']}")).status_code == 403
    assert (await client.get(f"/prontuarios/{prontuario['id']}/versoes")).status_code == 403

    outro = await client.get(f"/prontuarios?paciente_id={PACIENTE_ID}")
    assert outro.status_code == 200
    assert outro.json() == []


async def test_paciente_com_cadastro_nao_consulta_o_id_de_outro_paciente(client, login):
    await _abrir(client, login)

    login("PACIENTE", token=TOKEN_PACIENTE)
    resposta = await client.get(f"/prontuarios?paciente_id={uuid.uuid4()}")
    assert resposta.status_code == 403