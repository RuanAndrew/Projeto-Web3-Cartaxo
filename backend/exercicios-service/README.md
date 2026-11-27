# exercicios-service

Catálogo de exercícios terapêuticos, prescrições por paciente e registros de
realização (UC-08 e UC-09). O serviço **não guarda dados cadastrais**:
`paciente_id` é o id do cadastro em `pacientes-service` (`pacientes.id`).

Porta em desenvolvimento: **8009** (o container escuta 8000). Pelo gateway: `/exercicios/...`.

## Regras

- O profissional responsável é sempre o do **token**. Só ele altera ou inativa a prescrição.
- Não há exclusão: a prescrição é inativada, e o histórico de registros é preservado.
- **A marcação de realização é autodeclarada pelo paciente (UC-09).** Não há
  verificação automática de execução correta; o campo `autodeclarado` vem sempre
  `true` e o indicador deve ser lido com essa ressalva.
- `nivel_dor` é validado entre 0 e 10 (também por *constraint* no banco).

## Quem acessa

| Perfil | Acesso |
|---|---|
| `PROFISSIONAL` | cria exercícios, prescreve, altera as próprias prescrições e lê registros |
| `PACIENTE` | lê o catálogo e as próprias prescrições; registra realização só nelas |
| `ATENDENTE`, `ADMIN` | sem acesso (o nível de dor é dado de saúde) |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | saúde do serviço |
| POST / GET | `/exercicios/catalogo` | cria / lista exercícios |
| GET | `/exercicios/catalogo/{id}` | consulta um exercício |
| POST | `/exercicios/prescricoes` | prescreve a um paciente |
| GET | `/exercicios/prescricoes?paciente_id=&apenas_ativas=` | lista (profissional informa o paciente) |
| GET | `/exercicios/prescricoes/{id}` | consulta uma prescrição |
| PATCH | `/exercicios/prescricoes/{id}` | altera frequência ou inativa/reativa |
| POST / GET | `/exercicios/prescricoes/{id}/registros` | registra / lista realizações |

## Testes

    docker compose exec exercicios-service pytest -v

Usam SQLite em memória e um `pacientes-service` simulado.
