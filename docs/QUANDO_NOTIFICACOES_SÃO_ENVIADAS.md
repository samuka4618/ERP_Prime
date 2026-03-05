# 📱 Quando o Sistema Envia Notificações Push

Este documento lista todas as ocasiões em que o sistema envia notificações push para dispositivos móveis.

---

## 🎫 **Notificações de Chamados (Tickets)**

### 1. **Novo Chamado Criado** 
- **Quando:** Um usuário cria um novo chamado
- **Quem recebe:**
  - ✅ Todos os **administradores**
  - ✅ Todos os **atendentes** (apenas se prioridade for `urgent` ou `high`)
- **Tipo:** `new_message`
- **Mensagem:** "Novo Chamado Criado: [assunto do chamado]"

---

### 2. **Status do Chamado Alterado**
- **Quando:** O status de um chamado é alterado (ex: Aberto → Em Atendimento)
- **Quem recebe:**
  - ✅ O **usuário que criou o chamado** (solicitante)
- **Tipo:** `status_change`
- **Mensagem:** "O status do seu chamado '[assunto]' foi alterado de '[status anterior]' para '[novo status]'."

**Status possíveis:**
- Aberto
- Em Atendimento
- Pendente Usuário
- Pendente Terceiros
- Aguardando Aprovação do Solicitante
- Resolvido
- Fechado
- Atrasado - Primeira Resposta
- Atrasado - Resolução

---

### 3. **Nova Mensagem no Chat**
- **Quando:** Alguém envia uma mensagem no chat do chamado
- **Quem recebe:**
  - ✅ Se o **solicitante** enviou → notifica o **atendente** atribuído
  - ✅ Se o **atendente** enviou → notifica o **solicitante**
- **Tipo:** `new_message`
- **Mensagem:** "Há uma nova mensagem no chamado '[assunto]'."

---

### 4. **Chamado Reaberto**
- **Quando:** Um chamado fechado é reaberto pelo usuário
- **Quem recebe:**
  - ✅ O **atendente** atribuído ao chamado (se houver)
  - ✅ Todos os **administradores**
- **Tipo:** `ticket_reopened`
- **Mensagem:** "O chamado '[assunto]' foi reaberto pelo usuário."

---

### 5. **Alerta de SLA (Service Level Agreement)**
- **Quando:** Um chamado está próximo de violar o SLA
- **Quem recebe:**
  - ✅ O **atendente** atribuído (se houver)
  - ✅ Todos os **administradores**
- **Tipo:** `sla_alert`
- **Mensagem:** "O chamado '[assunto]' está próximo de violar o SLA de [primeira resposta/resolução]."

**Tipos de SLA:**
- **Primeira Resposta:** Quando o chamado está aberto e o tempo de primeira resposta está se esgotando
- **Resolução:** Quando o chamado está em atendimento e o tempo de resolução está se esgotando

---

### 6. **Chamado Finalizado - Aguardando Aprovação**
- **Quando:** Um atendente finaliza um chamado e solicita aprovação do solicitante
- **Quem recebe:**
  - ✅ O **solicitante** (usuário que criou o chamado)
- **Tipo:** `status_change`
- **Mensagem:** "Seu chamado '[assunto]' foi finalizado pelo atendente. Por favor, confirme se o problema foi realmente resolvido."

---

### 7. **Chamado Aprovado pelo Solicitante**
- **Quando:** O solicitante aprova a resolução do chamado
- **Quem recebe:**
  - ✅ O **atendente** atribuído ao chamado
- **Tipo:** `status_change`
- **Mensagem:** "O chamado '[assunto]' foi aprovado pelo solicitante - confirmado como resolvido."

---

### 8. **Chamado Rejeitado pelo Solicitante**
- **Quando:** O solicitante rejeita a resolução do chamado (problema não foi resolvido)
- **Quem recebe:**
  - ✅ O **atendente** atribuído ao chamado
