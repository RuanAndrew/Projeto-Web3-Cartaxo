from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+asyncpg://auth_user:auth_pass@localhost:5433/auth_db"
    )
    redis_url: str = "redis://localhost:6379/0"
    rabbitmq_url: str = "amqp://clinica:clinica123@localhost:5672/"

    jwt_secret_key: str = "changeme-super-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    cors_origins: str = "http://localhost:5173"

    admin_email: str = "admin@clinica.dev"
    admin_senha: str = "admin123"

    profissional_email: str = "profissional@clinica.dev"
    profissional_senha: str = "prof123"

    atendente_email: str = "atendente@clinica.dev"
    atendente_senha: str = "atende123"

    paciente_email: str = "paciente@clinica.dev"
    paciente_senha: str = "paciente123"

    @property
    def origens_cors(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
