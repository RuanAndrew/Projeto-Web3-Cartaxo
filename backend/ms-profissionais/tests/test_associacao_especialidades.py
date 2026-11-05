"""Associação entre profissionais e especialidades (N:N)."""

import pytest


def nomes_especialidades(profissional: dict) -> set[str]:
    return {e["nome"] for e in profissional["especialidades"]}


@pytest.fixture
def especialidades(criar_especialidade) -> dict[str, dict]:
    return {
        nome: criar_especialidade(nome)
        for nome in ("Fonoaudiologia", "Fisioterapia", "Psicologia")
    }


class TestAssociacaoNoCadastro:
    def test_cadastra_profissional_ja_com_especialidades(self, client, especialidades):
        resp = client.post(
            "/profissionais",
            json={
                "nome": "Ana",
                "documento_registro": "CRFa-1",
                "especialidade_ids": [especialidades["Fonoaudiologia"]["id"], especialidades["Psicologia"]["id"]],
            },
        )

        assert resp.status_code == 201
        assert nomes_especialidades(resp.json()) == {"Fonoaudiologia", "Psicologia"}

    def test_ids_repetidos_no_cadastro_geram_um_unico_vinculo(self, client, especialidades):
        fono = especialidades["Fonoaudiologia"]["id"]

        resp = client.post(
            "/profissionais",
            json={"nome": "Ana", "documento_registro": "CRFa-1", "especialidade_ids": [fono, fono]},
        )

        assert resp.status_code == 201
        assert len(resp.json()["especialidades"]) == 1

    def test_especialidade_inexistente_impede_o_cadastro(self, client, especialidades):
        resp = client.post(
            "/profissionais",
            json={
                "nome": "Ana",
                "documento_registro": "CRFa-1",
                "especialidade_ids": [especialidades["Fisioterapia"]["id"], 998, 999],
            },
        )

        assert resp.status_code == 404
        assert "[998, 999]" in resp.json()["detail"]
        assert client.get("/profissionais").json() == []


class TestAssociarEDesassociar:
    def test_associa_multiplas_especialidades(self, client, criar_profissional, especialidades):
        p = criar_profissional()
        ids = [especialidades["Fonoaudiologia"]["id"], especialidades["Fisioterapia"]["id"]]

        resp = client.post(f"/profissionais/{p['id']}/especialidades", json={"especialidade_ids": ids})

        assert resp.status_code == 200
        assert nomes_especialidades(resp.json()) == {"Fonoaudiologia", "Fisioterapia"}
        # A associação é persistida
        persistido = client.get(f"/profissionais/{p['id']}").json()
        assert nomes_especialidades(persistido) == {"Fonoaudiologia", "Fisioterapia"}

    def test_associacao_e_cumulativa_e_idempotente(self, client, criar_profissional, especialidades):
        fono, fisio = especialidades["Fonoaudiologia"]["id"], especialidades["Fisioterapia"]["id"]
        p = criar_profissional(especialidade_ids=[fono])

        resp = client.post(f"/profissionais/{p['id']}/especialidades", json={"especialidade_ids": [fono, fisio]})

        assert resp.status_code == 200
        assert len(resp.json()["especialidades"]) == 2

    def test_desassocia_apenas_as_especialidades_indicadas(self, client, criar_profissional, especialidades):
        ids = [e["id"] for e in especialidades.values()]
        p = criar_profissional(especialidade_ids=ids)

        resp = client.delete(
            f"/profissionais/{p['id']}/especialidades",
            params={"especialidade_ids": [especialidades["Fonoaudiologia"]["id"], especialidades["Psicologia"]["id"]]},
        )

        assert resp.status_code == 200
        assert nomes_especialidades(resp.json()) == {"Fisioterapia"}

    def test_desassociar_especialidade_nao_vinculada_e_ignorado(self, client, criar_profissional, especialidades):
        p = criar_profissional(especialidade_ids=[especialidades["Fisioterapia"]["id"]])

        resp = client.delete(
            f"/profissionais/{p['id']}/especialidades",
            params={"especialidade_ids": [especialidades["Psicologia"]["id"]]},
        )

        assert resp.status_code == 200
        assert nomes_especialidades(resp.json()) == {"Fisioterapia"}

    def test_substitui_o_conjunto_de_especialidades(self, client, criar_profissional, especialidades):
        p = criar_profissional(especialidade_ids=[especialidades["Fonoaudiologia"]["id"]])

        resp = client.put(
            f"/profissionais/{p['id']}/especialidades",
            json={"especialidade_ids": [especialidades["Psicologia"]["id"]]},
        )

        assert resp.status_code == 200
        assert nomes_especialidades(resp.json()) == {"Psicologia"}

    def test_especialidade_inexistente_nao_altera_vinculos(self, client, criar_profissional, especialidades):
        fono = especialidades["Fonoaudiologia"]["id"]
        p = criar_profissional(especialidade_ids=[fono])

        resp = client.post(
            f"/profissionais/{p['id']}/especialidades",
            json={"especialidade_ids": [especialidades["Fisioterapia"]["id"], 999]},
        )

        assert resp.status_code == 404
        assert nomes_especialidades(client.get(f"/profissionais/{p['id']}").json()) == {"Fonoaudiologia"}

    def test_profissional_inexistente_retorna_404(self, client, especialidades):
        resp = client.post(
            "/profissionais/999/especialidades",
            json={"especialidade_ids": [especialidades["Fonoaudiologia"]["id"]]},
        )

        assert resp.status_code == 404

    @pytest.mark.parametrize("payload", [{"especialidade_ids": []}, {}, {"especialidade_ids": ["abc"]}])
    def test_payload_invalido_retorna_422(self, client, criar_profissional, payload):
        p = criar_profissional()

        assert client.post(f"/profissionais/{p['id']}/especialidades", json=payload).status_code == 422


class TestConsistenciaDaRelacao:
    def test_filtra_profissionais_por_especialidade(self, client, criar_profissional, especialidades):
        criar_profissional("Ana", especialidade_ids=[especialidades["Fonoaudiologia"]["id"]])
        criar_profissional("Bruno", especialidade_ids=[especialidades["Fisioterapia"]["id"]])
        criar_profissional("Carla", especialidade_ids=[e["id"] for e in especialidades.values()])

        resp = client.get("/profissionais", params={"especialidade_id": especialidades["Fisioterapia"]["id"]})

        assert [p["nome"] for p in resp.json()] == ["Bruno", "Carla"]

    def test_remover_especialidade_remove_apenas_o_vinculo(self, client, criar_profissional, especialidades):
        p = criar_profissional(especialidade_ids=[especialidades["Fonoaudiologia"]["id"], especialidades["Psicologia"]["id"]])

        assert client.delete(f"/especialidades/{especialidades['Psicologia']['id']}").status_code == 204

        persistido = client.get(f"/profissionais/{p['id']}")
        assert persistido.status_code == 200
        assert nomes_especialidades(persistido.json()) == {"Fonoaudiologia"}

    def test_remover_profissional_preserva_as_especialidades(self, client, criar_profissional, especialidades):
        p = criar_profissional(especialidade_ids=[especialidades["Fonoaudiologia"]["id"]])

        assert client.delete(f"/profissionais/{p['id']}").status_code == 204

        assert len(client.get("/especialidades").json()) == 3

