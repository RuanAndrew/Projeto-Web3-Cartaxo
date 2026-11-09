# Guia de execução e testes

Passo a passo para quem acabou de fazer `git pull` e quer subir o sistema, rodar os testes automatizados e ver a tela "Minhas receitas" funcionando. Os comandos são para **PowerShell (Windows)**; no fim há as diferenças para Linux/macOS.

> Tempo estimado na primeira vez: 10 a 15 minutos (a maior parte é o download e a construção das imagens Docker).

---

## 0. O que você precisa ter instalado

| Ferramenta | Para quê | Como conferir |
|---|---|---|
| Git | baixar o repositório | `git --version` |
| Docker Desktop (com Compose v2) | rodar tudo | `docker compose version` |

**Não precisa** instalar Python nem Node na máquina: o backend e o frontend rodam dentro de containers. Deixe o Docker Desktop **aberto e iniciado** antes de começar.

---

## 1. Atualizar o código

```powershell
cd C:\Projects\Clinica          # a pasta onde está o docker-compose.yml
git checkout develop            # ou a branch que a equipe estiver usando
git pull
```

---

## 2. Arquivo de configuração (opcional)

O `docker-compose.yml` já traz valores padrão para desenvolvimento, então **o sistema sobe sem nenhum `.env`**. Se quiser personalizar senhas ou chaves:

```powershell
Copy-Item .env.example .env
```

O `.env` não é versionado (está no `.gitignore`). Nunca faça commit dele.

---

## 3. Subir o sistema

```powershell
docker compose up -d --build
```

Na primeira vez isso baixa imagens (Postgres, Redis, RabbitMQ, MinIO) e constrói os serviços. Pode levar vários minutos. Depois, confira:

```powershell
docker compose ps
```

Todos devem aparecer como `Up` (os bancos, o Redis e o RabbitMQ como `healthy`). Se algum aparecer como `Exited` ou `Restarting`, veja a seção **Problemas comuns**.

### Endereços

| O que | Endereço |
|---|---|
| Frontend | http://localhost:5173 |
| API Gateway (entrada do frontend) | http://localhost:8000 |
| Documentos Clínicos (Swagger) | http://localhost:8005/docs |
| Console do MinIO (arquivos) | http://localhost:9001 — usuário `minioadmin`, senha `minioadmin123` |
| RabbitMQ (painel) | http://localhost:15672 |

### Verificar se está tudo respondendo

```powershell
curl.exe http://localhost:8000/health
curl.exe http://localhost:8005/health
```

Cada um deve devolver `{"status":"ok", ...}`.

> **Atenção:** no PowerShell, `curl` é um apelido de outro comando e **não funciona** com `-H`, `-F` e `-X`. Sempre use **`curl.exe`**.

---

## 4. Rodar os testes automatizados

Os testes rodam dentro dos containers, que já estão de pé.

```powershell
# Documentos Clínicos (unitários + integração): esperado "34 passed"
docker compose exec documentos-service pytest -v

# API Gateway: esperado "12 passed"
docker compose exec api-gateway pytest -v
```

Úteis:

```powershell
# só os testes que não precisam de infraestrutura
docker compose exec documentos-service pytest -m "not integration"

# só os de integração, mostrando o motivo de qualquer teste pulado
docker compose exec documentos-service pytest -m integration -v -rs
```

Os testes de integração usam um **banco próprio** (`documentos_test`) e um **bucket próprio** (`clinica-documentos-test`), criados e apagados automaticamente. Eles **não mexem** nos seus dados de desenvolvimento.

---

## 5. Teste manual pela API (opcional, mas recomendado)

### 5.1. Criar a função que gera tokens de teste

Ainda não existe login real (o `auth-service` está vazio). Por isso o sistema aceita um token JWT gerado com a chave do ambiente. Cole esta função no PowerShell (ela vale só para a janela atual):

```powershell
function Novo-Token($id, $papel) {
  (docker compose exec -T documentos-service python -c "import time; from jose import jwt; from src.core.config import settings; print(jwt.encode({'sub':'$id','role':'$papel','exp':int(time.time())+7*86400}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm))" | Out-String).Trim()
}

$PROF = Novo-Token 10 profissional   # profissional de saúde (id 10)
$PAC  = Novo-Token 1  paciente       # paciente de id 1
```

Os tokens duram 7 dias. **Regra importante:** o paciente só enxerga documentos cujo `paciente_id` seja igual ao id do token dele.

### 5.2. Enviar, liberar e consultar uma receita

Use **um PDF de verdade** (qualquer PDF do seu computador). O sistema confere o conteúdo do arquivo e rejeita arquivos que só fingem ser PDF.

```powershell
# 1. Profissional envia a receita para o paciente 1
curl.exe -X POST http://localhost:8000/documentos `
  -H "Authorization: Bearer $PROF" `
  -F "paciente_id=1" -F "tipo=receita" -F "titulo=Minha receita" `
  -F "arquivo=@C:\caminho\do\arquivo.pdf;type=application/pdf"
# anote o "id" da resposta (ex.: 1)

# 2. O paciente ainda NÃO vê nada (documento pendente de liberação)
curl.exe http://localhost:8000/documentos/paciente/1 -H "Authorization: Bearer $PAC"
# esperado: []

# 3. Profissional libera (troque 1 pelo id do passo 1)
curl.exe -X POST http://localhost:8000/documentos/1/liberar -H "Authorization: Bearer $PROF"

