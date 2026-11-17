# Microsserviço de Agendamentos (`agendamento-service`)

Responsável pelo gerenciamento de agendamentos presenciais e teleconsultas, prevenção de conflitos de horário (lock transacional), controle de status (`agendado`, `aguardando`, `concluido`, `cancelado`, `nao_compareceu`), vínculo de salas virtuais de teleconsulta e trilha de auditoria.

## Tecnologias
* **FastAPI** + **Uvicorn** (Python 3.11)
* **SQLAlchemy 2.0 (Async)** + **AsyncPG** + **PostgreSQL 15**
* **Alembic** para versionamento de schema (`UUID v4`)
* **Pytest** + **HTTPX** para testes automatizados

## Variáveis de Ambiente
| Variável | Descrição | Valor Padrão |
| :--- | :--- | :--- |
| `DATABASE_URL` | String de conexão PostgreSQL (`postgresql+asyncpg://...`) | Definida no `docker-compose.yml` |
| `JWT_SECRET_KEY` | Chave secreta compartilhada com o `auth-service` | Definida no `docker-compose.yml` |
| `JWT_ALGORITHM` | Algoritmo de assinatura do token JWT | `HS256` |

## Como Executar (Docker Compose)
Na raiz do repositório:
```bash
docker compose up -d --build agendamento-service
```
Na inicialização do container, o comando `alembic upgrade head` aplica automaticamente todas as migrações pendentes antes de subir o servidor na porta `8002` (roteado via API Gateway na porta `8000`).

## Como Executar os Testes Automatizados
```bash
docker compose exec agendamento-service pytest -v
```

## Principais Endpoints
* `GET /health` — Verificação de saúde do serviço
* `POST /agendamentos` — Cria agendamento presencial ou teleconsulta (`HTTP 201`)
* `GET /agendamentos` — Lista agendamentos filtrados pelo perfil autenticado (`PACIENTE`, `PROFISSIONAL`, `ADMIN`/`ATENDENTE`)
* `PATCH /agendamentos/{id}/remarcar` — Remarca data/hora com verificação de conflito
* `PATCH /agendamentos/{id}/teleconsulta` — Registra ou atualiza o link da sala virtual (Google Meet)
* `PATCH /agendamentos/{id}/aguardando` — Marca paciente em espera
* `PATCH /agendamentos/{id}/concluir` — Marca consulta como concluída
* `PATCH /agendamentos/{id}/nao-compareceu` — Registra ausência do paciente
* `PATCH /agendamentos/{id}/cancelar` — Cancela o agendamento
* `PATCH /agendamentos/{id}/reativar` — Reativa agendamento cancelado (equipe clínica)

## Telas do Frontend Integradas
* `frontend/src/pages/Agenda.jsx` — Gestão de agenda clínica (profissionais e atendentes), teleconsultas, conclusão, ausência (`nao_compareceu`) e cancelamento.
* `frontend/src/pages/Portal.jsx` — Área do paciente com visualização de consultas, acesso à sala de teleconsulta, agendamento, remarcação e cancelamento.