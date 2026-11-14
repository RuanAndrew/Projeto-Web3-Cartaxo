# documentos-service

Receitas, exames, laudos e anexos dos atendimentos (UC-04, UC-06, UC-07).

## Rodar
    docker compose up --build documentos-service
    # Swagger: http://localhost:8005/docs   |   MinIO: http://localhost:9001

## Migrations (Alembic)
O Dockerfile executa `alembic upgrade head` ao iniciar o container.

    # criar nova migration após alterar src/domain/models.py
    docker compose exec documentos-service alembic revision --autogenerate -m "descricao"
    # aplicar / voltar uma
    docker compose exec documentos-service alembic upgrade head
    docker compose exec documentos-service alembic downgrade -1

Revise sempre o arquivo gerado em `alembic/versions/` antes de aplicar.

## Testar
    # só unitários (não precisam de infraestrutura)
    docker compose exec documentos-service pytest -m "not integration"

    # integração: Postgres + MinIO reais, em banco/bucket próprios de teste
    docker compose exec documentos-service pytest -m integration -v

    # tudo
    docker compose exec documentos-service pytest

Os testes de integração criam o banco `documentos_test` e o bucket
`clinica-documentos-test`, aplicam as migrations do zero e removem tudo no fim.
Se o Postgres ou o MinIO não estiverem de pé, são pulados (use `-rs` para ver o motivo).

## Endpoints
| Método | Rota | Quem |
|---|---|---|
| GET | /health | público |
| POST | /documentos | profissional (multipart) |
| GET | /documentos/paciente/{id} | profissional ou o próprio paciente (só liberados) |
| POST | /documentos/{id}/liberar | profissional |
| GET | /documentos/{id}/url | URL assinada de curta duração |
| DELETE | /documentos/{id} | profissional (exclusão lógica) |
