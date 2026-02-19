# Documentação da API - Sistema de Chamados Financeiro

**Versão da API:** 1.0.0  
**Base URL:** `http://localhost:3000/api`  
**Formato de Dados:** JSON  
**Autenticação:** JWT Bearer Token

---

## Índice

1. [Introdução](#introdução)
2. [Autenticação](#autenticação)
3. [Endpoints de Autenticação](#endpoints-de-autenticação)
4. [Endpoints de Usuários](#endpoints-de-usuários)
5. [Endpoints de Chamados](#endpoints-de-chamados)
6. [Endpoints de Categorias](#endpoints-de-categorias)
7. [Endpoints de Dashboard](#endpoints-de-dashboard)
8. [Endpoints de Notificações](#endpoints-de-notificações)
9. [Endpoints de Anexos](#endpoints-de-anexos)
10. [Endpoints de Relatórios](#endpoints-de-relatórios)
11. [Endpoints de Cadastros de Clientes](#endpoints-de-cadastros-de-clientes)
12. [Endpoints de Configuração](#endpoints-de-configuração)
13. [Endpoints de Métricas e Performance](#endpoints-de-métricas-e-performance)
14. [Endpoints de Tempo Real](#endpoints-de-tempo-real)
15. [Códigos de Status HTTP](#códigos-de-status-http)
16. [Tratamento de Erros](#tratamento-de-erros)
17. [Rate Limiting](#rate-limiting)
18. [WebSocket](#websocket)

---

## Introdução

A API REST do Sistema de Chamados Financeiro permite integração completa com o sistema através de endpoints HTTP. Todas as respostas são em formato JSON e a autenticação é feita via JWT (JSON Web Token).

### Convenções

- **Base URL**: `http://localhost:3000/api`
- **Content-Type**: `application/json`
- **Autenticação**: Header `Authorization: Bearer <token>`
- **Formato de Data**: ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`)
- **Paginação**: Query parameters `page` e `limit`

### Estrutura de Resposta Padrão

#### Sucesso

```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada com sucesso" // Opcional
}
```

#### Lista Paginada

```json
{
  "success": true,
  "data": [
    { ... },
    { ... }
  ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "total_pages": 10
}
```

#### Erro

```json
{
  "success": false,
  "error": "Mensagem de erro",
  "details": { ... } // Opcional
}
```

---

## Autenticação

### Como Obter um Token

1. Faça uma requisição POST para `/api/auth/login` com email e senha
2. A resposta incluirá um token JWT
3. Use este token no header `Authorization` de todas as requisições subsequentes

### Como Usar o Token

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Expiração do Token

- Tokens expiram após um período configurável (padrão: 24 horas)
- Use `/api/auth/refresh-token` para renovar o token

### Permissões por Role

- **User**: Apenas seus próprios recursos
- **Attendant**: Recursos atribuídos + operações de atendimento
- **Admin**: Acesso total ao sistema

---

## Endpoints de Autenticação

### POST /api/auth/login

Realiza login no sistema.

**Autenticação:** Não requerida

**Request Body:**
```json
{
  "email": "usuario@example.com",
  "password": "senha123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "João Silva",
      "email": "usuario@example.com",
      "role": "user",
      "is_active": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response 401:**
```json
{
  "success": false,
  "error": "Credenciais inválidas"
}
```

---

### POST /api/auth/register

Registra um novo usuário no sistema.

**Autenticação:** Não requerida

**Request Body:**
```json
{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "senha123",
  "role": "user"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "João Silva",
    "email": "joao@example.com",
    "role": "user",
    "is_active": true
  },
  "message": "Usuário criado com sucesso"
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Email já está em uso"
}
```

---

### POST /api/auth/logout

Realiza logout, invalidando o token atual.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

---

### POST /api/auth/refresh-token

Renova o token de autenticação.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

### POST /api/auth/change-password

Altera a senha do usuário logado.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "currentPassword": "senhaAntiga123",
  "newPassword": "senhaNova456"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Senha alterada com sucesso"
}
```

---

### GET /api/auth/profile

Retorna os dados do perfil do usuário logado.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "João Silva",
    "email": "joao@example.com",
    "role": "user",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### PUT /api/auth/profile

Atualiza os dados do perfil do usuário logado.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "name": "João Silva Santos",
  "email": "joao.novo@example.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "João Silva Santos",
    "email": "joao.novo@example.com",
    "role": "user",
    "is_active": true
  }
}
```

---

## Endpoints de Usuários

> **Nota:** Todos os endpoints de usuários requerem role `admin`.

### POST /api/users

Cria um novo usuário.

**Autenticação:** Requerida (Admin)

**Request Body:**
```json
{
  "name": "Maria Santos",
  "email": "maria@example.com",
  "password": "senha123",
  "role": "attendant",
  "is_active": true
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Maria Santos",
    "email": "maria@example.com",
    "role": "attendant",
    "is_active": true
  }
}
```

---

### GET /api/users

Lista todos os usuários com paginação.

**Autenticação:** Requerida (Admin)

**Query Parameters:**
- `page` (number, opcional): Número da página (padrão: 1)
- `limit` (number, opcional): Itens por página (padrão: 10)
- `search` (string, opcional): Busca por nome ou email
- `role` (string, opcional): Filtrar por role (user, attendant, admin)
- `is_active` (boolean, opcional): Filtrar por status ativo

**Exemplo:**
```
GET /api/users?page=1&limit=10&search=joao&role=user
```

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "João Silva",
      "email": "joao@example.com",
      "role": "user",
      "is_active": true
    }
  ],
  "total": 50,
  "page": 1,
  "limit": 10,
  "total_pages": 5
}
```

---

### GET /api/users/:id

Retorna detalhes de um usuário específico.

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "João Silva",
    "email": "joao@example.com",
    "role": "user",
    "is_active": true,
    "created_at": "2025-01-01T00:00:00.000Z",
    "updated_at": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### PUT /api/users/:id

Atualiza um usuário.

**Autenticação:** Requerida (Admin)

**Request Body:**
```json
{
  "name": "João Silva Santos",
  "email": "joao.novo@example.com",
  "role": "attendant",
  "is_active": true
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "João Silva Santos",
    "email": "joao.novo@example.com",
    "role": "attendant",
    "is_active": true
  }
}
```

---

### DELETE /api/users/:id

Deleta um usuário (soft delete - marca como inativo).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "message": "Usuário deletado com sucesso"
}
```

---

### GET /api/users/stats

Retorna estatísticas de usuários.

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total_users": 50,
    "active_users": 45,
    "inactive_users": 5,
    "users_by_role": {
      "user": 30,
      "attendant": 15,
      "admin": 5
    }
  }
}
```

---

## Endpoints de Chamados

### POST /api/tickets

Cria um novo chamado.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "category_id": 1,
  "subject": "Solicitação de reembolso",
  "description": "Preciso de reembolso da viagem de negócios",
  "priority": "high"
}
```

**Campos:**
- `category_id` (number, obrigatório): ID da categoria
- `subject` (string, obrigatório): Assunto do chamado
- `description` (string, obrigatório): Descrição detalhada
- `priority` (string, opcional): Prioridade (low, medium, high, urgent) - padrão: medium

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "category_id": 1,
    "subject": "Solicitação de reembolso",
    "description": "Preciso de reembolso da viagem de negócios",
    "status": "open",
    "priority": "high",
    "sla_first_response": "2025-01-15T14:00:00.000Z",
    "sla_resolution": "2025-01-16T10:00:00.000Z",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/tickets

Lista chamados com filtros e paginação.

**Autenticação:** Requerida

**Query Parameters:**
- `page` (number): Número da página
- `limit` (number): Itens por página
- `status` (string): Filtrar por status
- `category_id` (number): Filtrar por categoria
- `priority` (string): Filtrar por prioridade
- `search` (string): Busca por assunto ou descrição
- `attendant_id` (number): Filtrar por atendente (admin/attendant)
- `user_id` (number): Filtrar por usuário (admin)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subject": "Solicitação de reembolso",
      "status": "open",
      "priority": "high",
      "category": {
        "id": 1,
        "name": "Financeiro"
      },
      "user": {
        "id": 1,
        "name": "João Silva"
      },
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 10,
  "total_pages": 10
}
```

---

### GET /api/tickets/:id

Retorna detalhes completos de um chamado.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": 1,
    "attendant_id": 2,
    "category_id": 1,
    "subject": "Solicitação de reembolso",
    "description": "Preciso de reembolso da viagem de negócios",
    "status": "in_progress",
    "priority": "high",
    "sla_first_response": "2025-01-15T14:00:00.000Z",
    "sla_resolution": "2025-01-16T10:00:00.000Z",
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-01-15T11:00:00.000Z",
    "user": {
      "id": 1,
      "name": "João Silva",
      "email": "joao@example.com"
    },
    "attendant": {
      "id": 2,
      "name": "Maria Santos"
    },
    "category": {
      "id": 1,
      "name": "Financeiro",
      "description": "Assuntos financeiros"
    }
  }
}
```

---

### PUT /api/tickets/:id

Atualiza um chamado (apenas atendentes e admin).

**Autenticação:** Requerida (Attendant/Admin)

**Request Body:**
```json
{
  "status": "in_progress",
  "priority": "urgent",
  "attendantId": 2
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "in_progress",
    "priority": "urgent",
    "attendant_id": 2
  }
}
```

---

### POST /api/tickets/:id/messages

Adiciona uma mensagem ao chamado.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "message": "Vou analisar sua solicitação e retornar em breve."
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "ticket_id": 1,
    "author_id": 2,
    "message": "Vou analisar sua solicitação e retornar em breve.",
    "created_at": "2025-01-15T11:00:00.000Z",
    "author": {
      "id": 2,
      "name": "Maria Santos"
    }
  }
}
```

---

### GET /api/tickets/:id/history

Retorna o histórico completo de mensagens do chamado.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "ticket_id": 1,
      "author_id": 1,
      "message": "Preciso de reembolso da viagem de negócios",
      "created_at": "2025-01-15T10:00:00.000Z",
      "author": {
        "id": 1,
        "name": "João Silva"
      }
    },
    {
      "id": 2,
      "ticket_id": 1,
      "author_id": 2,
      "message": "Vou analisar sua solicitação",
      "created_at": "2025-01-15T11:00:00.000Z",
      "author": {
        "id": 2,
        "name": "Maria Santos"
      }
    }
  ]
}
```

---

### POST /api/tickets/:id/assign

Atribui um chamado a um atendente (admin/attendant).

**Autenticação:** Requerida (Attendant/Admin)

**Request Body:**
```json
{
  "attendant_id": 2
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "attendant_id": 2,
    "status": "in_progress"
  },
  "message": "Chamado atribuído com sucesso"
}
```

---

### POST /api/tickets/:id/claim

Atende um chamado em aberto (atendente "pega" o chamado).

**Autenticação:** Requerida (Attendant/Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "attendant_id": 2,
    "status": "in_progress"
  },
  "message": "Chamado atribuído a você"
}
```

---

### POST /api/tickets/:id/close

Fecha um chamado (attendant/admin).

**Autenticação:** Requerida (Attendant/Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "closed",
    "closed_at": "2025-01-15T12:00:00.000Z"
  },
  "message": "Chamado fechado com sucesso"
}
```

---

### POST /api/tickets/:id/reopen

Reabre um chamado fechado.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "open",
    "reopened_at": "2025-01-15T13:00:00.000Z"
  },
  "message": "Chamado reaberto com sucesso"
}
```

---

### POST /api/tickets/:id/request-approval

Solicita aprovação do solicitante (attendant/admin).

**Autenticação:** Requerida (Attendant/Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "pending_approval"
  },
  "message": "Aprovação solicitada"
}
```

---

### POST /api/tickets/:id/approve

Aprova a resolução do chamado (solicitante).

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "resolved"
  },
  "message": "Chamado aprovado"
}
```

---

### POST /api/tickets/:id/reject

Rejeita a resolução do chamado (solicitante).

**Autenticação:** Requerida

**Request Body:**
```json
{
  "message": "A solução não resolveu meu problema"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "status": "open"
  },
  "message": "Resolução rejeitada, chamado reaberto"
}
```

---

### GET /api/tickets/open/list

Lista chamados em aberto (attendant/admin).

**Autenticação:** Requerida (Attendant/Admin)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subject": "Solicitação de reembolso",
      "status": "open",
      "priority": "high",
      "category": {
        "name": "Financeiro"
      },
      "user": {
        "name": "João Silva"
      }
    }
  ]
}
```

---

### DELETE /api/tickets/:id

Deleta um chamado (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "message": "Chamado deletado com sucesso"
}
```

---

### GET /api/tickets/sla/violations

Lista chamados com violação de SLA (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "subject": "Solicitação de reembolso",
      "status": "overdue_first_response",
      "sla_first_response": "2025-01-15T14:00:00.000Z",
      "user": {
        "name": "João Silva"
      }
    }
  ]
}
```

---

## Endpoints de Categorias

### GET /api/categories/active

Lista categorias ativas (todos os usuários autenticados).

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Financeiro",
      "description": "Assuntos financeiros",
      "sla_first_response_hours": 4,
      "sla_resolution_hours": 24,
      "is_active": true
    }
  ]
}
```

---

### POST /api/categories

Cria uma nova categoria (apenas admin).

**Autenticação:** Requerida (Admin)

**Request Body:**
```json
{
  "name": "Financeiro",
  "description": "Assuntos financeiros",
  "sla_first_response_hours": 4,
  "sla_resolution_hours": 24,
  "is_active": true
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Financeiro",
    "description": "Assuntos financeiros",
    "sla_first_response_hours": 4,
    "sla_resolution_hours": 24,
    "is_active": true
  }
}
```

---

### GET /api/categories

Lista todas as categorias com paginação (apenas admin).

**Autenticação:** Requerida (Admin)

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `search` (string)
- `is_active` (boolean)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Financeiro",
      "description": "Assuntos financeiros",
      "sla_first_response_hours": 4,
      "sla_resolution_hours": 24,
      "is_active": true
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10,
  "total_pages": 1
}
```

