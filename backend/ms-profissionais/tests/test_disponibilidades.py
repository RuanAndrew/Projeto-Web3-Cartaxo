"""Cenários de erro no cadastro/atualização de disponibilidades (UC07)."""

from datetime import time

import pytest
from sqlalchemy.exc import IntegrityError

from src.domain.models import DiaSemana, Disponibilidade


def horario(dia: str, inicio: str, fim: str) -> dict:
    return {"dia_semana": dia, "horario_inicio": inicio, "horario_fim": fim}


@pytest.fixture
def profissional(criar_profissional) -> dict:
    return criar_profissional("Ana")


@pytest.fixture
def url(profissional) -> str:
    return f"/profissionais/{profissional['id']}/disponibilidades"


@pytest.fixture
def com_segunda_8_12(client, url) -> dict:
    resp = client.post(url, json=horario("SEGUNDA", "08:00", "12:00"))
    assert resp.status_code == 201
    return resp.json()


def test_cadastro_valido_serve_de_referencia(client, url, profissional):
    resp = client.post(url, json=horario("SEGUNDA", "08:00", "12:00"))

    assert resp.status_code == 201
    assert resp.json() | {"id": 0} == {
        "id": 0,
        "profissional_id": profissional["id"],
        "dia_semana": "SEGUNDA",
        "horario_inicio": "08:00:00",
        "horario_fim": "12:00:00",
    }


class TestDadosInvalidos:
    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param(horario("SEGUNDA", "10:00", "10:00"), id="fim-igual-ao-inicio"),
            pytest.param(horario("SEGUNDA", "14:00", "09:00"), id="fim-antes-do-inicio"),
            pytest.param(horario("SEGUNDA", "23:00", "01:00"), id="atravessa-meia-noite"),
            pytest.param(horario("FERIADO", "08:00", "09:00"), id="dia-inexistente"),
            pytest.param(horario("segunda", "08:00", "09:00"), id="dia-minusculo"),
            pytest.param(horario("SEGUNDA", "25:00", "26:00"), id="hora-fora-do-intervalo"),
            pytest.param(horario("SEGUNDA", "8h", "12h"), id="formato-de-hora-invalido"),
            pytest.param(horario("SEGUNDA", "", "12:00"), id="inicio-vazio"),
            pytest.param({"dia_semana": "SEGUNDA", "horario_inicio": "08:00"}, id="sem-horario-fim"),
            pytest.param({"horario_inicio": "08:00", "horario_fim": "12:00"}, id="sem-dia"),
        ],
    )
    def test_recusa_com_422_e_nao_persiste(self, client, url, payload):
        resp = client.post(url, json=payload)

        assert resp.status_code == 422
        assert client.get(url).json() == []

    def test_mensagem_explica_intervalo_invertido(self, client, url):
        resp = client.post(url, json=horario("TERCA", "14:00", "09:00"))

        assert "horario_fim deve ser posterior a horario_inicio" in resp.text

    def test_profissional_inexistente_retorna_404(self, client):
        resp = client.post("/profissionais/999/disponibilidades", json=horario("SEGUNDA", "08:00", "12:00"))

        assert resp.status_code == 404

    def test_banco_tambem_rejeita_intervalo_invertido(self, db_session, profissional):
        """Garantia em profundidade: a CHECK constraint protege mesmo fora da API."""
        db_session.add(
            Disponibilidade(
                profissional_id=profissional["id"],
                dia_semana=DiaSemana.SEGUNDA,
                horario_inicio=time(12),
                horario_fim=time(8),
            )
        )
        with pytest.raises(IntegrityError, match="ck_disponibilidade_intervalo"):
            db_session.commit()


