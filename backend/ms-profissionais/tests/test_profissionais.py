"""Cadastro e manutenção de profissionais (UC05)."""

import pytest


class TestCadastroProfissional:
    def test_cadastra_profissional_com_dados_minimos(self, client):
        resp = client.post(
            "/profissionais", json={"nome": "Ana Lima", "documento_registro": "CRFa-12345"}
        )

        assert resp.status_code == 201
        corpo = resp.json()
        assert corpo["id"] > 0
        assert corpo["nome"] == "Ana Lima"
        assert corpo["documento_registro"] == "CRFa-12345"
        assert corpo["ativo"] is True  # padrão
        assert corpo["especialidades"] == []
        assert corpo["disponibilidades"] == []

    def test_profissional_cadastrado_pode_ser_consultado(self, client, criar_profissional):
        criado = criar_profissional("Bruno Souza")

        resp = client.get(f"/profissionais/{criado['id']}")

        assert resp.status_code == 200
        assert resp.json() == criado

    def test_cadastra_profissional_inativo(self, client):
        resp = client.post(
            "/profissionais",
            json={"nome": "Carla", "documento_registro": "CRP-1", "ativo": False},
        )

        assert resp.status_code == 201
        assert resp.json()["ativo"] is False

    def test_remove_espacos_extras_dos_campos_texto(self, client):
        resp = client.post(
            "/profissionais", json={"nome": "  Ana Lima  ", "documento_registro": " CRFa-1 "}
        )

        assert resp.status_code == 201
        assert resp.json()["nome"] == "Ana Lima"
        assert resp.json()["documento_registro"] == "CRFa-1"

    def test_recusa_documento_de_registro_duplicado(self, client, criar_profissional):
        criar_profissional(documento_registro="CRM-999")

        resp = client.post(
            "/profissionais", json={"nome": "Outro", "documento_registro": "CRM-999"}
        )

        assert resp.status_code == 409
        assert "documento de registro" in resp.json()["detail"]
        assert len(client.get("/profissionais").json()) == 1

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param({"documento_registro": "CRM-1"}, id="sem-nome"),
            pytest.param({"nome": "Ana"}, id="sem-documento"),
            pytest.param({"nome": "", "documento_registro": "CRM-1"}, id="nome-vazio"),
            pytest.param({"nome": "   ", "documento_registro": "CRM-1"}, id="nome-so-espacos"),
            pytest.param({"nome": "Ana", "documento_registro": ""}, id="documento-vazio"),
            pytest.param({"nome": "A" * 151, "documento_registro": "CRM-1"}, id="nome-longo"),
            pytest.param({"nome": "Ana", "documento_registro": "X" * 51}, id="documento-longo"),
            pytest.param({"nome": "Ana", "documento_registro": "CRM-1", "ativo": "talvez"}, id="ativo-invalido"),
        ],
    )
    def test_recusa_payload_invalido(self, client, payload):
        resp = client.post("/profissionais", json=payload)

        assert resp.status_code == 422
        assert client.get("/profissionais").json() == []


class TestManutencaoProfissional:
    def test_consulta_profissional_inexistente_retorna_404(self, client):
        assert client.get("/profissionais/999").status_code == 404

    def test_atualizacao_completa(self, client, criar_profissional):
        p = criar_profissional("Ana")

        resp = client.put(
            f"/profissionais/{p['id']}",
            json={"nome": "Ana Maria", "documento_registro": "NOVO-1", "ativo": False},
        )

        assert resp.status_code == 200
        assert resp.json() | {"especialidades": [], "disponibilidades": []} == {
            "id": p["id"],
            "nome": "Ana Maria",
            "documento_registro": "NOVO-1",
            "ativo": False,
            "especialidades": [],
            "disponibilidades": [],
        }

    def test_atualizacao_parcial_inativa_sem_alterar_outros_campos(self, client, criar_profissional):
        p = criar_profissional("Ana")

        resp = client.patch(f"/profissionais/{p['id']}", json={"ativo": False})

        assert resp.status_code == 200
        assert resp.json()["ativo"] is False
        assert resp.json()["nome"] == "Ana"
        assert resp.json()["documento_registro"] == p["documento_registro"]

    def test_atualizacao_para_documento_ja_usado_retorna_409(self, client, criar_profissional):
        a = criar_profissional(documento_registro="DOC-A")
        b = criar_profissional(documento_registro="DOC-B")

        resp = client.patch(f"/profissionais/{b['id']}", json={"documento_registro": "DOC-A"})

        assert resp.status_code == 409
        assert client.get(f"/profissionais/{b['id']}").json()["documento_registro"] == "DOC-B"
        assert client.get(f"/profissionais/{a['id']}").status_code == 200

    def test_exclusao(self, client, criar_profissional):
        p = criar_profissional()

        assert client.delete(f"/profissionais/{p['id']}").status_code == 204
        assert client.get(f"/profissionais/{p['id']}").status_code == 404

    def test_listagem_filtra_por_nome_e_status(self, client, criar_profissional):
        criar_profissional("Ana Lima")
        criar_profissional("Bruno Souza", ativo=False)
        criar_profissional("Mariana Alves")

        nomes = lambda r: [p["nome"] for p in r.json()]  # noqa: E731
        assert nomes(client.get("/profissionais", params={"nome": "ana"})) == ["Ana Lima", "Mariana Alves"]
        assert nomes(client.get("/profissionais", params={"ativo": False})) == ["Bruno Souza"]

