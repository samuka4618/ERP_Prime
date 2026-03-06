# Avaliação: Boas Práticas (Desempenho, Segurança e Manutenção)

Documento de análise do ERP Prime em relação às práticas de mercado para **desempenho**, **segurança** e **manutenção**.

---

## Resumo executivo

| Dimensão      | Situação atual | Prioridade de melhoria |
|---------------|----------------|------------------------|
| **Desempenho**| Boa base; melhorias pontuais | Média |
| **Segurança** | Boa base; alguns riscos claros | Alta |
| **Manutenção**| Estrutura ok; falta testes e padrões | Alta |

---

## 1. Desempenho

### ✅ O que está bem

- **Pool de conexões**: PostgreSQL com `pg.Pool` (max 10), `idleTimeoutMillis` e `connectionTimeoutMillis` configurados.
- **Queries parametrizadas**: Uso consistente de `?` / `$1, $2...`; não há concatenação de string em SQL (protege contra SQL injection e permite planejamento de queries).
- **Resposta antes de efeitos secundários**: Notificações e e-mails em background (fire-and-forget com `.catch()`), evitando timeout no usuário.
- **Compressão**: `compression()` no Express para respostas.
- **Cache de token**: `TokenCacheService` reduz ida ao banco em toda requisição autenticada.
- **Headers de cache**: API com `Cache-Control: no-cache`; estáticos com cache longo.

### ⚠️ O que melhorar

| Item | Recomendação |
|------|--------------|
| **N+1 em listagens** | Em listas (tickets, cadastros, etc.), verificar se há loops com `findById`/consultas por item; preferir JOINs ou `WHERE id IN (...)` + mapa em memória. |
| **Índices no banco** | Garantir índices em colunas usadas em `WHERE`, `ORDER BY` e FKs (ex.: `ticket_history(ticket_id)`, `notifications(user_id)`). |
| **Payload de log** | Evitar logar `req.body` completo em toda requisição (pode conter senha, dados sensíveis); logar só método, path e, se necessário, tamanho do body. |
| **Timeout do frontend** | Manter 10–15 s como padrão; rotas pesadas (relatórios, export) já com timeout maior (30–60 s) — documentar. |

---

## 2. Segurança

### ✅ O que está bem

- **Autenticação**: JWT com verificação de assinatura; token em cookie ou header; cache de usuário por token.
- **Validação de entrada**: Joi em rotas críticas (criação/atualização de tickets, etc.); schemas com tipos e limites (max length, allowed values).
- **Proteção de rotas**: Middleware de autenticação e permissões (`requirePermission`) nas rotas.
- **Helmet**: Headers de segurança (CSP e HSTS desabilitados em dev para facilitar HTTP; em produção com HTTPS, reavaliar).
- **CORS**: Configurável por `ALLOWED_ORIGINS` em produção; `credentials: true` com origem controlada.
- **Secrets no código**: `.env` no `.gitignore`; configuração via variáveis de ambiente.
- **Tratamento de erros**: Erro centralizado; stack só em desenvolvimento; mensagens genéricas ao cliente em produção.

### 🔴 Riscos e melhorias

| Risco | Severidade | Ação recomendada |
|-------|------------|------------------|
| **JWT_SECRET com valor padrão** | Alta | Em produção, **nunca** usar fallback `'sua_chave_secreta_jwt_aqui'`. Exigir `JWT_SECRET` no arranque (ex.: `if (nodeEnv === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET obrigatório')`). |
| **Rate limiting desativado** | Média | Reativar rate limit em produção (global e por rota sensível: login, recuperação de senha, upload). Ex.: `express-rate-limit` com janela (100 req/15 min) e mais restritivo em `/auth/login`. |
| **Log de body com senha** | Média | Não logar `body` em `POST /auth/login` (e rotas de registro/troca de senha). No logger, excluir campos como `password`, `token`, `currentPassword`. |
| **Rotas de diagnóstico em produção** | Baixa | `/test-images` e `/api/test-connection` expõem caminhos e IPs. Restringir a `NODE_ENV !== 'production'` ou proteger por IP/API key. |
| **HSTS/CSP desabilitados** | Baixa (em dev) | Em produção com HTTPS, reativar HSTS (e CSP se possível) no Helmet. |

---

## 3. Manutenção

### ✅ O que está bem

- **Estrutura em módulos**: Separação por domínio (chamados, cadastros, compras, descarregamento, core).
- **TypeScript**: Tipagem e contratos mais claros.
- **Error handler centralizado**: `asyncHandler` + middleware de erro; erros operacionais vs. 500 tratados.
- **Config centralizada**: `config/database.ts` com variáveis de ambiente e fallbacks (exceto JWT em produção).
- **Documentação de plano**: `PLANO_ACAO_TIMEOUT_LENTIDAO.md` e este documento ajudam onboarding e evolução.

### ⚠️ O que melhorar

| Item | Recomendação |
|------|--------------|
| **Testes automatizados** | Não há `*.test.ts`; priorizar testes de integração para rotas críticas (login, criar chamado, criar mensagem, permissões) e unitários para serviços de negócio (ex.: NotificationService, validações). |
| **Handling de rejeições em background** | Promises em background (notificações) usam `.catch()` e log; adicionar `process.on('unhandledRejection', ...)` no bootstrap para logar e evitar encerramento silencioso do processo. |
| **Padrão de resposta da API** | Padronizar formato (ex.: `{ data?, error?, message? }`) e códigos HTTP em todos os endpoints para facilitar consumo no front e documentação. |
| **Remoção de logs de debug** | Reduzir `console.log` de debug (ex.: "DEBUG CREATE TICKET", "DEBUG - Criando mensagem") em produção; usar logger com nível (debug só em desenvolvimento). |
| **Fila para e-mails** | Para escalar, considerar fila (ex.: Bull + Redis) para envio de e-mails em background, com retry e dead-letter. |

---

## 4. Checklist de ações prioritárias

### Segurança (curto prazo)

- [x] Exigir `JWT_SECRET` em produção (falhar o startup se ausente).
- [x] Não logar `password` (e campos sensíveis) no logger de requisições; excluir em `POST /auth/*`.
- [x] Reativar rate limiting em produção (global + login).

### Desempenho / Estabilidade

- [x] Garantir que todas as promises em background tenham `.catch()` (já feito nas notificações).
- [x] Registrar `unhandledRejection` (e opcionalmente `uncaughtException`) no `server.ts` para log e monitoramento.

### Manutenção (médio prazo)

- [x] Introduzir testes (pelo menos integração para rotas de auth e tickets).
- [x] Reduzir logs de debug em produção (nível de log por ambiente).
- [x] Restringir ou proteger rotas de diagnóstico em produção.

---

## 5. Referências rápidas

- **OWASP Top 10**: Validação de entrada, autenticação, secrets (evitar default de JWT_SECRET).
- **Node.js**: Uso de pool de conexões, não bloquear event loop (I/O assíncrono, background jobs).
- **Express**: Helmet, CORS, rate limit, central error handler, validação antes do controller.

---

*Documento criado em 06/03/2026. Revisar periodicamente conforme mudanças no sistema.*