---

### GET /api/categories/:id

Retorna detalhes de uma categoria (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Financeiro",
    "description": "Assuntos financeiros",
    "sla_first_response_hours": 4,
    "sla_resolution_hours": 24,
    "is_active": true,
    "created_at": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### PUT /api/categories/:id

Atualiza uma categoria (apenas admin).

**Autenticação:** Requerida (Admin)

**Request Body:**
```json
{
  "name": "Financeiro Atualizado",
  "description": "Nova descrição",
  "sla_first_response_hours": 2,
  "sla_resolution_hours": 12,
  "is_active": true
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Financeiro Atualizado",
    "description": "Nova descrição",
    "sla_first_response_hours": 2,
    "sla_resolution_hours": 12,
    "is_active": true
  }
}
```

---

### DELETE /api/categories/:id

Deleta uma categoria (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "message": "Categoria deletada com sucesso"
}
```

---

### GET /api/categories/stats

Retorna estatísticas das categorias (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total_categories": 10,
    "active_categories": 8,
    "categories_with_tickets": [
      {
        "category_id": 1,
        "category_name": "Financeiro",
        "total_tickets": 50,
        "open_tickets": 10,
        "resolved_tickets": 40
      }
    ]
  }
}
```

---

## Endpoints de Dashboard

### GET /api/dashboard/stats

Retorna estatísticas do dashboard.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total_tickets": 100,
    "open_tickets": 20,
    "in_progress_tickets": 15,
    "resolved_tickets": 50,
    "closed_tickets": 15,
    "avg_resolution_time": 3600,
    "sla_violations": 5,
    "tickets_by_category": [
      {
        "category_id": 1,
        "category_name": "Financeiro",
        "total_tickets": 50
      }
    ],
    "tickets_by_priority": {
      "low": 10,
      "medium": 30,
      "high": 40,
      "urgent": 20
    },
    "tickets_by_attendant": [
      {
        "attendant_id": 2,
        "attendant_name": "Maria Santos",
        "total_tickets": 30,
        "resolved_tickets": 25
      }
    ]
  }
}
```

---

### GET /api/dashboard/recent-activity

Retorna atividades recentes.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "type": "ticket_created",
      "description": "João Silva criou um chamado",
      "ticket_id": 1,
      "created_at": "2025-01-15T10:00:00.000Z"
    },
    {
      "id": 2,
      "type": "ticket_closed",
      "description": "Maria Santos fechou um chamado",
      "ticket_id": 2,
      "created_at": "2025-01-15T09:00:00.000Z"
    }
  ]
}
```

