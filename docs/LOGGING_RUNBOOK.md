# Runbook de logging

## Variaveis de ambiente
- `LOG_LEVEL`: `debug|info|warn|error|success` (padrao: `debug` em dev e `info` em prod).
- `LOG_DESTINATION`: `console|file|both` (padrao: `both`).
- `LOG_SAMPLE_RATE`: percentual entre `0` e `1` (padrao: `1`).
- `LOG_INCLUDE_STACK`: inclui stacktrace (`true` recomendado apenas para dev/staging).
- `LOG_INCLUDE_RUNTIME_METRICS`: inclui metricas de runtime por evento (desligado por padrao).
- `SERVICE_NAME`: nome do servico no log estruturado.

## Politica de niveis
- `debug`: apenas diagnostico temporario.
- `info`: eventos de negocio e infraestrutura esperados.
- `warn`: anomalias recuperaveis e respostas 4xx relevantes.
- `error`: falhas operacionais e erros 5xx.

## Seguranca
- Nunca registrar credenciais, tokens, cookies, CPF/CNPJ em texto puro.
- Sanitizacao automatica aplica `[REDACTED]` para chaves sensiveis.
- Em PRs, validar diff para evitar vazamento de payload sensivel.

## Operacao
- Rodar validacao de governanca: `npm run check:logs`.
- Rodar testes do logger/redaction: `npm test -- logger.test.ts`.
- Se precisar elevar verbosidade em incidente, usar `LOG_LEVEL=debug` com janela curta e rollback planejado.

## Checklist de PR
- Uso de `logger.*` no lugar de `console.*` no codigo de aplicacao.
- Nenhum token/senha/cookie em logs.
- Eventos com contexto (`context`) e dados minimizados.
- Mudancas com teste de redaction quando aplicavel.
