# ERP PRIME

Sistema completo de gestão empresarial (ERP) modular desenvolvido com **Node.js**, **Express**, **TypeScript**, **React** (Vite) e **SQLite** ou **PostgreSQL** (configurável via `USE_POSTGRES` e `DATABASE_URL`).

### Documentação

| Recurso | Descrição |
|---------|-----------|
| **[docs/MANUAL_COMPLETO_ERP_PRIME.md](docs/MANUAL_COMPLETO_ERP_PRIME.md)** | Manual único de produto e engenharia: arquitetura, todas as pastas, módulos, fluxos, satélite Railway, permissões e decisões técnicas. |
| **[docs/INDICE_DOCUMENTACAO.md](docs/INDICE_DOCUMENTACAO.md)** | Índice de toda a documentação Markdown do repositório (deploy, API, diagnóstico, etc.). |

---

## 🏢 Sobre o ERP PRIME

O ERP PRIME é um sistema de gestão empresarial modular que oferece funcionalidades para diferentes áreas da empresa: autenticação e usuários, chamados, cadastros de clientes, compras (solicitações e orçamentos) e descarregamento (formulários públicos, docas, agendamentos, SMS).

---

## 📦 Módulos do Sistema

| Módulo | Descrição |
|--------|-----------|
| **Core** | Autenticação, usuários, configurações do sistema, permissões, auditoria e performance |
| **Chamados** | Gestão de chamados/tickets, categorias, anexos, SLA, notificações em tempo real, relatórios e dashboard |
| **Cadastros** | Cadastro de clientes, configurações por cliente, análise de crédito, consulta CNPJ, integração Atak e SQL Server |
| **Compras** | Solicitações de compra, orçamentos, aprovadores e compradores |
| **Descarregamento** | Formulários públicos, docas, agendamentos, QR codes e notificações por SMS (Infobip) |

---

## 🗄️ Banco de dados: SQLite ou PostgreSQL

O sistema suporta dois backends de banco:

- **SQLite** (padrão): não defina `USE_POSTGRES`; use `DB_PATH` para o arquivo `.db`.
- **PostgreSQL**: ideal para produção (ex.: Railway). Variáveis **obrigatórias**:
  - **`USE_POSTGRES=true`** — ativa o backend PostgreSQL
  - **`DATABASE_URL`** — URL de conexão, ex.: `postgresql://user:senha@host:5432/banco?sslmode=require`

Sem `USE_POSTGRES=true` ou sem `DATABASE_URL`, o sistema usa SQLite.

### PostgreSQL local com Docker (testes)

```bash
docker compose -f docker-compose.postgres.yml up -d
```

No `.env`: `USE_POSTGRES=true` e `DATABASE_URL=postgresql://erp:erp_local@localhost:5432/erp_prime`.  
Parar: `docker compose -f docker-compose.postgres.yml down`.

### Schema único para Postgres

O arquivo `src/core/database/schema-full.postgres.sql` contém todo o schema (tabelas, índices e dados iniciais). Você pode rodá-lo manualmente em um banco vazio, por exemplo:

```bash
psql -U erp -d erp_prime -f src/core/database/schema-full.postgres.sql
```

O backend também usa esse arquivo na inicialização quando `USE_POSTGRES=true`.

### PostgreSQL no Railway (produção)

Passo a passo completo: **[docs/RAILWAY_POSTGRES_PASSO_A_PASSO.md](docs/RAILWAY_POSTGRES_PASSO_A_PASSO.md)**.

---

## 🚀 Início Rápido

### Pré-requisitos

- **Node.js** 16 ou superior
- **npm**

### Instalação e execução

1. **Instalar dependências (backend + frontend):**
   ```bash
   npm run install:all
   ```

2. **Executar migrações do banco de dados:**
   ```bash
   npm run migrate
   ```

3. **Iniciar o sistema completo (backend + frontend):**
   ```bash
   npm run dev:all
   ```

O sistema estará disponível em:

- **Frontend:** http://localhost:3001  
- **Backend API:** http://localhost:3000 (ou a porta definida em `PORT` no `.env`)