---

## Endpoints de Notificações

### GET /api/notifications

Lista notificações do usuário logado.

**Autenticação:** Requerida

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `is_read` (boolean): Filtrar por lidas/não lidas

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": 1,
      "ticket_id": 1,
      "type": "new_message",
      "title": "Nova mensagem",
      "message": "Você recebeu uma nova mensagem no chamado #1",
      "is_read": false,
      "created_at": "2025-01-15T10:00:00.000Z",
      "ticket": {
        "id": 1,
        "subject": "Solicitação de reembolso"
      }
    }
  ],
  "total": 10,
  "page": 1,
  "limit": 10
}
```

---

### GET /api/notifications/unread-count

Retorna contador de notificações não lidas.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "unread_count": 5
  }
}
```

---

### PUT /api/notifications/:id/read

Marca uma notificação como lida.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "is_read": true
  }
}
```

---

### PUT /api/notifications/mark-all-read

Marca todas as notificações como lidas.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "message": "Todas as notificações foram marcadas como lidas"
}
```

---

### DELETE /api/notifications/:id

Deleta uma notificação.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "message": "Notificação deletada com sucesso"
}
```

---

## Endpoints de Anexos

### POST /api/attachments

Faz upload de um anexo.

**Autenticação:** Requerida

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` (File): Arquivo a ser enviado
- `ticket_id` (number): ID do chamado
- `message_id` (number, opcional): ID da mensagem (se anexo de mensagem)

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "ticket_id": 1,
    "filename": "arquivo.pdf",
    "original_name": "documento.pdf",
    "mime_type": "application/pdf",
    "size": 102400,
    "path": "/uploads/arquivo.pdf",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/attachments/:id