class TestSobreposicao:
    @pytest.mark.parametrize(
        "inicio, fim",
        [
            pytest.param("08:00", "12:00", id="identico"),
            pytest.param("09:00", "11:00", id="contido"),
            pytest.param("07:00", "13:00", id="contem"),
            pytest.param("07:00", "09:00", id="sobrepoe-inicio"),
            pytest.param("11:59", "14:00", id="sobrepoe-fim"),
        ],
    )
    def test_recusa_sobreposicao_no_mesmo_dia(self, client, url, com_segunda_8_12, inicio, fim):
        resp = client.post(url, json=horario("SEGUNDA", inicio, fim))

        assert resp.status_code == 409
        assert f"disponibilidade {com_segunda_8_12['id']}" in resp.json()["detail"]
        assert len(client.get(url).json()) == 1

    @pytest.mark.parametrize(
        "payload",
        [
            pytest.param(horario("SEGUNDA", "12:00", "14:00"), id="encostado-depois"),
            pytest.param(horario("SEGUNDA", "06:00", "08:00"), id="encostado-antes"),
            pytest.param(horario("TERCA", "08:00", "12:00"), id="mesmo-horario-outro-dia"),
        ],
    )
    def test_aceita_intervalos_sem_sobreposicao(self, client, url, com_segunda_8_12, payload):
        assert client.post(url, json=payload).status_code == 201

    def test_mesmo_horario_em_outro_profissional_e_permitido(self, client, com_segunda_8_12, criar_profissional):
        outro = criar_profissional("Bruno")

        resp = client.post(f"/profissionais/{outro['id']}/disponibilidades", json=horario("SEGUNDA", "08:00", "12:00"))

        assert resp.status_code == 201


class TestAtualizacao:
    def test_atualizar_para_intervalo_invertido_retorna_422(self, client, com_segunda_8_12):
        resp = client.put(f"/disponibilidades/{com_segunda_8_12['id']}", json=horario("SEGUNDA", "12:00", "08:00"))

        assert resp.status_code == 422

    def test_atualizar_gerando_sobreposicao_retorna_409_e_preserva_original(self, client, url, com_segunda_8_12):
        tarde = client.post(url, json=horario("SEGUNDA", "14:00", "18:00")).json()

        resp = client.put(f"/disponibilidades/{tarde['id']}", json=horario("SEGUNDA", "11:00", "18:00"))

        assert resp.status_code == 409
        assert client.get(url).json()[1]["horario_inicio"] == "14:00:00"

    def test_ajustar_o_proprio_intervalo_nao_conflita_consigo_mesmo(self, client, com_segunda_8_12):
        resp = client.put(f"/disponibilidades/{com_segunda_8_12['id']}", json=horario("SEGUNDA", "07:00", "11:00"))

        assert resp.status_code == 200
        assert resp.json()["horario_inicio"] == "07:00:00"

    def test_disponibilidade_inexistente_retorna_404(self, client):
        assert client.put("/disponibilidades/999", json=horario("SEGUNDA", "08:00", "12:00")).status_code == 404


class TestSubstituicaoDaAgenda:
    def test_sobreposicao_dentro_da_nova_agenda_retorna_409_e_mantem_a_anterior(self, client, url, com_segunda_8_12):
        resp = client.put(
            url,
            json=[horario("QUARTA", "14:00", "18:00"), horario("QUARTA", "17:00", "19:00")],
        )

        assert resp.status_code == 409
        assert [d["id"] for d in client.get(url).json()] == [com_segunda_8_12["id"]]

    def test_item_invalido_na_nova_agenda_retorna_422(self, client, url, com_segunda_8_12):
        resp = client.put(url, json=[horario("QUARTA", "14:00", "18:00"), horario("QUINTA", "10:00", "09:00")])

        assert resp.status_code == 422
        assert len(client.get(url).json()) == 1

    def test_substituicao_valida_troca_a_agenda_e_ordena(self, client, url, com_segunda_8_12):
        resp = client.put(url, json=[horario("SEXTA", "08:00", "10:00"), horario("TERCA", "13:00", "17:00")])

        assert resp.status_code == 200
        assert [d["dia_semana"] for d in resp.json()] == ["TERCA", "SEXTA"]

