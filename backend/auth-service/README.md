# auth-service — Serviço de Autenticação e Usuários

Microsserviço responsável pela **autenticação**, pelos **perfis de acesso** e pelas
**permissões dos usuários** da clínica multiprofissional.

Porta exposta em desenvolvimento: **8001** (container escuta 8000).

## Perfis de acesso (perfis de usuário)

| Perfil | O que pode |
|---|---|
| `PACIENTE` | Marcar consultas e consultar as **próprias** informações (agendamentos, documentos liberados). |
| `PROFISSIONAL` | Marcar consultas e realizar as atividades referentes a consultas médicas (agenda, atendimento, prontuário, receitas/exames). |
| `ATENDENTE` | Marcar consultas e cadastrar pacientes. **Somente com autorização do administrador** cadastra profissionais e outros atendentes. |
| `ADMIN` | Superusuário: gerencia todos os usuários e concede/remove a permissão especial de atendentes. |

As permissões viajam **dentro do JWT** (claims de perfil e permissão), para que os
demais microsserviços validem acesso sem chamadas de rede (RNF05 do escopo).

## Status de desenvolvimento

- **Etapa 1 — Fundação**: estrutura DDD, configuração central, `/health`, Alembic (async), Redis e PostgreSQL conectados. (OK)
- **Etapa 2 — Domínio e persistência**: tabela `usuarios` (migration 0001) e seed idempotente do ADMIN. (OK)
- **Etapa 3 — Núcleo de autenticação**: `POST /auth/register` (restrito a ADMIN), `POST /auth/login` (JWT), `GET /auth/me`, `POST /auth/logout` (revogação via Redis) e `POST /auth/refresh` (rotação). (OK)
- **Etapa 4 — RBAC + integração (MÍNIMO FUNCIONAL daqui em diante)**: `/auth/validate`, rota `auth` no api-gateway (login/refresh públicos), login real no frontend com direcionamento por perfil e camada de compatibilidade de claims no documentos-service. (OK)
- Etapa 5 — Gestão de usuários com as regras de perfil do escopo.
- Etapa 6 — Recuperação/redefinição de senha (RF30).
- Etapa 7 — Eventos RabbitMQ e auditoria.
- Etapa 8 — Endurecimento (rate limit, CI, rotação de segredo).

## Estrutura (DDD/Clean Code, padrão dos demais serviços)

```
backend/auth-service/
├── alembic/            # migrações (env.py async; versões a partir da Etapa 2)
├── src/
│   ├── api/            # routers e dependências de autenticação (Etapa 3+)
│   ├── application/    # casos de uso / serviços de aplicação (Etapa 2+)
│   ├── core/           # configuração central (pydantic-settings)
│   ├── domain/         # entidades e modelos ORM (Etapa 2+)
│   ├── infrastructure/ # banco (SQLAlchemy async), cache (Redis)
│   └── main.py         # app FastAPI, lifespan, CORS e /health
├── Dockerfile
├── alembic.ini
└── requirements.txt
```

## Variáveis de ambiente

Todas já definidas no `docker-compose.yml` da raiz e no `.env` do projeto
(pydantic-settings as lê automaticamente; abaixo os valores locais de dev):

| Variável | Uso |
|---|---|
| `DATABASE_URL` | PostgreSQL (`postgresql+asyncpg://auth_user:auth_pass@auth-db:5432/auth_db` no container). |
| `REDIS_URL` | Redis central (`redis://redis:6379/0` — banco lógico 0, exclusivo do auth). |
| `RABBITMQ_URL` | Reservado para eventos (Etapa 7). |
| `JWT_SECRET_KEY` / `JWT_ALGORITHM` | Chave compartilhada com api-gateway e documentos-service. |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` / `JWT_REFRESH_TOKEN_EXPIRE_DAYS` | Vida dos tokens (Etapa 3). |

Defaults locais (sem Docker): banco `localhost:5433`, Redis `localhost:6379`, CORS `http://localhost:5173`.

## Como rodar (desenvolvimento)

Na raiz do projeto:

```bash
docker compose up -d --build auth-db rabbitmq redis auth-service
```

> O auth-service depende do auth-db, redis e rabbitmq saudáveis (`depends_on`
> com healthcheck), então o Compose já sobe as dependências necessárias.

## Como testar manualmente

```bash
# 1. Todos os containers saudáveis?
docker compose ps
# (auth-db, redis, rabbitmq e auth-service devem estar "Up" ou "healthy")

# 2. /health deve responder 200 com database=true e redis=true
curl http://localhost:8001/health

# 3. Documentação interativa da API (Swagger UI)
# abra no navegador: http://localhost:8001/docs

# 4. Verificar o banco diretamente
docker compose exec auth-db psql -U auth_user -d auth_db -c "SELECT version();"

# 5. Verificar o Redis
docker compose exec redis redis-cli ping   # PONG

# 6. Logs em tempo real
docker compose logs -f auth-service        # Ctrl+C para sair

# 7. Guardar só o auth-service (infra pode ficar de pé)
docker compose stop auth-service
```

## Endpoints da Etapa 3 (autenticação básica)

| Método | Rota | Quem usa | Descrição |
|---|---|---|---|
| `POST` | `/auth/register` | **ADMIN** (momentâneo; regras completas na Etapa 5) | Cria usuário (qualquer perfil) com hash bcrypt. |
| `POST` | `/auth/login` | público | Valida credenciais e emite **access token (JWT, claims de perfil)** + **refresh opaco** (Redis). Conta inativa → 403. |
| `GET` | `/auth/me` | autenticado | Dados do usuário do token (consulta fresca no banco). |
| `GET` | `/auth/validate` | autenticado | Introspecção do token para outros serviços (401/403 aplicam as mesmas regras). |
| `POST` | `/auth/logout` | autenticado | Revoga access (denylist por `jti`) e o refresh informado. |
| `POST` | `/auth/refresh` | com refresh token | Troca o refresh por um novo par (**uso único** — rotação). |

Todas as rotas `/auth` são expostas pelo **API Gateway** em `http://localhost:8000/auth/*`
(Fase: `login` e `refresh` são públicos no gateway; as demais exigem JWT válido).

Credenciais iniciais criadas pelo **seed** (todas de desenvolvimento; idempotente —
nascem só se ainda não existirem):

| Perfil | E-mail | Senha |
|---|---|---|
| `ADMIN` | `admin@clinica.dev` | `admin123` |
| `PROFISSIONAL` | `profissional@clinica.dev` | `prof123` |
| `ATENDENTE` | `atendente@clinica.dev` | `atende123` |
| `PACIENTE` | `paciente@clinica.dev` | `paciente123` |

Sobrescreva com `ADMIN_EMAIL`/`ADMIN_SENHA`, `PROFISSIONAL_EMAIL`/`PROFISSIONAL_SENHA`,
`ATENDENTE_EMAIL`/`ATENDENTE_SENHA` e `PACIENTE_EMAIL`/`PACIENTE_SENHA` no `.env`
da raiz antes de trocar de ambiente.

## Terceirização de responsabilidades
- O **schema do banco** será gerenciado pelo Alembic a partir da Etapa 2
  (`alembic upgrade head`), não com `create_all`.
- A **validação local de JWT** no api-gateway e documentos-service já usa o
  mesmo `JWT_SECRET_KEY`; nenhum desses serviços precisa mudar para aceitar
  os tokens que este serviço passará a emitir.