Retorna informações de um anexo.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "ticket_id": 1,
    "filename": "arquivo.pdf",
    "original_name": "documento.pdf",
    "mime_type": "application/pdf",
    "size": 102400,
    "path": "/uploads/arquivo.pdf",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/attachments/ticket/:ticketId

Lista anexos de um chamado.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "ticket_id": 1,
      "filename": "arquivo.pdf",
      "original_name": "documento.pdf",
      "mime_type": "application/pdf",
      "size": 102400,
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### DELETE /api/attachments/:id

Deleta um anexo.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "message": "Anexo deletado com sucesso"
}
```

---

## Endpoints de Relatórios

> **Nota:** Todos os endpoints de relatórios requerem autenticação. Alguns requerem role `admin`.

### POST /api/reports

Cria um novo relatório.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "name": "Relatório de SLA",
  "description": "Análise de cumprimento de SLA",
  "type": "sla_performance",
  "parameters": {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31",
    "category_ids": [1, 2],
    "include_charts": true
  }
}
```

**Tipos de Relatório:**
- `sla_performance`
- `ticket_volume`
- `attendant_performance`
- `category_analysis`
- `tickets_by_attendant`
- `general_tickets`
- `custom`

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Relatório de SLA",
    "description": "Análise de cumprimento de SLA",
    "type": "sla_performance",
    "parameters": "{\"start_date\":\"2025-01-01\",\"end_date\":\"2025-01-31\"}",
    "created_by": 1,
    "is_active": true,
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/reports

