# Microsserviço de pacientes

API FastAPI independente com PostgreSQL próprio. O serviço não consulta bancos de outros microsserviços; recebe `user_account_id` como UUID opaco e valida JWT localmente com a mesma chave/algoritmo configurados nos demais serviços.

## Executar localmente

Requer Python 3.11+ e PostgreSQL 15+.

```powershell
cd backend/pacientes-service
$env:DATABASE_URL = "postgresql+asyncpg://pacientes_user:pacientes_pass@localhost:5437/pacientes_db"
$env:JWT_SECRET_KEY = "changeme-super-secret"
pip install -e ".[test]"
alembic upgrade head
uvicorn src.main:app --reload --port 8005
```

Documentação interativa: `http://localhost:8005/docs`; health: `/health`.

## Executar com Docker Compose

Na raiz do repositório: `docker compose up --build pacientes-db pacientes-service api-gateway`. O PostgreSQL do serviço fica exposto na porta 5437 e a API diretamente na 8005; o gateway publica os caminhos `/api/v1/pacientes` na porta 8000. A migração Alembic é aplicada na inicialização do container.

## Autorização

Os tokens são JWT HS256 por padrão e devem incluir `sub` (UUID da conta) e `role` ou `perfil`. Perfis aceitos: `admin`/`administrador`, `recepcao`/`recepção`, `profissional`, `paciente` e `service`/`servico`/`serviço`. Listagem e cadastro são restritos à equipe; inativação exige administrador; a busca por conta exige token de serviço. O paciente só acessa o próprio cadastro e pode editar apenas contatos. Configure `JWT_SECRET_KEY` forte fora do ambiente local.

## Testes

```powershell
pip install -e ".[test]"
pytest
```
