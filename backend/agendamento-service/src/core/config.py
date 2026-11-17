import os
from pydantic import BaseModel


class Settings(BaseModel):
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://agendamento_user:agendamento_pass@localhost:5434/agendamento_db",
    )
    sqlalchemy_echo: bool = os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true"
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY", "changeme-super-secret")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")


settings = Settings()