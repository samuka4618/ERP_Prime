# Testes manuais de verificação (timeout e fluidez)

Checklist para validar que as ações do usuário não resultam em timeout e que a resposta é enviada em até ~2 s.

## Cenários

- [ ] **Criar chamado** — Resposta < 2 s; notificações/emails podem chegar depois.
- [ ] **Enviar mensagem no chamado** — Resposta imediata; mensagem aparece na lista (ou após recarregar se o front não atualizar em tempo real).
- [ ] **Fechar chamado** — Resposta imediata.
- [ ] **Reabrir chamado** — Resposta imediata.
- [ ] **Solicitar aprovação (técnico)** — Resposta imediata.
- [ ] **Aprovar / Rejeitar chamado (solicitante)** — Resposta imediata.
- [ ] **Criar cadastro de cliente** — Resposta imediata.
- [ ] **Alterar status do cadastro** — Resposta imediata.

## Critérios de sucesso

- Nenhuma ação acima deve resultar em "timeout of 10000ms exceeded" (ou 15 s, conforme configurado) no frontend.
- Resposta da API para essas ações deve ser enviada em até ~2 s (apenas operação principal + persistência).
- Falhas no envio de notificações/emails não devem alterar o código HTTP da resposta (erros apenas logados no servidor).