As portas padrão podem ser alteradas no `.env` da raiz: `PORT` (backend), `FRONTEND_PORT` (frontend, padrão 3001). O frontend em dev usa proxy para `/api`, `/uploads`, `/storage` e `/imgCadastros` apontando para o backend.

---

## 📋 Scripts Disponíveis

### Desenvolvimento

| Script | Descrição |
|--------|-----------|
| `npm run dev:all` | Inicia backend e frontend simultaneamente |
| `npm run dev:backend` | Apenas o backend |
| `npm run dev:frontend` | Apenas o frontend |
| `npm run dev` | Alias para o backend |

### Build

| Script | Descrição |
|--------|-----------|
| `npm run build` | Compila o backend TypeScript |
| `npm run build:all` | Compila backend e frontend |

### Instalação

| Script | Descrição |
|--------|-----------|
| `npm run install:all` | Instala dependências do backend e do frontend |

### Banco de dados

| Script | Descrição |
|--------|-----------|
| `npm run migrate` | Executa migrações do banco de dados |
| `npm run db:reset` | Reseta o banco SQLite (renomeia o arquivo para permitir recriação). **Não se aplica quando `USE_POSTGRES=true`** |
| `npm run migrate:cnpj-status` | Migração de status CNPJ |
| `npm run migrate:user-profile` | Migração de perfil de usuário |
| `npm run migrate:reports-types` | Migração de tipos de relatórios |
| `npm run migrate:push-tokens` | Migração de tokens de push |

### Produção

| Script | Descrição |
|--------|-----------|
| `npm start` | Inicia Ngrok (se ativo), Nginx (se instalado) e o servidor Node |
| `npm run start:server` | Apenas o servidor Node (sem Ngrok/Nginx) |

### Usuário e verificação

| Script | Descrição |
|--------|-----------|
| `npm run create-user` | Cria ou atualiza usuário admin (requer `npm run build` antes) |
| `npm run check-user` | Verifica usuário no banco |

### Nginx

| Script | Descrição |
|--------|-----------|
| `npm run install:nginx:linux` | Instala o Nginx no Linux (Debian/Ubuntu/RHEL) |
| `npm run install:nginx:win` | Instala o Nginx no Windows (winget ou Chocolatey) |

### Outros

| Script | Descrição |
|--------|-----------|
| `npm run generate:ssl-cert` | Gera certificado SSL para Nginx |
| `npm run test` | Executa testes (Jest) |

---

## ⚙️ Configuração de Ambiente

Copie `env.example` para `.env` e preencha os valores. Principais variáveis:

### Servidor

- **`PORT`** — Porta do backend (padrão 3000).
- **`NODE_ENV`** — `development` ou `production`.
- **`FRONTEND_PORT`** — Porta do frontend em dev (padrão 3001); o Vite usa essa variável quando lida da raiz.

### Banco de dados

- **SQLite:** `DB_PATH=./data/database/chamados.db`
- **PostgreSQL:** `USE_POSTGRES=true` e `DATABASE_URL=postgresql://...`

### Autenticação e e-mail

- **`JWT_SECRET`**, **`JWT_EXPIRES_IN`**
- **`SMTP_HOST`**, **`SMTP_PORT`**, **`SMTP_USER`**, **`SMTP_PASS`**, **`SMTP_FROM`**

### URLs e CORS

- **`CLIENT_URL`** / **`FRONTEND_URL`** — URL do frontend (links em e-mails).
- **`ALLOWED_ORIGINS`** — Origens permitidas em produção (CORS), ex.: `https://seu-app.up.railway.app`. Múltiplas origens separadas por vírgula.
- **`PUBLIC_URL`** — URL pública do backend quando atrás de túnel (Cloudflare Tunnel, etc.). Usada em formulários/QR e para não redirecionar HTTPS→HTTP em dev. Ex.: `https://seu-backend.trycloudflare.com`.

### Módulos opcionais

