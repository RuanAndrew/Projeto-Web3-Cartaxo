from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    jwt_secret_key: str = "changeme-super-secret"
    jwt_algorithm: str = "HS256"

    # Um serviço por linha: para expor um novo, adicione a URL aqui e a rota em routers/proxy.py.
    documentos_service_url: str = "http://documentos-service:8000"

    # Origens do frontend permitidas pelo navegador (separadas por vírgula).
    cors_origins: str = "http://localhost:5173"

    tamanho_maximo_requisicao_bytes: int = 12 * 1024 * 1024
    timeout_segundos: float = 30.0

    @property
    def lista_cors_origins(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