Lista todos os relatórios.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Relatório de SLA",
      "type": "sla_performance",
      "created_by": 1,
      "is_active": true,
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### GET /api/reports/:id

Retorna detalhes de um relatório.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Relatório de SLA",
    "description": "Análise de cumprimento de SLA",
    "type": "sla_performance",
    "parameters": "{\"start_date\":\"2025-01-01\",\"end_date\":\"2025-01-31\"}",
    "created_by": 1,
    "is_active": true,
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### POST /api/reports/:id/execute

Executa um relatório.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "parameters": {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31",
    "category_ids": [1, 2]
  },
  "export_format": "excel"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "execution_id": 1,
    "status": "running",
    "message": "Relatório em processamento"
  }
}
```

---

### GET /api/reports/:id/executions

Lista execuções de um relatório.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "report_id": 1,
      "executed_by": 1,
      "status": "completed",
      "started_at": "2025-01-15T10:00:00.000Z",
      "completed_at": "2025-01-15T10:05:00.000Z"
    }
  ]
}
```

---

### GET /api/reports/executions/:executionId/result

Retorna resultado de uma execução.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "execution_id": 1,
    "status": "completed",
    "result_data": {
      "total_tickets": 100,
      "sla_violations": 5,
      "sla_rate": 95
    },
    "file_path": "/reports/report_1.xlsx"
  }
}
```

---

### GET /api/reports/executions/:executionId/export

Exporta resultado de uma execução.

**Autenticação:** Requerida

**Query Parameters:**
- `format` (string): excel, csv, json

**Response 200:**
Arquivo de download (Excel, CSV ou JSON)

---

### POST /api/reports/custom

Cria um relatório personalizado.

**Autenticação:** Requerida

**Request Body:**
```json
{
  "name": "Relatório Personalizado",
  "description": "Análise customizada",
  "type": "custom",
  "custom_fields": [
    "ticket.id",
    "ticket.subject",
    "ticket.status",
    "user.name"
  ],
  "parameters": {
    "start_date": "2025-01-01",
    "end_date": "2025-01-31"
  }
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Relatório Personalizado",
    "type": "custom",
    "custom_fields": "[\"ticket.id\",\"ticket.subject\",\"ticket.status\",\"user.name\"]"
  }
}
```

---

### GET /api/reports/custom/fields

Lista campos disponíveis para relatórios personalizados.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "ticket": [
      "id",
      "subject",
      "description",
      "status",
      "priority",
      "created_at"
    ],
    "user": [
      "id",
      "name",
      "email",
      "role"
    ],
    "category": [
      "id",
      "name",
      "description"
    ]
  }
}
```

---

## Endpoints de Cadastros de Clientes

### POST /api/client-registrations

Cria um novo cadastro de cliente.

**Autenticação:** Requerida

**Content-Type:** `multipart/form-data`

