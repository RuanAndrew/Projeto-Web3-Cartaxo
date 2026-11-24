# prontuario-service

Registros clínicos textuais (anamnese, evolução, diagnóstico e conduta) vinculados
ao paciente. O serviço **não guarda dados cadastrais**: `paciente_id` é o id do
cadastro em `pacientes-service` (`pacientes.id`).

Porta em desenvolvimento: **8008** (o container escuta 8000). Pelo gateway: `/prontuarios`.

## Regras (UC-04)

- Cada gravação é uma **versão nova**. Não existe edição destrutiva nem exclusão:
  não há rotas `PUT`, `PATCH` ou `DELETE`, e o banco recusa `UPDATE`/`DELETE`
  nas tabelas por *trigger*.
- O profissional responsável é sempre o do **token**, nunca o do corpo da requisição.
- Só o profissional responsável complementa o prontuário.

## Quem acessa

| Perfil | Acesso |
|---|---|
| `PROFISSIONAL` | abre prontuário, complementa os próprios e lê |
| `PACIENTE` | lê apenas o próprio (resolvido por `GET /api/v1/pacientes/me`) |
| `ATENDENTE`, `ADMIN` | sem acesso ao conteúdo clínico |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | saúde do serviço |
| POST | `/prontuarios` | abre prontuário (versão 1) |
| GET | `/prontuarios?paciente_id=` | lista; profissional deve informar o paciente |
| GET | `/prontuarios/{id}` | prontuário com a versão atual |
| GET | `/prontuarios/{id}/versoes` | histórico completo |
| POST | `/prontuarios/{id}/versoes` | complemento (nova versão) |

## Testes

    docker compose exec prontuario-service pytest -v

Usam SQLite em memória e um `pacientes-service` simulado. As regras de banco
(triggers, migration) só são exercitadas no PostgreSQL.
