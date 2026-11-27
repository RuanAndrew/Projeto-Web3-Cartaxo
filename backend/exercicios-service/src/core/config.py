from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+asyncpg://exercicios_user:exercicios_pass@localhost:5441/exercicios_db"
    )

    jwt_secret_key: str = "changeme-super-secret"
    jwt_algorithm: str = "HS256"

    # O servico nao guarda dados do paciente: consulta o pacientes-service.
    pacientes_service_url: str = "http://pacientes-service:8000"
    pacientes_timeout_segundos: float = 5.0


settings = Settings()