**Form Data:**
- `nome_cliente` (string): Razão social
- `nome_fantasia` (string, opcional): Nome fantasia
- `cnpj` (string): CNPJ (será normalizado automaticamente)
- `email` (string): Email do cliente
- `ramo_atividade_id` (number): ID do ramo de atividade
- `vendedor_id` (number): ID do vendedor
- `gestor_id` (number): ID do gestor
- `codigo_carteira_id` (number): ID da carteira
- `lista_preco_id` (number): ID da lista de preço
- `forma_pagamento_desejada_id` (number): ID da forma de pagamento
- `prazo_desejado` (number, opcional): Prazo em dias
- `periodicidade_pedido` (string, opcional)
- `valor_estimado_pedido` (number, opcional)
- `forma_contato` (string, opcional)
- `whatsapp_cliente` (string, opcional)
- `rede_social` (string, opcional)
- `link_google_maps` (string, opcional)
- `imagem_externa` (File): Imagem da fachada (obrigatório)
- `imagem_interna` (File): Imagem do interior (obrigatório)
- `anexos` (File[], opcional): Anexos adicionais

**Response 201:**
```json
{
  "success": true,
  "message": "Cadastro criado com sucesso",
  "data": {
    "id": 1,
    "nome_cliente": "Empresa XYZ Ltda",
    "cnpj": "12345678000190",
    "email": "contato@empresa.com",
    "status": "cadastro_enviado",
    "created_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### GET /api/client-registrations

Lista cadastros com filtros.

**Autenticação:** Requerida

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `status` (string): Filtrar por status
- `search` (string): Busca por nome ou CNPJ

**Response 200:**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "nome_cliente": "Empresa XYZ Ltda",
        "cnpj": "12345678000190",
        "email": "contato@empresa.com",
        "status": "aguardando_analise_credito",
        "created_at": "2025-01-15T10:00:00.000Z"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 10,
    "total_pages": 5
  }
}
```

---

### GET /api/client-registrations/my

Lista cadastros do usuário logado.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nome_cliente": "Empresa XYZ Ltda",
      "cnpj": "12345678000190",
      "status": "cadastro_enviado",
      "created_at": "2025-01-15T10:00:00.000Z"
    }
  ]
}
```

---

### GET /api/client-registrations/:id

Retorna detalhes de um cadastro.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome_cliente": "Empresa XYZ Ltda",
    "nome_fantasia": "XYZ",
    "cnpj": "12345678000190",
    "email": "contato@empresa.com",
    "status": "aguardando_analise_credito",
    "imagem_externa_path": "/imgCadastros/2025/01/15/externa.jpg",
    "imagem_interna_path": "/imgCadastros/2025/01/15/interna.jpg",
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-01-15T10:00:00.000Z"
  }
}
```

---

### PUT /api/client-registrations/:id

Atualiza um cadastro.

**Autenticação:** Requerida

**Content-Type:** `multipart/form-data` (imagens opcionais)

**Form Data:** (mesmos campos do POST, todos opcionais)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nome_cliente": "Empresa XYZ Ltda Atualizada",
    "updated_at": "2025-01-15T11:00:00.000Z"
  }
}
```

---

### PUT /api/client-registrations/:id/status

Atualiza status de um cadastro (apenas admin).

**Autenticação:** Requerida (Admin)

**Request Body:**
```json
{
  "status": "cadastro_finalizado",
  "feedback": "Aprovado com limite de R$ 10.000"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Status atualizado com sucesso",
  "data": {
    "id": 1,
    "status": "cadastro_finalizado"
  }
}
```

---

### PUT /api/client-registrations/:id/financial

Define condições financeiras (attendant/admin).

**Autenticação:** Requerida (Attendant/Admin)

**Request Body:**
```json
{
  "condicao_pagamento_id": 1,
  "limite_credito": 10000.00,
  "codigo_carteira": "001",
  "codigo_forma_cobranca": "001"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Dados financeiros atualizados com sucesso no sistema e no Atak",
  "data": {
    "id": 1,
    "condicao_pagamento_id": 1,
    "limite_credito": 10000.00
  }
}
```

---

### GET /api/client-registrations/:id/query-status

Retorna status da consulta de CNPJ.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "registration_id": 1,
    "cnpj": "12345678000190",
    "status": "processing",
    "current_step": "Processando análise de crédito...",
    "error_message": null,
    "created_at": "2025-01-15T10:00:00.000Z",
    "updated_at": "2025-01-15T10:05:00.000Z"
  }
}
```

**Status Possíveis:**
- `pending`: Aguardando processamento
- `processing`: Em processamento
- `completed`: Concluído
- `error`: Erro no processamento

---

### GET /api/client-registrations/queue-status

Retorna status da fila de processamento.

**Autenticação:** Requerida

**Response 200:**
```json
{
  "success": true,
  "data": {
    "queueLength": 3,
    "isProcessing": true,
    "message": "Processando... 3 item(s) na fila"
  }
}
```

