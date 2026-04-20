# Manual completo — ERP PRIME

**Versão do produto referida neste manual:** 2.x (código em `src/`, `frontend/`, `RailwaySatellite/`).  
**Última revisão estrutural:** abril de 2026.

Este manual descreve **o que o sistema faz**, **como está organizado**, **como operar e desenvolver**, e **porque** foram tomadas decisões técnicas relevantes. Complementa o [README.md](../README.md) e o [índice de documentação](./INDICE_DOCUMENTACAO.md).

---

## Índice

1. [Visão geral do produto](#1-visão-geral-do-produto)
2. [Âmbito deste repositório e código legado](#2-âmbito-deste-repositório-e-código-legado)
3. [Arquitetura de alto nível](#3-arquitetura-de-alto-nível)
4. [Mapa do repositório (pasta a pasta)](#4-mapa-do-repositório-pasta-a-pasta)
5. [Stack tecnológica e princípios de implementação](#5-stack-tecnológica-e-princípios-de-implementação)
6. [Arranque, build e scripts npm](#6-arranque-build-e-scripts-npm)
7. [Configuração e variáveis de ambiente](#7-configuração-e-variáveis-de-ambiente)
8. [Camada de dados (SQLite, PostgreSQL, migrações)](#8-camada-de-dados-sqlite-postgresql-migrações)
9. [API HTTP (`/api`) e padrões](#9-api-http-api-e-padrões)
10. [Núcleo (Core): autenticação, utilizadores, sistema, permissões, auditoria](#10-núcleo-core-autenticação-utilizadores-sistema-permissões-auditoria)
11. [Módulo Chamados](#11-módulo-chamados)
12. [Módulo Cadastros](#12-módulo-cadastros)
13. [Módulo Compras](#13-módulo-compras)
14. [Módulo Descarregamento e satélite Railway](#14-módulo-descarregamento-e-satélite-railway)
15. [Frontend React (SPA)](#15-frontend-react-spa)
16. [Serviço RailwaySatellite](#16-serviço-railwaysatellite)
17. [Segurança, CORS, limites e produção](#17-segurança-cors-limites-e-produção)
18. [Ficheiros estáticos, uploads e imagens](#18-ficheiros-estáticos-uploads-e-imagens)
19. [Deploy, PM2 e backups](#19-deploy-pm2-e-backups)
20. [Testes e qualidade](#20-testes-e-qualidade)
21. [Permissões por módulo (referência)](#21-permissões-por-módulo-referência)
22. [Glossário](#22-glossário)

---

## 1. Visão geral do produto

O **ERP PRIME** é um sistema de gestão empresarial **modular** pensado para correr numa única instalação (ou ambiente cloud) com:

- **Autenticação e gestão de utilizadores** com perfis (roles) e permissões granulares.
- **Chamados (tickets)** com categorias, anexos, SLA, notificações, relatórios e atualização em tempo real (WebSocket).
- **Cadastros de clientes** com fluxo de aprovação, configuração por cliente, análise de crédito e integrações opcionais (ex.: SQL Server, serviços externos de CNPJ conforme implementação).
- **Compras**: solicitações, orçamentos, aprovadores, compradores e anexos.
- **Descarregamento**: fornecedores de carga, docas, agendamentos, formulários públicos para motoristas, SMS (Infobip), QR e integração opcional com um **satélite** hospedado no **Railway** (Postgres dedicado, formulário público e acompanhamento por código).

**Porque modular em pastas `src/modules/*`?** Permite evoluir cada domínio de negócio com rotas, modelos e controladores isolados, mantendo o núcleo (`src/core`) estável e reutilizável.

---

## 2. Âmbito deste repositório e código legado

### Produto atual (recomendado para produção)

- **`src/`** — backend Node.js + Express + TypeScript.
- **`frontend/`** — interface React (Vite).
- **`RailwaySatellite/`** — microserviço público para descarregamento no Railway.

O `package.json` da **raiz** aponta o arranque para `src/server.ts` (dev) ou `dist/src/server.js` (produção).

### Pastas paralelas (contexto histórico / legado)

- **`tools/cadastros-legacy/`** — scripts e integrações legadas (CNPJ, Atak, etc.).

**Recomendação:** para novos desenvolvimentos e documentação operacional, tratar **`src/` + `frontend/` + `RailwaySatellite/`** como fonte de verdade.

---

## 3. Arquitetura de alto nível

```mermaid
flowchart TB
  subgraph clients [Clientes]
    Browser[Browser SPA React]
    Mobile[Apps / túneis HTTPS]
    Driver[Motorista - URL pública]
  end

  subgraph erp [ERP PRIME - mesmo host ou proxy]
    FE[frontend/dist ou Vite dev :3001]
    API[Express /api]
    WS[WebSocket /ws]
    Static[/storage /uploads /imgCadastros]
  end

  subgraph data [Dados ERP]
    SQLite[(SQLite DB_PATH)]
    PG[(PostgreSQL DATABASE_URL)]
  end

  subgraph sat [Railway Satellite - opcional]
    SatAPI[Express /internal /api/public]
    SatPG[(Postgres satélite)]
    SatWeb[web/dist - /d/:slug /t/:token]
  end

  Browser --> FE
  FE --> API
  Browser --> API
  API --> SQLite
  API --> PG
  API --> WS
  API --> Static
  API -->|push snapshot + poll submissions| SatAPI
  SatAPI --> SatPG
  Driver --> SatWeb
  SatWeb --> SatAPI
```

- O **browser** consome o React (em dev via Vite; em produção muitas vezes o mesmo host serve `frontend/dist` e `/api`).
- O **motorista** pode abrir o formulário no **domínio do satélite** (`SATELLITE_PUBLIC_URL`) em vez do ERP, reduzindo exposição do ERP à internet pública.
- O ERP **não** confia em webhooks do satélite para criar registos: o fluxo típico é **push** de configuração + **polling** de submissões (ver secção 14).

---

## 4. Mapa do repositório (pasta a pasta)

| Caminho | Função |
|---------|--------|
| **`src/server.ts`** | Entrada Express: middleware global, `/api`, estáticos, catch-all SPA, arranque de serviços (migração BD, SLA, relatórios agendados, WebSocket, poller satélite). |
| **`src/config/`** | Leitura de configuração a partir do ambiente (`database.ts`, `sqlserver.ts` para cadastros opcional). |
| **`src/core/`** | Núcleo: `auth`, `users`, `permissions`, `system` (config, performance, notificações globais), `database` (ligações, schemas SQL, migrações), `audit`, `backup`. |
| **`src/core/index.ts`** | Registo de rotas core em `apiRouter`: `/auth`, `/users`, `/system`, `/system/audit-logs`, `/performance`, `/permissions`. |
| **`src/modules/chamados/`** | Tickets, categorias, atribuições, anexos, notificações, dashboard, relatórios, métricas admin, realtime. |
| **`src/modules/cadastros/`** | Registos de clientes, configuração de cliente, análise de crédito. |
| **`src/modules/compras/`** | Solicitações, orçamentos, aprovadores, compradores, anexos. |
| **`src/modules/descarregamento/`** | Fornecedores, agendamentos, docas, formulários, respostas, templates SMS, serviços de notificação e **SatelliteSyncService** / **SatelliteInboundPoller**. |
| **`src/shared/`** | Middleware partilhado (erros, upload), utilitários (`logger`, datas, CNPJ), tipos. |
| **`src/database/migrate.ts`** | Script apontado por `npm run migrate` na raiz (verificar alinhamento com `src/core/database/migrate.ts` se ambos existirem no vosso fluxo). |
| **`frontend/`** | App React: `src/App.tsx` (rotas), `pages/`, `components/`, `contexts/`, `services/api.ts`, `hooks/`. |
| **`RailwaySatellite/`** | Serviço Node separado: `src/index.ts`, rotas `internal`, `publicApi`, UI em `web/`. |
| **`data/`** | Dados locais (ex.: ficheiro SQLite em `data/database/`). |
| **`storage/`** | Uploads, imagens, avatares (caminhos configuráveis por env). |
| **`scripts/`** | PM2, cópia de schema no build, reset BD, criação de utilizadores. |
| **`tests/`** | Testes Jest (auth, schemas, etc.). |
| **`docs/`** | Documentação Markdown (este manual, deploy, API, diagnósticos). |

---

## 5. Stack tecnológica e princípios de implementação

| Camada | Tecnologia | Notas |
|--------|------------|--------|
| Backend | Node.js, Express, TypeScript | Sem ORM Prisma; SQL via camada `dbRun` / `dbGet` / `dbAll` e ficheiros `.sql`. |
| Validação | Joi | Schemas por recurso em `modules/*/schemas`. |
| Frontend | React 18, Vite, Tailwind (onde aplicável) | Estado de auth e permissões em Context API. |
| Auth | JWT (+ cookies conforme rotas), bcrypt | `JWT_SECRET`, expiração configurável. |
| Tempo real | WebSocket (chamados) | Inicialização em `server.ts` com `initializeWebSocket`. |
| Satélite | Express + `pg` | Postgres obrigatório no satélite. |

**Porque SQL “cru” com dialect helper?** Controlo explícito de esquema, migrações versionadas em SQL e suporte dual **SQLite** (dev/simples) e **PostgreSQL** (produção) com pequenas diferenças isoladas (`sql-dialect.ts`, `connection.ts`).

**Porque Joi?** Contrato de entrada consistente nos controladores, mensagens de erro previsíveis e validação partilhável com a lógica de negócio.

---

## 6. Arranque, build e scripts npm

### Desenvolvimento típico

1. `npm run install:all` — instala raiz + `frontend/`.
2. Configurar `.env` a partir de `.env.example` (ver [CONFIGURACAO_ENV.md](./CONFIGURACAO_ENV.md)).
3. `npm run migrate` — conforme documentação do projeto para criar/atualizar tabelas.
4. `npm run dev:all` — backend (porta em `PORT`, ex. 3000) + frontend (ex. 3001).

### Builds

- `npm run build` — compila TypeScript do backend para `dist/`.
- `cd frontend && npm run build` — gera `frontend/dist`.
- `npm run build:all` — backend + frontend.

### Produção (resumo)

O servidor pode servir **`frontend/dist`** como ficheiros estáticos e usar **catch-all** para `index.html` (SPA). Ver [DEPLOY.md](./DEPLOY.md).

---

## 7. Configuração e variáveis de ambiente

Resumo dos grupos (nomes apenas; valores no vosso `.env`):

- **Servidor:** `PORT`, `NODE_ENV`, `HOST`, `PUBLIC_URL`, `ALLOWED_ORIGINS`, `DISABLE_HSTS`.
- **Base de dados ERP:** `DB_PATH`, `USE_POSTGRES`, `DATABASE_URL`.
- **JWT:** `JWT_SECRET`, `JWT_EXPIRES_IN`.
- **SMTP:** `SMTP_*`, `SMTP_FROM`.
- **Armazenamento:** `UPLOAD_PATH`, `UPLOADS_PATH`, `IMAGES_PATH`, limites de ficheiro (ver `src/config/database.ts`).
- **SMS (Infobip):** `INFOBIP_*`.
- **Branding / URLs:** `CLIENT_URL`, `FRONTEND_URL`, `SYSTEM_NAME`.
- **SQL Server (opcional cadastros):** `DB_SERVER`, `DB_DATABASE`, etc.
- **Microsoft Entra (opcional):** `AZURE_*`.
- **Satélite:** `SATELLITE_BASE_URL`, `SATELLITE_AUTH_TOKEN`, `SATELLITE_PUBLIC_URL`, `SATELLITE_POLL_INTERVAL_MS`, `SATELLITE_POLL_SILENT`.

Detalhe: [CONFIGURACAO_ENV.md](./CONFIGURACAO_ENV.md) e `.env.example` na raiz.

**Porque `SATELLITE_BASE_URL` com `https://`?** O cliente HTTP valida URLs absolutas; omitir o esquema causa falhas de ligação.

---

## 8. Camada de dados (SQLite, PostgreSQL, migrações)

### Modo SQLite (padrão)

- Ficheiro definido por `DB_PATH` (ex. `./data/database/chamados.db`).
- Schema principal: `src/core/database/schema.sql` (e patches na mesma pasta).
- `executeSchema()` no arranque aplica/cria estruturas necessárias.

### Modo PostgreSQL (ERP)

- Ativar com `USE_POSTGRES=true` e `DATABASE_URL=postgresql://...`.
- Schema completo de referência: `src/core/database/schema-full.postgres.sql`.
- Guia operacional: [RAILWAY_POSTGRES_PASSO_A_PASSO.md](./RAILWAY_POSTGRES_PASSO_A_PASSO.md).

### Migrações adicionais

Existem scripts `npm run migrate:*` para evoluções pontuais (perfil, relatórios, push tokens, custom fields, etc.). **Mantenha um procedimento interno** de qual script corre após qual deploy.

### Satélite

- Postgres **obrigatório**; migrações em arranque via `RailwaySatellite/src/db.ts`.

---

## 9. API HTTP (`/api`) e padrões

- Prefixo global: **`/api`** (ver `server.ts`: `app.use('/api', apiRouter)`).
- Respostas: ver [API_RESPONSE_STANDARD.md](./API_RESPONSE_STANDARD.md).
- Documento de endpoints: [DOCUMENTACAO_API.md](./DOCUMENTACAO_API.md).
- Saúde do processo: **`GET /health`** (fora do prefixo `/api` no router principal).

### Descoberta rápida

`GET /api` (sem autenticação) devolve um JSON com lista de módulos e caminhos base (útil em desenvolvimento; não substitui documentação OpenAPI completa se for necessária no futuro).

---

## 10. Núcleo (Core): autenticação, utilizadores, sistema, permissões, auditoria

### Autenticação (`/api/auth`)

- Registo, login, refresh de token conforme implementação em `src/core/auth/`.
- **Rate limiting** específico no login em produção (`authLimiter` em `server.ts`).

### Utilizadores (`/api/users`)

- CRUD de utilizadores, perfis, atividade (quando exposto e autorizado).

### Sistema (`/api/system` e rotas relacionadas)

- Configurações globais (nome, logo, versão, subtítulo, etc.).
- **`GET /api/system/public-config`** — **público** (sem JWT), usado pelo login/mobile para branding.

### Permissões (`/api/permissions`)

- Modelo: tabela `permissions`, associação a **roles** (`admin`, `attendant`, `user`) e **overrides** por utilizador.
- Endpoints administrativos (ex.: listar por módulo, atualizar matriz de role) restringidos a admin onde aplicável.

### Auditoria (`/api/system/audit-logs`)

- Registo de ações sensíveis (serviço em `src/core/audit/`).

### Performance (`/api/performance`)

- Métricas e ferramentas de administração de performance (conforme rotas registadas).

**Porque permissões por código string (ex. `tickets.view`)?** Permite verificar autorização nas rotas com `requirePermission('...')` sem acoplar a IDs numéricos no código fonte.

---

## 11. Módulo Chamados

**Prefixos de rota** (registados em `registerChamadosRoutes`):

| Prefixo | Conteúdo típico |
|---------|------------------|
| `/api/tickets` | Ciclo de vida do ticket, mensagens, histórico, exportação. |
| `/api/categories` | Categorias. |
| `/api/category-assignments` | Atribuição automática por categoria. |
| `/api/attachments` | Upload de anexos (com rate limit de upload em produção). |
| `/api/notifications` | Centro de notificações. |
| `/api/dashboard` | Dados agregados do dashboard de chamados. |
| `/api/reports` | Relatórios e agendamento de relatórios. |
| `/api/admin-metrics` | Métricas administrativas. |
| `/api/realtime` | Canal complementar a WebSocket/SSE conforme implementação. |

**Serviços de longa duração**

- `StatusUpdateService` — atualização automática de estados (ex.: SLA).
- `WebSocketService` — canal em tempo real para a UI de chamados.

**Frontend:** rotas sob `/tickets`, `/categories`, `/status`, `/category-assignments`, `/reports`, `/admin-dashboard`, `/notifications`, etc.

**Notificações:** ver [QUANDO_NOTIFICACOES_SÃO_ENVIADAS.md](./QUANDO_NOTIFICACOES_SÃO_ENVIADAS.md).

---

## 12. Módulo Cadastros

**Prefixos:**

| Prefixo | Função |
|---------|--------|
| `/api/client-registrations` | Listagem, criação, edição, aprovação/rejeição de cadastros de clientes. |
| `/api/client-config` | Configuração de campos e regras por cliente/tipo de cadastro. |
| `/api/analise-credito` | Fluxo de análise de crédito associado ao cadastro. |

**Integração SQL Server** (opcional): configurada em `src/config/sqlserver.ts` e variáveis `DB_*` — usada quando o negócio exige sincronizar ou ler dados de um ERP legado.

**Frontend:** `/client-registrations`, `/cadastros-config`, formulários de detalhe e edição.

---

## 13. Módulo Compras

**Prefixos:**

| Prefixo | Função |
|---------|--------|
| `/api/solicitacoes-compra` | Solicitações e estados (rascunho, aprovação, cotação, etc.). |
| `/api/orcamentos` | Orçamentos dos fornecedores, aprovação, devolução, entrega. |
| `/api/aprovadores` | Quem aprova e limites de valor. |
| `/api/compradores` | Quem executa a cotação/compra. |
| `/api/compras-anexos` | Anexos ligados a solicitações/orçamentos. |

**Modelo de negócio:** separação entre **solicitante**, **aprovador** (níveis e faixas de valor) e **comprador** permite trilhos de aprovação e rastreabilidade.

**Frontend:** rotas em `/compras/*` e `/compras-config`.

**Permissões:** códigos `compras.*` definidos no schema SQL (ver secção 21).

---

## 14. Módulo Descarregamento e satélite Railway

### Recursos no ERP

| Prefixo | Função |
|---------|--------|
| `/api/descarregamento/fornecedores` | Cadastro de fornecedores de descarga (categorias, matrículas, etc.). |
| `/api/descarregamento/agendamentos` | Agendamentos (data, hora opcional, doca, notas). |
| `/api/descarregamento/docas` | Configuração de docas ativas. |
| `/api/descarregamento/formularios` | Editor/publicação de formulário dinâmico para o motorista. |
| `/api/descarregamento/form-responses` | Respostas (chegada ao pátio, associação a agendamento quando aplicável). |
| `/api/descarregamento/sms-templates` | Templates Infobip com variáveis (`{{driver_name}}`, etc.). |

### Fluxo funcional (resumo)

1. **Configurar** docas e fornecedores.
2. **Criar agendamentos** (hora é opcional desde a versão documentada em 2026).
3. **Publicar formulário** — gera links/QR; se satélite ativo, o ERP faz **push** do snapshot.
4. Motorista **preenche** formulário (no ERP público ou no satélite).
5. Operação **acompanha** pátio, chama para doca, envia SMS conforme templates.
6. **Liberar / checkout** do motorista quando concluído.

### Integração satélite (porque polling e não só webhook)

- **Push (`SatelliteSyncService`):** o ERP envia para `PUT /internal/snapshots/:id` o JSON do formulário + listagem de fornecedores, com `public_slug` estável (ex. `fd-{id}`).
- **Poll (`SatelliteInboundPoller`):** o ERP consulta periodicamente `GET /internal/submissions` no satélite, importa respostas e faz **ack** para não reprocessar.
- **Motivos:** o satélite pode estar em rede diferente; polling com token interno é simples de proteger e de reexecutar após falhas; evita expor o ERP a inbound público não autenticado.

Variáveis: `SATELLITE_BASE_URL`, `SATELLITE_AUTH_TOKEN` (deve coincidir com `INTERNAL_AUTH_TOKEN` no satélite), `SATELLITE_PUBLIC_URL` para links/QR apontarem ao domínio público do satélite.

**Após arranque:** o ERP agenda `pushAllPublishedSnapshots()` alguns segundos após subir (reconciliação após mudanças de env ou Postgres do Railway).

### URLs públicas no ERP

O frontend expõe rotas públicas sob `/descarregamento/formulario*`, `/descarregamento/acompanhamento/:trackingCode` e modo **“só formulário”** (`PublicFormOnlyGuard`) para quiosques ou tablets apenas de motorista.

---

## 15. Frontend React (SPA)

### Entrada

- `frontend/src/main.tsx`, `App.tsx`.
- Providers: `AuthProvider`, `PermissionsProvider`, `ThemeProvider`, `SystemConfigProvider`.

### Cliente API

- `frontend/src/services/api.ts` — cliente Axios (ou fetch) centralizado com prefixo da API.
- `frontend/src/utils/apiUrl.ts` — construção da URL em dev/prod.
- `.env` do frontend: `VITE_API_URL`, `VITE_BACKEND_PORT` (ver `frontend/.env.example`).

### Rotas autenticadas (amostra)

- Dashboard, tickets, cadastros, compras, descarregamento (agendamentos, grade, docas, motoristas, config), utilizadores, permissões, sistema, relatórios, auditoria, backup, performance.

### Rotas públicas

- Login, registo (se habilitado), formulários de descarregamento e acompanhamento com wrapper `PublicFormOnlyWrapper` quando aplicável.

Documentação de pastas do front: [../frontend/MODULOS.md](../frontend/MODULOS.md).

### Rotas do `App.tsx` (referência)

**Públicas (sem layout autenticado):** `/login`, `/register`.

**Públicas descarregamento (com `PublicFormOnlyWrapper` onde aplicável):**  
`/descarregamento/formulario/:id`, `/descarregamento/formulario-publico`, `/descarregamento/formulario-publico/:id`, `/descarregamento/acompanhamento/:trackingCode`, `/descarregamento/restrito`.

**Autenticadas (dentro de `Layout`):**

| Rota (relativa ao router) | Área |
|---------------------------|------|
| `/dashboard` | Painel principal |
| `/tickets`, `/tickets/new`, `/tickets/:id` | Chamados |
| `/client-registrations`, `.../new`, `.../:id`, `.../:id/edit` | Cadastros de clientes |
| `/compras/solicitacoes`, `.../nova`, `.../:id`, `.../:solicitacaoId/orcamento/novo` | Compras — solicitações |
| `/compras/orcamentos`, `/compras/orcamentos/:id` | Orçamentos |
| `/compras/minhas-solicitacoes`, `/compras/pendentes-aprovacao` | Comprador / aprovador |
| `/compras-config` | Configuração de compras |
| `/descarregamento/agendamentos`, `.../novo`, `.../:id` | Agendamentos |
| `/descarregamento/fornecedores`, `.../novo`, `.../:id/editar` | Fornecedores |
| `/descarregamento/grade` | Grade de descarregamento |
| `/descarregamento/docas` | Docas |
| `/descarregamento/motoristas-patio` | Motoristas no pátio |
| `/descarregamento-config` | Configuração do módulo |
| `/users`, `/permissions`, `/profile` | Administração de utilizadores |
| `/notifications` | Notificações |
| `/system-config`, `/system-settings` | Sistema |
| `/categories`, `/status`, `/cadastros-config`, `/category-assignments` | Chamados — configuração |
| `/reports`, `/admin-dashboard`, `/performance`, `/audit`, `/backup` | Relatórios, admin, performance, auditoria, backup |

---

## 16. Serviço RailwaySatellite

**Localização:** `RailwaySatellite/`.

### Arranque

- Exige `DATABASE_URL` (Postgres).
- `INTERNAL_AUTH_TOKEN` — obrigatório para uso real das rotas `/internal/*`.
- `npm run build` — compila `web` (React) e TypeScript do servidor.
- `npm start` — serve API + ficheiros estáticos de `web/dist` se existirem.

### Rotas principais

| Caminho | Audiência | Função |
|---------|-----------|--------|
| `GET /health` | Pública | Saúde. |
| `/internal/*` | ERP (Bearer token) | Snapshots, listagem de submissões, ack. |
| `/api/public/*` | Motorista / internet | Endpoints públicos com rate limit. |
| `GET /d/:publicSlug` | Motorista | SPA do formulário (`fd-*`). |
| `GET /t/:trackingToken` | Motorista | SPA de acompanhamento. |

Se **`web/dist`** não existir, o servidor usa HTML legado (`publicPages.ts`) como fallback.

**Porque Postgres dedicado no satélite?** Isola dados efémeros de submissões públicas do banco principal do ERP, simplifica deploy no Railway e permite escalar o satélite independentemente.

---

## 17. Segurança, CORS, limites e produção

- **Helmet** com CSP desativada (compatibilidade com front); HSTS configurável (`DISABLE_HSTS`).
- **CORS:** em produção com `ALLOWED_ORIGINS`, lista explícita; suporte a previews Vercel quando configurado.
- **Rate limiting:** global, login e upload em produção.
- **HTTPS em desenvolvimento:** middleware especial evita loops quando `PUBLIC_URL` está definida (ver comentários em `server.ts`).

**Porque tantos middlewares em `server.ts`?** Há cenários mistos (HTTP local, HTTPS atrás de túnel, PWA/mobile) — o código tenta equilibrar segurança em produção com DX em desenvolvimento.

---

## 18. Ficheiros estáticos, uploads e imagens

- **`/storage/images`**, **`/storage/uploads`**, **`/storage/avatars`** — servidos a partir de `storage/` na raiz do projeto.
- **Legado:** `/imgCadastros` e `/uploads` como aliases.

**Backup:** incluir `storage/` nos procedimentos (ver [BACKUP_RESTORE.md](./BACKUP_RESTORE.md)).

---

## 19. Deploy, PM2 e backups

- **PM2:** scripts em `scripts/pm2-*.js` e `.bat`.
- **Deploy geral:** [DEPLOY.md](./DEPLOY.md).
- **Túnel Cloudflare:** [CLOUDFLARE_TUNNEL_RAILWAY_FRONTEND.md](./CLOUDFLARE_TUNNEL_RAILWAY_FRONTEND.md).

---

## 20. Testes e qualidade

- **Jest:** `npm test` — pasta `tests/`.
- **Checklists manuais:** [TESTES_MANUAIS_VERIFICACAO.md](./TESTES_MANUAIS_VERIFICACAO.md).
- **Diagnóstico de performance SQL:** [DIAGNOSTICO_SQL.md](./DIAGNOSTICO_SQL.md), [AUDIT_N+1.md](./AUDIT_N+1.md).

---

## 21. Permissões por módulo (referência)

Os códigos vivem na tabela `permissions` (seed nos `.sql`). Exemplos:

- **Chamados:** `tickets.view`, `tickets.create`, `tickets.edit`, …, `tickets.sla.manage`.
- **Cadastros:** `registrations.view`, `registrations.approve`, `registrations.analise_credito.manage`, …
- **Notificações / administração:** `notifications.*`, `users.*`, `permissions.manage`, `reports.*`, `system.config.manage`, `system.audit.view`, `system.backup.*`, etc.
- **Compras:** `compras.solicitacoes.*`, `compras.orcamentos.*`, `compras.aprovadores.manage`, …
- **Descarregamento:** `descarregamento.agendamentos.*`, `descarregamento.fornecedores.*`, `descarregamento.docas.*`, `descarregamento.formularios.*`, `descarregamento.form_responses.*`, `descarregamento.motoristas.*`, `descarregamento.sms_templates.manage`.

**Roles padrão:** `admin` recebe todas; `attendant` e `user` recebem subconjuntos definidos no seed SQL (ajustar seeds ou a UI de permissões para o vosso modelo operacional).

---

## 22. Glossário

| Termo | Significado |
|-------|-------------|
| **ERP** | Este produto (backend + frontend). |
| **Satélite** | Serviço `RailwaySatellite` com Postgres próprio para formulário/tracking público. |
| **Snapshot** | Versão publicada do formulário + metadados enviada ao satélite. |
| **Ack** | Confirmação ao satélite de que a submissão foi consumida pelo ERP. |
| **SLA** | Acordo de nível de serviço nos chamados (tempos e alertas). |
| **JWT** | Token de sessão API. |

---

## Manutenção deste manual

Ao adicionar módulos ou rotas:

1. Atualizar `src/server.ts` (se houver descoberta `/api`) e **este ficheiro**.
2. Atualizar [ESTRUTURA_PROJETO.md](./ESTRUTURA_PROJETO.md) e o [README.md](../README.md) se a árvore ou scripts mudarem.
3. Registar permissões novas no SQL de schema e na secção 21.

---

*Fim do manual completo ERP PRIME.*
