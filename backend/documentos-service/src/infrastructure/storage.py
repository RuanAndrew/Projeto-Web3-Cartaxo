import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from src.core.config import settings


def _client(endpoint: str = ""):
    return boto3.client(
        "s3",
        region_name=settings.aws_region,
        endpoint_url=endpoint or None,
        aws_access_key_id=settings.aws_access_key_id or None,
        aws_secret_access_key=settings.aws_secret_access_key or None,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def garantir_bucket() -> None:
    """Cria o bucket automaticamente apenas em desenvolvimento (MinIO)."""
    if not settings.s3_endpoint_url:
        return
    s3 = _client(settings.s3_endpoint_url)
    try:
        s3.head_bucket(Bucket=settings.aws_s3_bucket)
    except ClientError:
        s3.create_bucket(Bucket=settings.aws_s3_bucket)


def enviar_arquivo(arquivo, chave: str, content_type: str) -> None:
    extra = {"ContentType": content_type}
    if not settings.s3_endpoint_url:  # criptografia em repouso na AWS
        extra["ServerSideEncryption"] = "AES256"
    _client(settings.s3_endpoint_url).upload_fileobj(
        arquivo, settings.aws_s3_bucket, chave, ExtraArgs=extra
    )


def gerar_url_assinada(chave: str) -> str:
    """URL de leitura com expiração curta. Nunca expor o bucket publicamente."""
    endpoint = settings.s3_public_endpoint_url or settings.s3_endpoint_url
    return _client(endpoint).generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.aws_s3_bucket, "Key": chave},
        ExpiresIn=settings.url_assinada_expira_segundos,
    )