---

### GET /api/client-registrations/condicoes-pagamento

Lista condições de pagamento do Atak (attendant/admin).

**Autenticação:** Requerida (Attendant/Admin)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "codigo": "001",
      "descricao": "À Vista"
    },
    {
      "id": 2,
      "codigo": "002",
      "descricao": "30 dias"
    }
  ]
}
```

---

### GET /api/client-registrations/:id/atak

Busca dados completos do cliente no Atak (attendant/admin).

**Autenticação:** Requerida (Attendant/Admin)

**Response 200:**
```json
{
  "success": true,
  "message": "Dados do Atak obtidos com sucesso",
  "data": {
    "cliente_id": 123,
    "nome": "Empresa XYZ Ltda",
    "cnpj": "12345678000190",
    "limite_credito": 10000.00,
    "condicao_pagamento": "30 dias"
  }
}
```

---

### POST /api/client-registrations/:id/reprocess

Reprocessa um cadastro com erro (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "message": "Cadastro adicionado à fila de reprocessamento com sucesso",
  "data": {
    "registration_id": 1,
    "cnpj": "12345678000190",
    "status": "pending"
  }
}
```

---

### GET /api/client-registrations/statistics

Retorna estatísticas de cadastros (apenas admin).

**Autenticação:** Requerida (Admin)

**Query Parameters:**
- `startDate` (string, opcional): Data inicial (YYYY-MM-DD)
- `endDate` (string, opcional): Data final (YYYY-MM-DD)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total": 100,
    "por_status": {
      "cadastro_enviado": 20,
      "aguardando_analise_credito": 30,
      "cadastro_finalizado": 50
    },
    "por_mes": [
      {
        "mes": "2025-01",
        "total": 50
      }
    ]
  }
}
```

---

## Endpoints de Configuração

### GET /api/system-config

Lista todas as configurações do sistema (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "key": "sla_first_response_hours",
      "value": "4",
      "description": "SLA padrão de primeira resposta (horas)"
    },
    {
      "id": 2,
      "key": "sla_resolution_hours",
      "value": "24",
      "description": "SLA padrão de resolução (horas)"
    }
  ]
}
```

---

### PUT /api/system-config/:key

Atualiza uma configuração (apenas admin).

**Autenticação:** Requerida (Admin)

**Request Body:**
```json
{
  "value": "6",
  "description": "Nova descrição"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "key": "sla_first_response_hours",
    "value": "6",
    "description": "Nova descrição"
  }
}
```

---

### GET /api/category-assignments

Lista atribuições de categoria (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "category_id": 1,
      "attendant_id": 2,
      "category": {
        "name": "Financeiro"
      },
      "attendant": {
        "name": "Maria Santos"
      }
    }
  ]
}
```

---

### POST /api/category-assignments

Cria uma atribuição de categoria (apenas admin).

**Autenticação:** Requerida (Admin)

**Request Body:**
```json
{
  "category_id": 1,
  "attendant_id": 2
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "category_id": 1,
    "attendant_id": 2
  }
}
```

---

### DELETE /api/category-assignments/:id

Remove uma atribuição de categoria (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "message": "Atribuição removida com sucesso"
}
```

---

## Endpoints de Métricas e Performance

### GET /api/admin-metrics

Retorna métricas administrativas (apenas admin).

**Autenticação:** Requerida (Admin)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "total_tickets": 1000,
    "total_users": 50,
    "total_attendants": 10,
    "sla_compliance_rate": 95.5,
    "avg_resolution_time": 3600,
    "tickets_today": 20,
    "tickets_this_week": 150,
    "tickets_this_month": 600
  }
}
```

---

### GET /api/performance/metrics

Retorna métricas de performance (apenas admin).

**Autenticação:** Requerida (Admin)

**Query Parameters:**
- `start_date` (string): Data inicial
- `end_date` (string): Data final

**Response 200:**
```json
{
  "success": true,
  "data": {
    "response_times": {
      "avg": 1200,
      "min": 300,
      "max": 3600,
      "p95": 2400,
      "p99": 3000
    },
    "throughput": {
      "requests_per_minute": 10,
      "requests_per_hour": 600
    },
    "error_rate": 0.5
  }
}
```

---

## Endpoints de Tempo Real

### WebSocket: ws://localhost:3000/ws

Conecta-se ao servidor WebSocket para receber atualizações em tempo real.

**Autenticação:** Token JWT na query string

**Exemplo de Conexão:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws?token=SEU_TOKEN_JWT');
```

**Eventos Enviados pelo Servidor:**

