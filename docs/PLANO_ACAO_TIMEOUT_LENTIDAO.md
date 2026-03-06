# Plano de Ação: Timeout e Lentidão no Sistema

Objetivo: garantir que o sistema seja fluido e não trave para o usuário, eliminando timeouts e respostas lentas nas operações críticas.

---

## 1. Diagnóstico (o que já foi identificado)

### 1.1 Causas de timeout/lentidão

| Causa | Impacto | Exemplo |
|-------|---------|--------|
| **Notificações/emails aguardados antes de `res.json()`** | A resposta HTTP só é enviada depois de todos os emails/push; SMTP lento (1–3 s por email) multiplicado por N destinatários estoura 10 s. | `POST /tickets`, `POST /tickets/:id/messages`, fechar/reabrir chamado |
| **INSERT no PostgreSQL sem `RETURNING id`** | `lastID` fica 0, SELECT posterior falha, 500 mesmo com dado salvo. | Já corrigido em `connection-pg.ts` e em `TicketHistoryModel.create` |
| **Timeout fixo do frontend (10 s)** | Qualquer operação que demore mais que 10 s no backend resulta em “timeout exceeded” para o usuário. | `api.ts` axios `timeout: 10000` |

### 1.2 Padrão desejado

- **Resposta HTTP**: enviar assim que a operação principal (criar/atualizar/deletar) terminar.
- **Efeitos secundários** (notificações, emails, push, integrações): executar em **background** (fire-and-forget com `.catch()`), sem bloquear a resposta.

---

## 2. Checklist de Endpoints e Notificações

### 2.1 Módulo de Chamados (Tickets)

| Endpoint / Ação | Notificação atual | Bloqueia resposta? | Ação |
|-----------------|-------------------|--------------------|------|
| `POST /tickets` (criar chamado) | `notifyTicketCreated` | Não (background) | ✅ Feito |
| `POST /tickets/:id/messages` (nova mensagem) | `notifyNewMessage` | Não (background) | ✅ Feito |
| `PATCH/PUT /tickets/:id` (atualizar status) | `notifyStatusChange` | Não (background) | ✅ Feito |
| Fechar chamado | `notifyStatusChange(..., CLOSED)` | Não (background) | ✅ Feito |
| Reabrir chamado | `notifyTicketReopened` | Não (background) | ✅ Feito |
| Assumir chamado (`claimTicket`) | `createNotification` | Não (background) | ✅ Feito |
| Solicitar aprovação | `notifyApprovalRequired` | Não (background) | ✅ Feito |
| Aprovar chamado | `notifyApprovalReceived(ticketId, true)` | Não (background) | ✅ Feito |
| Rejeitar chamado | `notifyApprovalReceived(ticketId, false)` | Não (background) | ✅ Feito |

### 2.2 Módulo de Cadastros (Client Registration)

| Endpoint / Ação | Notificação atual | Bloqueia resposta? | Ação |
|-----------------|-------------------|--------------------|------|
| Criar cadastro de cliente | `notifyClientRegistrationCreated` | Não (background) | ✅ Feito |
| Atualizar status do cadastro | `notifyClientRegistrationStatusChange` | Não (background) | ✅ Feito |

### 2.3 Outros

| Módulo | Observação |
|--------|------------|
| **SLA (SlaService)** | Roda em `setInterval`; não está no caminho da requisição. OK. |
| **Descarregamento** | `notifyDriverCalled`, `notifyDriverReleased` já em background. OK. |
| **AuthController.resetPassword** | Se enviar email síncrono, considerar background. Verificar. |

---

## 3. Plano de Implementação (ordem sugerida)

### Fase 1 – Resposta rápida (notificações em background) ✅ CONCLUÍDA

1. **TicketController** ✅
   - addMessage, close, reopen, update (status), claimTicket, requestApproval, approveTicket, rejectTicket: notificações em background.

2. **ClientRegistrationController** ✅
   - create: `notifyClientRegistrationCreated` em background.
   - updateStatus: `notifyClientRegistrationStatusChange` em background.

Padrão de código:

```ts
// Antes (bloqueia)
try {
  await NotificationService.notifyX(...);
} catch (e) { ... }
res.json(...);

// Depois (não bloqueia)
NotificationService.notifyX(...).catch((err: any) => {
  console.error('Erro ao notificar ...:', err?.message || err);
});
res.json(...);
```

### Fase 2 – Timeout e configuração no frontend

1. **Revisar timeouts no `api.ts`**
   - Manter 10 s como padrão para a maioria das rotas.
   - Rotas pesadas conhecidas (ex.: relatórios, export, integração Atak) já têm timeout maior (30 s / 60 s); documentar e manter.
   - Opcional: aumentar levemente o timeout padrão (ex.: 15 s) se a rede for lenta, evitando aumentar demais para não mascarar problemas.

2. **Documentar**
   - Ver `docs/ENDPOINTS_TIMEOUTS.md`: endpoints que podem demorar mais, timeout no front e recomendação para proxy.

### Fase 3 – Backend (opcional)

1. **Timeout no Express**
   - Se usar proxy (nginx, Railway, etc.), garantir que o timeout do proxy seja ≥ timeout do front (ex.: 15–30 s) para rotas normais.

2. **Fila de emails (futuro)**
   - Se muitos emails por ação continuarem lentos mesmo em background: considerar fila (ex.: Bull/BullMQ com Redis) para envio assíncrono e retries.

### Fase 4 – Verificação e testes

1. **Testes manuais**
   - Criar chamado → resposta < 2 s, notificações/emails podem chegar depois.
   - Enviar mensagem no chamado → resposta imediata.
   - Fechar, reabrir, solicitar aprovação, aprovar/rejeitar → resposta imediata.
   - Criar cadastro de cliente e alterar status → resposta imediata.

2. **Logs**
   - Manter os `console.error` nos `.catch()` das notificações para diagnóstico sem bloquear a resposta.

---

## 4. Resumo das alterações por arquivo

| Arquivo | Alteração |
|---------|-----------|
| `src/modules/chamados/controllers/TicketController.ts` | ✅ Todas as notificações em background. |
| `src/modules/cadastros/controllers/ClientRegistrationController.ts` | ✅ Notificações em background. |
| `frontend/src/services/api.ts` | Revisar valor do timeout padrão (manter ou subir para 15 s) e documentar exceções. |
| `docs/PLANO_ACAO_TIMEOUT_LENTIDAO.md` | Este documento; atualizar conforme itens forem concluídos. |

---

## 5. Critérios de sucesso

- Nenhuma ação do usuário (criar chamado, enviar mensagem, fechar/reabrir, aprovar/rejeitar, criar/atualizar cadastro) deve resultar em timeout de 10 s no frontend.
- Resposta da API para essas ações deve ser enviada em até ~2 s (só operação principal + persistência).
- Notificações e emails podem ser enviados depois; falhas devem ser apenas logadas, sem afetar a resposta HTTP.

---

*Documento criado em 06/03/2026. Atualizar conforme as fases forem implementadas.*