- **SQL Server (Cadastros):** `DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`, etc.
- **SMS (Infobip):** `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_SENDER`
- **Atak (Cadastros):** `ATAK_BASE_URL`, `ATAK_USERNAME`, `ATAK_PASSWORD` (ou `ATAK_TOKEN`)
- **Ngrok:** `USE_NGROK=true|false`, `NGROK_PORT` (porta exposta)
- **Nginx:** `USE_NGINX=true|false`

Referência completa de variáveis: **[DEPLOY.md](DEPLOY.md)** (seção Variáveis de ambiente).

---

## 🌐 Nginx (proxy reverso)

O `npm start` pode iniciar o **Nginx** (se instalado e `USE_NGINX` não for `false`) como proxy na **porta 80** e o Node na porta definida em `PORT`. Quem acessar `http://localhost` ou `http://[IP]` é atendido pelo Nginx, que repassa ao Node.

### Instalar Nginx

- **Linux (Debian/Ubuntu):** `npm run install:nginx:linux`  
  Para usar como serviço: copiar `nginx/erp-prime.conf` para `/etc/nginx/sites-available/`, ativar e recarregar o Nginx.
- **Windows:** `npm run install:nginx:win` ou baixar em [nginx.org](https://nginx.org/en/download.html) e colocar no PATH.
- **macOS:** `brew install nginx`

No `.env`, use `PORT=3000` (ou a porta que o Nginx usa). Os arquivos em `nginx/` fazem proxy para `http://127.0.0.1:PORT`.  
Para desativar o Nginx ao rodar `npm start`: `USE_NGINX=false`.

---

## 🌐 Formulários públicos e túneis (Ngrok / Cloudflare Tunnel)

Para que **formulários** (ex.: descarregamento) sejam acessíveis **fora da rede** (por link ou QR code), o projeto pode usar túnel (Ngrok ou Cloudflare Tunnel).

### Comportamento com `npm start`

1. **Ngrok** (se `USE_NGROK` não for `false`): expõe a porta do Node em uma URL pública (ex.: `https://xxxx.ngrok-free.app`). O sistema detecta a URL e usa nos **QR codes**.
2. **Nginx** (se instalado e `USE_NGINX` não for `false`).
3. **Servidor Node.**

Requisitos para Ngrok: instalar e deixar no PATH ([ngrok.com/download](https://ngrok.com/download)). No `.env`: `USE_NGROK=true` (padrão) ou `USE_NGROK=false`; `NGROK_PORT` opcional (padrão: valor de `PORT`).

Se o Ngrok não estiver instalado ou no PATH, o script apenas exibe aviso. Os formulários continuam acessíveis na rede local (IP + porta ou `PUBLIC_URL`/`PUBLIC_HOSTNAME`).

### Cloudflare Tunnel (ou outro túnel)

Se você usar **Cloudflare Tunnel** em vez do Ngrok (ex.: frontend no Railway e backend local), defina no `.env` do backend:

- **`PUBLIC_URL`** — URL pública do túnel (ex.: `https://seu-backend.trycloudflare.com`).

O sistema usará essa URL nos QR codes dos formulários e **não** redirecionará HTTPS para HTTP quando as requisições vierem desse host. Sem `PUBLIC_URL`, o comportamento permanece o atual (Ngrok automático ou hostname/rede local).

Passo a passo completo (backend local + frontend no Railway + Cloudflare Tunnel): **[docs/CLOUDFLARE_TUNNEL_RAILWAY_FRONTEND.md](docs/CLOUDFLARE_TUNNEL_RAILWAY_FRONTEND.md)**.

---

## 🚀 Deploy em produção

### Preparação

```bash
git clone <url-do-repositorio>
cd ERP_Prime
npm run install:all
npm run build:all
npm run migrate
```

### Configuração

- Defina no `.env`: `NODE_ENV=production`, `JWT_SECRET`, `PORT`, paths de upload/storage, e conforme os módulos usados (SMTP, Infobip, Atak, SQL Server, etc.).
- Para **PostgreSQL:** `USE_POSTGRES=true` e `DATABASE_URL`.
- Para **CORS** (front em outro domínio): `ALLOWED_ORIGINS` com a URL do front (ex.: `https://seu-app.up.railway.app`).
- Para **front e back em hosts diferentes:** no front (ex.: Vercel/Railway), defina **`VITE_API_URL`** com a URL do backend (sem barra no final).

### Iniciar

```bash
npm start
```

Ou apenas o servidor: `npm run start:server`.

Guia completo de deploy (Vercel + Render / Fly.io / Railway): **[DEPLOY.md](DEPLOY.md)**.  
PostgreSQL no Railway: **[docs/RAILWAY_POSTGRES_PASSO_A_PASSO.md](docs/RAILWAY_POSTGRES_PASSO_A_PASSO.md)**.  
Backend local + frontend no Railway + Cloudflare Tunnel: **[docs/CLOUDFLARE_TUNNEL_RAILWAY_FRONTEND.md](docs/CLOUDFLARE_TUNNEL_RAILWAY_FRONTEND.md)**.

---

## 🔐 Primeiro usuário administrador

O primeiro admin pode ser criado pela **tela de registro** no frontend (quando ainda não existe usuário) ou pelo script **`create-user`**.

### Via script (local ou no servidor)

O script usa o mesmo banco do backend (`DATABASE_URL`/`USE_POSTGRES` ou `DB_PATH`). Rode onde o banco estiver acessível.

```bash
npm run build
npm run create-user
```

Variáveis opcionais:

| Variável | Padrão |
|----------|--------|
| `CREATE_USER_NAME` | Administrador |
| `CREATE_USER_EMAIL` | admin@localhost.com |
| `CREATE_USER_PASSWORD` | Admin@123456 |
| `CREATE_USER_ROLE` | admin |

Se o usuário já existir, o script atualiza a senha e reativa o usuário se estiver inativo.

---

## 🏗️ Estrutura do Projeto

```
ERP_Prime/
├── src/                          # Backend (Node.js + Express + TypeScript)
│   ├── core/                      # Auth, usuários, system, permissions, audit
│   ├── modules/
│   │   ├── chamados/              # Chamados/tickets
│   │   ├── cadastros/             # Cadastros de clientes
│   │   ├── compras/               # Solicitações e orçamentos
│   │   └── descarregamento/       # Formulários, docas, agendamentos, SMS
│   ├── shared/                    # Middleware, utils, types
│   ├── config/                    # Configurações (database, sqlserver)
│   └── server.ts
├── frontend/                      # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   ├── services/
│   │   ├── hooks/
│   │   └── utils/
│   └── vite.config.ts
├── data/                          # Dados (database, backups)
├── storage/                       # uploads, images
├── logs/
├── scripts/                       # start-with-nginx, create-user, etc.
├── nginx/                         # Configurações Nginx
├── docs/                          # Documentação (ex.: RAILWAY_POSTGRES_PASSO_A_PASSO.md)
├── tools/                         # Ferramentas auxiliares
└── package.json
```

---

## 🎯 Funcionalidades por módulo

### Core

- Autenticação e autorização (JWT, cookies)
- Usuários e permissões
- Configurações do sistema (logo, temas, campos por categoria)
- Auditoria de ações
- Métricas de performance
- Backup e restauração

### Chamados

- CRUD de chamados/tickets
- Categorias e atribuição
- Anexos e histórico
- Notificações em tempo real (WebSocket/SSE)
- Dashboard e relatórios
- SLA configurável
- Notificações push (Expo) e e-mail

### Cadastros

- Cadastro de clientes (registro e análise de crédito)
- Configurações por cliente
- Integração Atak e SQL Server
- Consulta CNPJ (CNPJÁ, SPC, TESS AI)

### Compras

- Solicitações de compra
- Orçamentos e aprovadores
- Compradores e fluxo de aprovação

### Descarregamento

- Formulários públicos (links e QR codes)
- Docas e agendamentos
- Notificações por SMS (Infobip)
- Integração com túneis (Ngrok, PUBLIC_URL para Cloudflare Tunnel)

---

## 📝 Licença

MIT

---

## 👤 Autor

Samuel
