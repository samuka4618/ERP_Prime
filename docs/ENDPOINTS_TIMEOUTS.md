# Endpoints e timeouts

Referência para o frontend e para configuração de proxy (nginx, Railway, etc.).

## Timeout padrão no frontend

- **10 s** para a maioria das rotas (axios default em `frontend/src/services/api.ts`).

## Rotas com timeout maior

| Endpoint / operação | Timeout no frontend | Motivo |
|---------------------|---------------------|--------|
| `PUT /api/client-registrations/:id/financial` | 60 s | Integração com Atak (autenticação e atualização). |
| `GET /api/client-registrations/:id/atak` | 30 s | Consulta ao Atak. |
| Relatórios (export, agendados) | Ver implementação | Geração de arquivos pode demorar; rotas que usam `timeout` customizado devem ser documentadas aqui. |

## Proxy / backend (timeout do proxy)

Se houver reverse proxy (nginx, Railway, Cloudflare, etc.), configurar o timeout do proxy **maior ou igual** ao timeout do frontend, para evitar que a conexão seja fechada antes da resposta do backend.

- **Rotas normais:** proxy timeout ≥ 15–30 s (frontend usa 10 s; margem evita corte em rede lenta).
- **Rotas pesadas (Atak, relatórios):** proxy timeout ≥ 60 s quando o frontend usar 60 s.

Exemplo nginx: `proxy_read_timeout 30s;` (e `proxy_connect_timeout`, `proxy_send_timeout` conforme necessidade).

## Índices no banco

Índices para `WHERE`, `ORDER BY` e FKs estão definidos em `src/core/database/schema.sql`, `schema-full.postgres.sql` e `performance_indexes.sql`. O schema inicial já cria os principais; o script `optimize.ts` aplica `performance_indexes.sql` (e VACUUM/ANALYZE no SQLite). Garantir que o ambiente tenha rodado o schema ou a otimização ao menos uma vez.