# 4. Agora o paciente vê, e pode pedir o link temporário do arquivo
curl.exe http://localhost:8000/documentos/paciente/1 -H "Authorization: Bearer $PAC"
curl.exe http://localhost:8000/documentos/1/url -H "Authorization: Bearer $PAC"
```

O link do passo 4 abre o PDF no navegador e **expira em 2 minutos**.

---

## 6. Ver a tela "Minhas receitas" no navegador

A tela precisa de um token de paciente. Em desenvolvimento ele vem de um arquivo local.

1. Gere o token (use o **mesmo id** do `paciente_id` da receita, no exemplo, 1) e copie:

   ```powershell
   Novo-Token 1 paciente | Set-Clipboard
   ```

2. Crie o arquivo **`frontend\.env.local`** (nome exato, com o ponto no início) com **uma única linha**, sem aspas e sem espaços ao redor do `=`:

   ```
   VITE_DEV_TOKEN=cole_o_token_aqui
   ```

   > Dica: `Copy-Item frontend\.env.local.example frontend\.env.local` cria o arquivo a partir do modelo. Edite o **`.env.local`**, não o `.env.local.example`.

3. Reinicie o frontend (o Vite só lê esse arquivo ao iniciar):

   ```powershell
   docker compose restart frontend
   ```

4. Abra http://localhost:5173 (use **Ctrl+F5** para recarregar sem cache), entre como **Paciente** com qualquer e-mail e senha (o login ainda é demonstrativo) e clique em **Minhas receitas**.

5. A receita liberada deve aparecer na lista. O botão **Abrir** abre o PDF em outra aba.

**Segurança:** o `.env.local` é só para desenvolvimento, não deve ser versionado e deve conter apenas tokens de teste.

---

## 7. Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `Invoke-WebRequest: parâmetro 'X'` | usou `curl` em vez de `curl.exe` | use `curl.exe` |
| `{"detail":"Token de acesso ausente."}` | a variável `$PROF`/`$PAC` está vazia (terminal novo) | cole de novo a função e as linhas `$PROF = ...` |
| `{"detail":"Você só pode ver os seus documentos."}` (403) | o id do token é diferente do `paciente_id` consultado | gere o token com o mesmo id: `Novo-Token <id> paciente` |
| `{"detail":"Documento não encontrado."}` | usou o `paciente_id` onde devia usar o `id` do documento | o `id` do documento é o da resposta do envio |
| `415 ... não corresponde a um PDF, PNG ou JPEG válido` | arquivo não é PDF/PNG/JPEG de verdade | envie um arquivo real |
| `502 Falha ao armazenar o arquivo` | MinIO fora do ar | `docker compose ps minio`; `docker compose logs minio`; depois `docker compose up -d minio` |
| `Failed to resolve 'minio'` nos logs | container do MinIO parado | mesmo comando acima |
| Tela: "Não foi possível identificar o paciente" | o Vite não leu o token | confira o nome `.env.local`, o conteúdo (uma linha) e rode `docker compose restart frontend` |
| Tela: "Sua sessão expirou ou é inválida" | token expirado ou assinado com outra chave | gere um token novo (item 6) |
| Erro de CORS no console (F12) | origem do navegador diferente de `http://localhost:5173` | acesse pelo endereço exato ou ajuste `CORS_ORIGINS` do gateway |
| `port is already allocated` | outro programa usa a porta | feche-o ou mude a porta no compose (usadas: 5173, 8000–8005, 5433–5437, 6379, 5672, 15672, 9000, 9001) |

**Alternativa se o `.env.local` não funcionar:** abra a tela no navegador, aperte F12 > Console e rode `sessionStorage.setItem("clinica.token", "cole_o_token")`, depois recarregue. O token fica só naquela aba.

### Ver os logs de um serviço

```powershell
docker compose logs --tail 50 documentos-service
docker compose logs --tail 50 api-gateway
```

---

## 8. Recomeçar do zero

| Objetivo | Comando |
|---|---|
| Parar tudo, **mantendo** os dados | `docker compose down` |
| Reiniciar um serviço | `docker compose restart documentos-service` |
| Apagar só os registros de documentos | `docker compose exec documentos-db psql -U documentos_user -d documentos_db -c "TRUNCATE documentos RESTART IDENTITY"` |
| Apagar **todos** os dados de todos os bancos (só em desenvolvimento!) | `docker compose down -v` |

Os arquivos enviados ficam no MinIO e podem ser removidos pelo console (http://localhost:9001). Para limpar as variáveis do PowerShell, basta fechar a janela ou rodar `Remove-Variable PROF, PAC -ErrorAction SilentlyContinue`.

---

## 9. Depois de um novo `git pull`

```powershell
git pull
docker compose up -d --build
```

- As **migrations do banco** do `documentos-service` rodam sozinhas na inicialização (`alembic upgrade head`).
- Se alguém mudou dependências do frontend (`package.json`): `docker compose up -d --build --renew-anon-volumes frontend`.
- Rode os testes de novo (item 4) para confirmar que nada quebrou.

---

## Diferenças para Linux/macOS

- Use `curl` no lugar de `curl.exe` e `\` no lugar da crase `` ` `` para quebrar linhas.
- No lugar da função `Novo-Token`:

  ```bash
  novo_token() {
    docker compose exec -T documentos-service python -c "import time; from jose import jwt; from src.core.config import settings; print(jwt.encode({'sub':'$1','role':'$2','exp':int(time.time())+7*86400}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm))" | tr -d '\r\n'
  }
  PROF=$(novo_token 10 profissional)
  PAC=$(novo_token 1 paciente)
  ```

- Para criar o `.env.local`: `cp frontend/.env.local.example frontend/.env.local`.

---

## Checklist final

- [ ] `docker compose ps` mostra os serviços como `Up`
- [ ] `/health` do gateway (8000) e do documentos-service (8005) respondem `ok`
- [ ] `pytest` do documentos-service: **34 passed**
- [ ] `pytest` do api-gateway: **12 passed**
- [ ] A receita liberada aparece em **Minhas receitas** e o PDF abre