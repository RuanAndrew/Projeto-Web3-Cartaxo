
import time

import httpx

from src.core.config import settings

from tests.integration.identificadores import (
    ID_PROFISSIONAL,
    ID_PACIENTE,
    ID_OUTRO_PACIENTE,
)


PDF = (
    b"%PDF-1.4\n"
    b"1 0 obj\n"
    b"<< /Type /Catalog >>\n"
    b"endobj\n"
    b"trailer\n"
    b"<< /Root 1 0 R >>\n"
    b"%%EOF\n"
)

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


def enviar(
    client,
    headers,
    paciente_id=ID_PACIENTE,
    tipo="receita",
    titulo="Receita",
    conteudo=PDF,
    nome="receita.pdf",
    content_type="application/pdf",
):
    return client.post(
        "/documentos",
        headers=headers,
        data={
            "paciente_id": str(paciente_id),
            "tipo": tipo,
            "titulo": titulo,
        },
        files={"arquivo": (nome, conteudo, content_type)},
    )


def enviar_e_liberar(client, prof, **kwargs):
    r = enviar(client, prof, **kwargs)

    assert r.status_code == 201, r.text

    doc = r.json()

    r = client.post(
        f"/documentos/{doc['id']}/liberar",
        headers=prof,
    )

    assert r.status_code == 200, r.text

    return r.json()


# ---------- Upload ----------

def test_upload_grava_metadados_e_arquivo_no_storage(
    client, prof, bucket_teste, consulta
):
    r = enviar(client, prof)

    assert r.status_code == 201, r.text

    corpo = r.json()

    assert corpo["status"] == "pendente_liberacao"
    assert corpo["paciente_id"] == str(ID_PACIENTE)
    assert corpo["profissional_id"] == str(ID_PROFISSIONAL)
    assert corpo["tamanho_bytes"] == len(PDF)

    linha = consulta(
        "SELECT chave_s3, paciente_id FROM documentos"
    )[0]

    assert linha["paciente_id"] == ID_PACIENTE

    objeto = bucket_teste.head_object(
        Bucket=settings.aws_s3_bucket,
        Key=linha["chave_s3"],
    )

    assert objeto["ContentLength"] == len(PDF)


def test_content_type_gravado_vem_do_conteudo(client, prof):
    r = enviar(
        client,
        prof,
        conteudo=PNG,
        nome="exame.png",
        content_type="image/png",
    )

    assert r.status_code == 201, r.text
    assert r.json()["content_type"] == "image/png"


def test_arquivo_falso_e_rejeitado_sem_efeitos_colaterais(
    client, prof, consulta
):
    r = enviar(
        client,
        prof,
        conteudo=b"isto nao e um pdf",
    )

    assert r.status_code == 415

    assert consulta(
        "SELECT count(*) AS n FROM documentos"
    )[0]["n"] == 0


def test_png_declarado_como_pdf_e_rejeitado(client, prof):
    r = enviar(
        client,
        prof,
        conteudo=PNG,
        content_type="application/pdf",
    )

    assert r.status_code == 415


def test_formato_nao_permitido_e_rejeitado(client, prof):
    r = enviar(
        client,
        prof,
        conteudo=b"texto",
        nome="a.txt",
        content_type="text/plain",
    )

    assert r.status_code == 415


def test_arquivo_acima_do_limite_retorna_413(
    client, prof, monkeypatch
):
    monkeypatch.setattr(
        settings,
        "tamanho_maximo_bytes",
        50,
    )

    r = enviar(
        client,
        prof,
        conteudo=PDF + b"x" * 100,
    )

    assert r.status_code == 413


def test_paciente_nao_pode_enviar_documento(
    client, pac, consulta
):
    r = enviar(client, pac)

    assert r.status_code == 403

    assert consulta(
        "SELECT count(*) AS n FROM documentos"
    )[0]["n"] == 0


# ---------- Liberação e visibilidade ----------

def test_paciente_so_ve_documento_depois_da_liberacao(
    client, prof, pac
):
    doc = enviar(client, prof).json()

    resposta = client.get(
        f"/documentos/paciente/{ID_PACIENTE}",
        headers=pac,
    )

    assert resposta.status_code == 200
    assert resposta.json() == []

    resposta = client.get(
        f"/documentos/paciente/{ID_PACIENTE}",
        headers=prof,
    )

    assert len(resposta.json()) == 1

    r = client.post(
        f"/documentos/{doc['id']}/liberar",
        headers=prof,
    )

    assert r.status_code == 200

    lista = client.get(
        f"/documentos/paciente/{ID_PACIENTE}",
        headers=pac,
    ).json()

    assert [d["id"] for d in lista] == [doc["id"]]
    assert lista[0]["liberado_em"] is not None


def test_paciente_nao_lista_documentos_de_outro_paciente(
    client, prof, outro_pac
):
    enviar_e_liberar(
        client,
        prof,
        paciente_id=ID_PACIENTE,
    )

    r = client.get(
        f"/documentos/paciente/{ID_PACIENTE}",
        headers=outro_pac,
    )

    assert r.status_code == 403


