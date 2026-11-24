from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+asyncpg://prontuario_user:prontuario_pass@localhost:5440/prontuario_db"
    )

    jwt_secret_key: str = "changeme-super-secret"
    jwt_algorithm: str = "HS256"

    # O prontuario nao guarda dados do paciente: consulta o pacientes-service.
    pacientes_service_url: str = "http://pacientes-service:8000"
    pacientes_timeout_segundos: float = 5.0


settings = Settings()
