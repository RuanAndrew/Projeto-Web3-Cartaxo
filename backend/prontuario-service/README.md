# Prontuario Service

API FastAPI responsavel por armazenar registros clinicos textuais vinculados a
um paciente. O servico nao replica os dados do paciente; `patient_id`,
`professional_id` e `appointment_id` sao referencias aos demais microsservicos.

## Execucao local

```bash
pip install .
PRONTUARIO_DATABASE_PATH=./prontuario.db uvicorn main:app --reload
```

Por padrao, o banco SQLite fica em `prontuario.db`. Em Docker Compose, o
arquivo e persistido no volume `prontuario_data` e o servico fica disponivel em
`http://localhost:8005`.

## Endpoints

- `GET /health`: verifica se o servico esta ativo.
- `POST /prontuarios`: cria um registro. `patient_id` e obrigatorio e pelo
  menos um entre `anamnesis`, `evolution`, `diagnosis` e `conduct` deve ser
  preenchido.
- `GET /prontuarios?patient_id=<uuid>`: lista os registros de um paciente.
- `GET /prontuarios/{id}`: consulta um registro.
- `PATCH /prontuarios/{id}`: atualiza parcialmente os campos do registro.

Exemplo de criacao:

```json
{
  "patient_id": "00000000-0000-0000-0000-000000000001",
  "professional_id": "00000000-0000-0000-0000-000000000002",
  "appointment_id": "00000000-0000-0000-0000-000000000003",
  "anamnesis": "Queixa principal e historico relatados pelo paciente.",
  "evolution": "Observacoes realizadas durante o atendimento.",
  "diagnosis": "Hipotese ou diagnostico registrado pelo profissional.",
  "conduct": "Conduta e orientacoes definidas para o paciente."
}
```

A documentacao interativa fica disponivel em `/docs` quando o servico estiver
em execucao.