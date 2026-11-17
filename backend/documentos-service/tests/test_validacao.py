from src.domain.validacao import detectar_tipo

PDF = b"%PDF-1.4\n1 0 obj\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 8


def test_detecta_pdf():
    assert detectar_tipo(PDF) == "application/pdf"


def test_detecta_pdf_com_lixo_antes_do_cabecalho():
    assert detectar_tipo(b"\n\n  " + PDF) == "application/pdf"


def test_detecta_png():
    assert detectar_tipo(PNG) == "image/png"


def test_detecta_jpeg():
    assert detectar_tipo(JPEG) == "image/jpeg"


def test_rejeita_texto_comum():
    assert detectar_tipo(b"isto nao e um pdf") is None


def test_rejeita_executavel():
    assert detectar_tipo(b"MZ\x90\x00\x03") is None


def test_rejeita_vazio():
    assert detectar_tipo(b"") is None
