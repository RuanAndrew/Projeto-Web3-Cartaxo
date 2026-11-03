from typing import Optional

# Assinaturas ("magic bytes") dos formatos aceitos.
_PNG = b"\x89PNG\r\n\x1a\n"
_JPEG = b"\xff\xd8\xff"
_PDF = b"%PDF-"

# A especificação do PDF tolera lixo antes do cabeçalho nos primeiros 1024 bytes.
_JANELA_PDF = 1024

TAMANHO_CABECALHO = _JANELA_PDF


def detectar_tipo(cabecalho: bytes) -> Optional[str]:
    """Identifica o formato pelo CONTEÚDO, ignorando o que o cliente declarou.

    Retorna o content-type ou None se não for PDF, PNG ou JPEG.
    A checagem confirma o formato, mas não garante que o arquivo seja
    íntegro nem livre de código malicioso."""
    if cabecalho.startswith(_PNG):
        return "image/png"
    if cabecalho.startswith(_JPEG):
        return "image/jpeg"
    if _PDF in cabecalho[:_JANELA_PDF]:
        return "application/pdf"
    return None