- **Tipo:** `status_change`
- **Mensagem:** "O chamado '[assunto]' foi rejeitado pelo solicitante - problema ainda não resolvido."

---

## 👤 **Notificações de Cadastro de Clientes**

### 9. **Novo Cadastro de Cliente Enviado**
- **Quando:** Um usuário envia um novo cadastro de cliente para análise
- **Quem recebe:**
  - ✅ Todos os **administradores**
  - ✅ O **próprio usuário** que enviou (confirmação)
- **Tipo:** `new_message`
- **Mensagem:**
  - **Para admins:** "Um novo cadastro de cliente foi enviado e está aguardando análise."
  - **Para o usuário:** "Seu cadastro de cliente foi enviado com sucesso e está aguardando análise."

---

### 10. **Status do Cadastro Alterado**
- **Quando:** O status de um cadastro de cliente é alterado
- **Quem recebe:**
  - ✅ O **usuário** que criou o cadastro
- **Tipo:** `status_change`
- **Mensagem:** "O status do seu cadastro foi alterado de '[status anterior]' para '[novo status]'."

**Status possíveis:**
- Cadastro Enviado
- Aguardando Análise de Crédito
- Cadastro Finalizado

---

## ⚙️ **Notificações Administrativas**

### 11. **Notificações Personalizadas para Administradores**
- **Quando:** O sistema precisa notificar todos os administradores sobre algo específico
- **Quem recebe:**
  - ✅ Todos os **administradores**
- **Tipo:** Variável (definido no código)
- **Mensagem:** Personalizada

---

## 🔄 **Fluxo Completo de Notificações**

### Exemplo: Criação de Chamado até Resolução

1. **Usuário cria chamado** → Notifica admins e atendentes (se alta prioridade)
2. **Atendente atribui a si** → (sem notificação específica)
3. **Atendente envia mensagem** → Notifica o solicitante
4. **Solicitante responde** → Notifica o atendente
5. **Atendente finaliza** → Notifica o solicitante (aguardando aprovação)
6. **Solicitante aprova** → Notifica o atendente (confirmado)
   - **OU**
7. **Solicitante rejeita** → Notifica o atendente (rejeitado)
8. **Chamado reaberto** → Notifica atendente e admins

---

## 📊 **Resumo por Tipo de Notificação**

| Tipo | Descrição | Frequência |
|------|-----------|------------|
| `new_message` | Nova mensagem ou novo chamado | Alta |
| `status_change` | Mudança de status | Média |
| `sla_alert` | Alerta de SLA | Baixa (apenas quando próximo de violar) |
| `ticket_reopened` | Chamado reaberto | Baixa |

---

## ⚠️ **Observações Importantes**

1. **Notificações são enviadas em background:** O sistema não bloqueia a operação principal se a notificação falhar.

2. **Notificações também são salvas no banco:** Todas as notificações são salvas na tabela `notifications` para histórico.

3. **Emails também são enviados:** Além das push notifications, o sistema também envia emails (se configurado).

4. **Notificações são por usuário:** Cada usuário recebe apenas notificações relevantes para ele.

5. **Dispositivos físicos:** Push notifications funcionam apenas em dispositivos físicos (não em emuladores).

---

## 🔍 **Onde está Implementado**

- **Backend:** `src/modules/chamados/services/NotificationService.ts`
- **Push Notifications:** `src/modules/chamados/services/PushNotificationService.ts`
- **Chamados:** `src/modules/chamados/controllers/TicketController.ts`
- **SLA:** `src/modules/chamados/services/SlaService.ts`

---

## 📝 **Notas Técnicas**

- As notificações são enviadas de forma assíncrona (não bloqueiam a operação principal)
- Erros no envio de push notifications são logados mas não interrompem o fluxo
- O sistema tenta enviar para todos os dispositivos registrados do usuário
- Tokens inválidos são automaticamente removidos do banco de dados