1. **ticket:created**
```json
{
  "event": "ticket:created",
  "data": {
    "ticket_id": 1,
    "subject": "Novo chamado",
    "user_id": 1
  }
}
```

2. **ticket:updated**
```json
{
  "event": "ticket:updated",
  "data": {
    "ticket_id": 1,
    "status": "in_progress"
  }
}
```

3. **ticket:message**
```json
{
  "event": "ticket:message",
  "data": {
    "ticket_id": 1,
    "message_id": 1,
    "author_id": 2
  }
}
```

4. **notification:new**
```json
{
  "event": "notification:new",
  "data": {
    "notification_id": 1,
    "user_id": 1,
    "type": "new_message",
    "title": "Nova mensagem"
  }
}
```

---

## Códigos de Status HTTP

| Código | Significado | Quando Usar |
|--------|------------|-------------|
| 200 | OK | Requisição bem-sucedida |
| 201 | Created | Recurso criado com sucesso |
| 204 | No Content | Requisição bem-sucedida, sem conteúdo |
| 400 | Bad Request | Dados inválidos na requisição |
| 401 | Unauthorized | Token ausente ou inválido |
| 403 | Forbidden | Sem permissão para acessar o recurso |
| 404 | Not Found | Recurso não encontrado |
| 409 | Conflict | Conflito (ex: email já existe) |
| 422 | Unprocessable Entity | Validação falhou |
| 500 | Internal Server Error | Erro interno do servidor |

---

## Tratamento de Erros

### Estrutura de Erro Padrão

```json
{
  "success": false,
  "error": "Mensagem de erro legível",
  "details": {
    "field": "email",
    "message": "Email inválido"
  }
}
```

### Erros de Validação

Quando a validação falha (código 422):

```json
{
  "success": false,
  "error": "Dados inválidos",
  "details": [
    {
      "field": "email",
      "message": "Email é obrigatório"
    },
    {
      "field": "password",
      "message": "Senha deve ter no mínimo 6 caracteres"
    }
  ]
}
```

### Erros de Autenticação

Quando o token é inválido (código 401):

```json
{
  "success": false,
  "error": "Token inválido ou expirado"
}
```

### Erros de Autorização

Quando não tem permissão (código 403):

```json
{
  "success": false,
  "error": "Acesso negado. Você não tem permissão para realizar esta ação."
}
```

---

## Rate Limiting

> **Nota:** Rate limiting está desabilitado em desenvolvimento. Em produção, configure adequadamente.

### Limites Propostos (Produção)

- **Global**: 100 requisições por minuto por IP
- **Autenticação**: 5 tentativas de login por 15 minutos
- **Upload**: 10 uploads por minuto

### Headers de Resposta

Quando o limite é atingido, a resposta inclui:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1609459200
Retry-After: 60
```

---

## WebSocket

### Conexão

```javascript
const token = 'SEU_TOKEN_JWT';
const ws = new WebSocket(`ws://localhost:3000/ws?token=${token}`);

ws.onopen = () => {
  console.log('Conectado ao WebSocket');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Evento recebido:', data.event, data.data);
};

ws.onerror = (error) => {
  console.error('Erro no WebSocket:', error);
};

ws.onclose = () => {
  console.log('Conexão WebSocket fechada');
};
```

### Eventos do Cliente

O cliente pode enviar eventos:

**ping** (para manter conexão ativa):
```json
{
  "event": "ping"
}
```

**subscribe** (para se inscrever em eventos específicos):
```json
{
  "event": "subscribe",
  "data": {
    "channels": ["tickets", "notifications"]
  }
}
```

---

## Exemplos de Uso

### Exemplo Completo: Criar e Atender um Chamado

#### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@example.com",
    "password": "senha123"
  }'
```

#### 2. Criar Chamado

```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "category_id": 1,
    "subject": "Solicitação de reembolso",
    "description": "Preciso de reembolso da viagem",
    "priority": "high"
  }'
```

#### 3. Atender Chamado (Atendente)

```bash
curl -X POST http://localhost:3000/api/tickets/1/claim \
  -H "Authorization: Bearer TOKEN_ATENDENTE"
```

#### 4. Adicionar Mensagem

```bash
curl -X POST http://localhost:3000/api/tickets/1/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_ATENDENTE" \
  -d '{
    "message": "Vou analisar sua solicitação"
  }'
```

#### 5. Fechar Chamado

```bash
curl -X POST http://localhost:3000/api/tickets/1/close \
  -H "Authorization: Bearer TOKEN_ATENDENTE"
```

---

**Última Atualização**: 2025  
**Versão da API**: 1.0.0

Para mais informações sobre o sistema, consulte `DOCUMENTACAO_SISTEMA.md`.

