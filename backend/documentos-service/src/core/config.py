from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://documentos_user:changeme@localhost:5437/documentos_db"

    jwt_secret_key: str = "changeme-super-secret"
    jwt_algorithm: str = "HS256"

    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "sa-east-1"
    aws_s3_bucket: str = "clinica-documentos"
    # Em dev, aponte para o MinIO (ex.: http://minio:9000). Vazio = AWS S3 real.
    s3_endpoint_url: str = ""
    # Endpoint acessível pelo navegador, usado nas URLs assinadas (ex.: http://localhost:9000)
    s3_public_endpoint_url: str = ""

    url_assinada_expira_segundos: int = 120
    tamanho_maximo_bytes: int = 10 * 1024 * 1024


settings = Settings()
