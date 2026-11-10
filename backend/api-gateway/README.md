# api-gateway

Ponto único de entrada (porta 8000): valida o JWT e encaminha para os microsserviços,
mantendo o caminho original. Ex.: `GET :8000/documentos/paciente/1` -> `documentos-service`.

## Rotas
| Prefixo | Destino |
|---|---|
| `/health` | resposta do próprio gateway (público) |
| `/auth/**` | `AUTH_SERVICE_URL` — `POST /auth/login` e `POST /auth/refresh` são públicos; as demais exigem JWT |
| `/documentos/**` | `DOCUMENTOS_SERVICE_URL` |

Para expor outro serviço: adicione `<nome>_service_url` em `src/core/config.py`
e uma linha em `rotas()` (`src/routers/proxy.py`).

## Comportamento
- Sem token ou token inválido: 401 (o serviço nem é chamado). Prefixo desconhecido: 404.
- Serviço fora do ar: 502. Serviço lento (30 s): 504.
- Repassa `Authorization`, o corpo (em fluxo, sem carregar na memória) e a query string;
  gera `X-Request-ID` para rastrear a requisição entre gateway e serviço.
- CORS é tratado só no gateway (origens em `CORS_ORIGINS`).

## Testar
    docker compose exec api-gateway pytest -v