def test_paciente_nao_pode_liberar_documento(
    client, prof, pac
):
    doc = enviar(client, prof).json()

    r = client.post(
        f"/documentos/{doc['id']}/liberar",
        headers=pac,
    )

    assert r.status_code == 403


def test_liberar_documento_inexistente_retorna_404(
    client, prof
):
    r = client.post(
        "/documentos/999/liberar",
        headers=prof,
    )

    assert r.status_code == 404


def test_filtro_por_tipo_e_ordem_mais_recente_primeiro(
    client, prof
):
    enviar(
        client,
        prof,
        tipo="receita",
        titulo="primeiro",
    )

    enviar(
        client,
        prof,
        tipo="exame",
        titulo="segundo",
    )

    todos = client.get(
        f"/documentos/paciente/{ID_PACIENTE}",
        headers=prof,
    ).json()

    assert [d["titulo"] for d in todos] == [
        "segundo",
        "primeiro",
    ]

    exames = client.get(
        f"/documentos/paciente/{ID_PACIENTE}?tipo=exame",
        headers=prof,
    ).json()

    assert [d["titulo"] for d in exames] == ["segundo"]


# ---------- URL assinada ----------

def test_paciente_nao_pede_url_de_documento_pendente(
    client, prof, pac
):
    doc = enviar(client, prof).json()

    r = client.get(
        f"/documentos/{doc['id']}/url",
        headers=pac,
    )

    assert r.status_code == 403


def test_outro_paciente_nao_pede_url_de_documento_liberado(
    client, prof, outro_pac
):
    doc = enviar_e_liberar(
        client,
        prof,
        paciente_id=ID_PACIENTE,
    )

    r = client.get(
        f"/documentos/{doc['id']}/url",
        headers=outro_pac,
    )

    assert r.status_code == 403


def test_url_inexistente_retorna_404(client, pac):
    r = client.get(
        "/documentos/999/url",
        headers=pac,
    )

    assert r.status_code == 404


def test_dono_recebe_url_que_baixa_o_arquivo(
    client, prof, pac, monkeypatch
):
    # Dentro do container, o endereço público localhost
    # não é alcançável. Utilizamos o endpoint interno.
    monkeypatch.setattr(
        settings,
        "s3_public_endpoint_url",
        settings.s3_endpoint_url,
    )

    doc = enviar_e_liberar(client, prof)

    r = client.get(
        f"/documentos/{doc['id']}/url",
        headers=pac,
    )

    assert r.status_code == 200, r.text
    assert (
        r.json()["expira_em_segundos"]
        == settings.url_assinada_expira_segundos
    )

    download = httpx.get(r.json()["url"])

    assert download.status_code == 200
    assert download.content == PDF


def test_url_assinada_expira(
    client, prof, pac, monkeypatch
):
    monkeypatch.setattr(
        settings,
        "s3_public_endpoint_url",
        settings.s3_endpoint_url,
    )

    monkeypatch.setattr(
        settings,
        "url_assinada_expira_segundos",
        1,
    )

    doc = enviar_e_liberar(client, prof)

    r = client.get(
        f"/documentos/{doc['id']}/url",
        headers=pac,
    )

    assert r.status_code == 200, r.text

    url = r.json()["url"]

    time.sleep(2.5)

    download = httpx.get(url)

    assert download.status_code in (400, 403)


# ---------- Exclusão lógica ----------

def test_exclusao_e_logica_e_preserva_registro_e_arquivo(
    client, prof, pac, bucket_teste, consulta
):
    doc = enviar_e_liberar(client, prof)

    r = client.delete(
        f"/documentos/{doc['id']}",
        headers=prof,
    )

    assert r.status_code == 204

    # O documento desaparece das listagens.
    profissional_lista = client.get(
        f"/documentos/paciente/{ID_PACIENTE}",
        headers=prof,
    )

    paciente_lista = client.get(
        f"/documentos/paciente/{ID_PACIENTE}",
        headers=pac,
    )

    assert profissional_lista.status_code == 200
    assert paciente_lista.status_code == 200

    assert profissional_lista.json() == []
    assert paciente_lista.json() == []

    # O acesso à URL assinada também é bloqueado.
    r = client.get(
        f"/documentos/{doc['id']}/url",
        headers=pac,
    )

    assert r.status_code == 404

    # O registro e o arquivo continuam preservados.
    linha = consulta(
        """
        SELECT excluido_em, excluido_por, chave_s3
        FROM documentos
        """
    )[0]

    assert linha["excluido_em"] is not None
    assert linha["excluido_por"] == ID_PROFISSIONAL

    bucket_teste.head_object(
        Bucket=settings.aws_s3_bucket,
        Key=linha["chave_s3"],
    )


def test_paciente_nao_pode_excluir_documento(
    client, prof, pac, consulta
):
    doc = enviar_e_liberar(client, prof)

    r = client.delete(
        f"/documentos/{doc['id']}",
        headers=pac,
    )

    assert r.status_code == 403

    linha = consulta(
        "SELECT excluido_em FROM documentos"
    )[0]

    assert linha["excluido_em"] is None
