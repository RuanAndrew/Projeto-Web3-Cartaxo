import os

# URL de conexão lida do ambiente (definida no docker-compose.yml).
# O valor padrão permite rodar localmente com o banco exposto na porta 5437.
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://profissionais_user:profissionais_pass@localhost:5437/profissionais_db",
)

