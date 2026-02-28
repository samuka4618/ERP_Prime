# Passo a passo completo: PostgreSQL no Railway (ERP Prime)

Este guia descreve **do zero** como criar um banco PostgreSQL no Railway e vincular ao backend do ERP Prime, com todos os passos necessários no dashboard e nas variáveis de ambiente.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Criar conta e acessar o Railway](#2-criar-conta-e-acessar-o-railway)
3. [Criar ou abrir o projeto](#3-criar-ou-abrir-o-projeto)
4. [Adicionar o serviço PostgreSQL](#4-adicionar-o-serviço-postgresql)
5. [Configurar o serviço do backend (API)](#5-configurar-o-serviço-do-backend-api)
6. [Vincular o PostgreSQL ao serviço da API](#6-vincular-o-postgresql-ao-serviço-da-api)
7. [Variáveis de ambiente obrigatórias](#7-variáveis-de-ambiente-obrigatórias)
8. [Build e Start do backend](#8-build-e-start-do-backend)
9. [Domínio público e URL da API](#9-domínio-público-e-url-da-api)
10. [Primeiro deploy e criação do schema](#10-primeiro-deploy-e-criação-do-schema)
11. [Criar o primeiro usuário (admin)](#11-criar-o-primeiro-usuário-admin)
12. [Ligar o frontend (Vercel) ao backend](#12-ligar-o-frontend-vercel-ao-backend)
13. [Verificação e troubleshooting](#13-verificação-e-troubleshooting)
14. [Backup do banco PostgreSQL](#14-backup-do-banco-postgresql)
15. [Resumo rápido (checklist)](#15-resumo-rápido-checklist)

---

## 1. Pré-requisitos

- **Conta no GitHub** com o repositório do ERP Prime (código já commitado e enviado).
- **Navegador** atualizado (Chrome, Firefox, Edge).
- **Repositório** do ERP Prime no GitHub com a branch que você usa (ex.: `main` ou `master`).

Não é obrigatório ter o Railway CLI instalado; todo o processo pode ser feito pelo **dashboard web**.

---

## 2. Criar conta e acessar o Railway

### 2.1 Acessar o site

1. Abra no navegador: **https://railway.app**
2. Clique em **"Login"** (canto superior direito).

### 2.2 Login com GitHub

1. Selecione **"Login with GitHub"**.
2. Se for a primeira vez, o GitHub pedirá autorização para o Railway acessar sua conta (repositórios, etc.). Clique em **"Authorize Railway"** (ou equivalente).
3. Depois do login, você será redirecionado para o **dashboard** do Railway: **https://dashboard.railway.app**

### 2.3 Se já tiver conta

- Acesse diretamente **https://dashboard.railway.app** e faça login com GitHub se solicitado.

---

## 3. Criar ou abrir o projeto

### Opção A: Projeto novo (primeira vez no Railway)

1. No dashboard, clique no botão **"New Project"** (ou **"+ New Project"**).
2. Na tela de criação:
   - Escolha **"Deploy from GitHub repo"** (não use "Empty Project" para o backend).
3. Se for a **primeira vez** conectando o GitHub ao Railway:
   - Clique em **"Configure GitHub App"** ou **"Connect GitHub"**.
   - Selecione a **conta** ou **organização** onde está o repositório do ERP Prime.
   - Escolha **"All repositories"** ou **"Only select repositories"** e marque o repositório do **ERP Prime**.
   - Confirme em **"Install"** / **"Save"**.
4. Na lista de repositórios, selecione o repositório **ERP_Prime** (ou o nome exato do seu repo).
5. Clique em **"Deploy Now"** ou **"Add service"**.
6. O Railway cria um **projeto** e um **serviço** ligado a esse repositório. Esse serviço será o **backend (API)**. Anote o nome do projeto (ex.: "ERP Prime" ou o nome do repo).

### Opção B: Projeto já existente (só backend, sem Postgres ainda)

1. No dashboard, clique no **projeto** que já contém o serviço do backend do ERP Prime.
2. Você verá um ou mais **serviços** (cards). Um deles é o backend (geralmente com o nome do repositório ou "API").

---

## 4. Adicionar o serviço PostgreSQL

O PostgreSQL no Railway é um **serviço separado** (add-on) dentro do mesmo projeto. Você vai criar esse serviço e, em seguida, vincular a variável `DATABASE_URL` ao serviço da API.

### 4.1 Abrir o projeto

1. No dashboard do Railway, clique no **projeto** onde está (ou onde você criou) o backend.

### 4.2 Adicionar um novo serviço

1. Clique no botão **"+ New"** (ou **"Add Service"** / **"New Service"**), geralmente no canto inferior direito ou no centro do canvas.
2. No menu que abrir, escolha **"Database"** (ou **"Add Plugin"** / **"Database"** → **PostgreSQL**).
3. Se aparecer **"Deploy PostgreSQL"** ou **"Add PostgreSQL"**, confirme.

### 4.3 Aguardar a criação do banco

1. O Railway cria um novo **card/serviço** no projeto com o nome **"PostgreSQL"** (ou similar).
2. Aguarde alguns segundos até o status indicar que o serviço está **ativo** (ícone verde ou "Active").
3. **Não é necessário** configurar usuário/senha manualmente: o Railway gera credenciais e expõe a **URL de conexão** em variáveis do próprio serviço PostgreSQL.

### 4.4 Onde ficam as credenciais

- As credenciais e a **DATABASE_URL** ficam na aba **Variables** (ou **Connect**) do **serviço PostgreSQL**, não na API.
- No próximo passo você vai **referenciar** essa variável no serviço da API (vinculação).

---

## 5. Configurar o serviço do backend (API)

Antes de vincular o Postgres, confira (ou ajuste) as configurações do serviço que roda o backend.

### 5.1 Selecionar o serviço da API

1. No mesmo projeto, clique no **card do serviço** que representa o **backend** (repositório GitHub do ERP Prime). Não clique no card do PostgreSQL.

### 5.2 Aba "Settings"

1. Com o serviço da API selecionado, abra a aba **"Settings"** (no painel à direita ou no menu do serviço).
2. Verifique ou preencha:

| Campo | Valor recomendado | Observação |
|-------|--------------------|------------|
| **Name** | `erp-prime-api` ou outro | Nome do serviço (não precisa ser igual ao repo). |
| **Source** | GitHub + repositório + branch | Repo do ERP Prime e branch (ex.: `main`). |
| **Root Directory** | *(vazio)* | Raiz do repositório já é a pasta do backend. |
| **Watch Paths** | *(vazio)* ou `src` | Opcional: redeploy só quando `src` mudar. |

### 5.3 Build e Start (próxima seção)

Os comandos de **Build** e **Start** são essenciais para o backend subir com TypeScript compilado. Eles são tratados na [Seção 8](#8-build-e-start-do-backend).

---

## 6. Vincular o PostgreSQL ao serviço da API

Para o backend usar o banco, ele precisa da variável **`DATABASE_URL`**. No Railway você pode **referenciar** a variável do serviço PostgreSQL no serviço da API, para não copiar senha manualmente.

### 6.1 Abrir as variáveis do serviço da API

1. Com o **serviço da API** selecionado (não o PostgreSQL), abra a aba **"Variables"** (ou **"Environment"** / **"Env"**).

### 6.2 Adicionar referência à DATABASE_URL do PostgreSQL

1. Clique em **"Add Variable"** ou **"New Variable"** (ou **"Raw Editor"** se preferir editar em bloco).
2. Se houver a opção **"Add Reference"** ou **"Reference"** (ícone de link):
   - Clique nela.
   - Selecione o **serviço PostgreSQL** (ex.: "PostgreSQL").
   - Escolha a variável **`DATABASE_URL`** (ou **`DATABASE_PRIVATE_URL`**; o Railway costuma expor ambas; use a que estiver disponível e for a **URL completa**).
   - Salve. O nome da variável no serviço da API deve ser exatamente **`DATABASE_URL`** (para o ERP Prime usar).
3. **Se não houver "Reference":**
   - No serviço **PostgreSQL**, abra **Variables** e **copie** o valor de **`DATABASE_URL`** ou **`DATABASE_PRIVATE_URL`** (URL completa, algo como `postgresql://postgres:xxx@host:5432/railway?sslmode=require`).
   - No serviço da **API**, adicione uma variável manualmente:
     - **Name:** `DATABASE_URL`
     - **Value:** cole a URL copiada.
   - Salve.

### 6.3 Definir USE_POSTGRES

1. Ainda nas variáveis do **serviço da API**, adicione (ou edite):
   - **Name:** `USE_POSTGRES`
   - **Value:** `true`
2. Salve. Sem isso, o backend continua usando SQLite (se existir `DB_PATH`) e ignora o `DATABASE_URL`.

### 6.4 Resumo do vínculo

- O serviço da **API** deve ter:
  - **`DATABASE_URL`** = referência ao Postgres ou valor colado (URL completa).
  - **`USE_POSTGRES`** = `true`.

---

## 7. Variáveis de ambiente obrigatórias

No **serviço da API**, na aba **Variables**, garanta pelo menos as seguintes variáveis (além de `DATABASE_URL` e `USE_POSTGRES`):

| Variável | Valor | Obrigatório |
|----------|--------|-------------|
| `NODE_ENV` | `production` | Sim |
| `JWT_SECRET` | String longa e aleatória (ex.: gere com `openssl rand -hex 32`) | Sim |
| `USE_POSTGRES` | `true` | Sim (para usar Postgres) |
| `DATABASE_URL` | Referência ou URL do Postgres (ver seção 6) | Sim (quando USE_POSTGRES=true) |
| `ALLOWED_ORIGINS` | URL do frontend (ex.: `https://erp-prime.vercel.app`) | Sim (para CORS) |
| `CLIENT_URL` | Mesma URL do frontend | Recomendado |

**Importante:**

- **Não** defina `DB_PATH` quando estiver usando Postgres em produção no Railway (ou o backend pode tentar usar SQLite). O `DATABASE_URL` + `USE_POSTGRES=true` são suficientes.
- **CORS:** Se o front estiver na Vercel, use a URL exata em `ALLOWED_ORIGINS`. Se incluir uma URL `*.vercel.app`, o backend do ERP Prime aceita qualquer deploy de preview da Vercel.

Exemplo (valores fictícios):

```env
NODE_ENV=production
JWT_SECRET=sua-chave-secreta-longa-aleatoria-aqui
USE_POSTGRES=true
DATABASE_URL=postgresql://postgres:senha@containers-us-west-xxx.railway.app:5432/railway?sslmode=require
ALLOWED_ORIGINS=https://erp-prime.vercel.app
CLIENT_URL=https://erp-prime.vercel.app
```

---

## 8. Build e Start do backend

O backend do ERP Prime é em **TypeScript** e precisa ser **compilado** antes de rodar. No Railway isso é feito pelo **Build Command**; o **Start Command** roda o código compilado.

### 8.1 Aba Settings do serviço da API

1. Selecione o **serviço da API**.
2. Abra **Settings** e localize **Build** e **Start** (ou **Deploy**).

### 8.2 Build Command

Defina:

```bash
npm ci --include=dev && npm run build
```

- `npm ci --include=dev` — instala dependências incluindo devDependencies (necessárias para o TypeScript compilar).
- `npm run build` — executa `tsc` e gera a pasta `dist/`.

Se o projeto já tiver **Nixpacks** ou **detecção automática**, confira se o comando de build não está sobrescrito; se estiver, use o comando acima.

### 8.3 Start Command

Defina:

```bash
node dist/src/server.js
```

- O servidor Express sobe a partir do arquivo compilado.

### 8.4 Salvar

Salve as alterações. O Railway usa esses comandos no próximo deploy.

---

## 9. Domínio público e URL da API

Para o frontend (e qualquer cliente) acessar a API, o serviço precisa de um **domínio público**.

### 9.1 Gerar domínio

1. Com o **serviço da API** selecionado, abra **Settings**.
2. Procure a seção **"Networking"** ou **"Public Networking"** ou **"Domains"**.
3. Clique em **"Generate Domain"** (ou **"Add Domain"** → **"Generate"**).
4. O Railway gera um host como: `erp-prime-api-production-xxxx.up.railway.app`

### 9.2 Anotar a URL

1. A URL completa será algo como: **`https://erp-prime-api-production-xxxx.up.railway.app`**
2. **Anote essa URL** (com `https://`). Você vai usá-la em:
   - **VITE_API_URL** no frontend (Vercel).
   - **ALLOWED_ORIGINS** e **CLIENT_URL** no backend (se ainda não tiver usado o domínio do front).

### 9.3 Domínio customizado (opcional)

Se quiser usar um domínio próprio (ex.: `api.seudominio.com.br`), em **Settings** → **Networking** adicione o domínio e configure o CNAME no seu DNS conforme as instruções do Railway.

---

## 10. Primeiro deploy e criação do schema

### 10.1 Disparar o deploy

1. Se você acabou de configurar variáveis e build/start, o Railway pode disparar um **redeploy** automaticamente ao salvar.
2. Caso contrário: **Deployments** → no último deployment **⋮** (três pontos) → **Redeploy**.

### 10.2 O que acontece na subida

1. O Railway roda o **Build Command** (`npm ci --include=dev && npm run build`).
2. Depois roda o **Start Command** (`node dist/src/server.js`).
3. Na **primeira execução** do backend com `USE_POSTGRES=true` e `DATABASE_URL` válida, o ERP Prime:
   - Conecta ao PostgreSQL.
   - Executa o schema completo (arquivo `schema-full.postgres.sql`), criando tabelas, índices e dados iniciais.
   - Sobe o servidor HTTP.

### 10.3 Verificar logs

1. Na aba **Deployments**, clique no deployment em andamento ou no último concluído.
2. Abra **"View Logs"** (ou **Logs**).
3. Procure por mensagens como:
   - `Schema PostgreSQL executado com sucesso`
   - Servidor escutando na porta (ex.: `Listening on port 3000`).
4. Se aparecer erro de conexão ao banco, confira:
   - `DATABASE_URL` no serviço da API (referência ou valor corretto).
   - `USE_POSTGRES=true`.
   - Serviço PostgreSQL ativo no mesmo projeto.

---

## 11. Criar o primeiro usuário (admin)

Com o banco criado e vazio de usuários, é necessário criar o primeiro usuário para acessar o sistema.

### 11.1 Pela tela de registro (recomendado)

1. Abra a URL do **frontend** (ex.: Vercel: `https://erp-prime.vercel.app`).
2. Na tela de login, deve aparecer o link **"Criar conta"** (o sistema permite registro quando não há usuários).
3. Clique em **"Criar conta"** e preencha nome, e-mail e senha.
4. Crie o usuário. Em seguida, faça login.

### 11.2 Tornar o usuário admin

1. Se o primeiro usuário não tiver role admin, você pode:
   - Usar a API (com um token de um admin, se já existir), ou
   - Atualizar direto no banco (Railway não expõe psql no dashboard; use um cliente local com `DATABASE_URL` ou um script de migração que defina `role = 'admin'` para o usuário criado).

Na prática, o fluxo mais simples é: **criar o primeiro usuário pela tela de registro** e, se o sistema permitir escolher role no primeiro cadastro, escolher "admin". Caso contrário, consulte a documentação do ERP Prime sobre "primeiro usuário" ou use a rota de criação de usuário (ex.: script ou API) se houver.

### 11.3 Via API (alternativa)

Se a API estiver no ar e você tiver um cliente HTTP (Postman, curl):

```bash
curl -X POST "https://SUA-URL-API.up.railway.app/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@seudominio.com","password":"SuaSenhaSegura123","role":"admin"}'
```

Substitua `SUA-URL-API` e o domínio completo. O endpoint de registro pode estar desativado após o primeiro usuário; nesse caso, use a tela de registro assim que o front estiver apontando para essa API.

---

## 12. Ligar o frontend (Vercel) ao backend

Para o frontend (Vercel) chamar a API no Railway:

### 12.1 Variável no frontend (Vercel)

1. No projeto do **frontend** na Vercel, vá em **Settings** → **Environment Variables**.
2. Adicione (ou edite):
   - **Key:** `VITE_API_URL`
   - **Value:** `https://erp-prime-api-production-xxxx.up.railway.app` (a URL da API no Railway, **sem** barra no final, **com** `https://`).
3. Marque **Production** (e Preview/Development se quiser).
4. Salve e faça um **novo deploy** do frontend (Deployments → Redeploy), pois variáveis `VITE_*` são injetadas no build.

### 12.2 CORS no backend (Railway)

1. No **serviço da API** no Railway, aba **Variables**.
2. Garanta:
   - **ALLOWED_ORIGINS** = URL do front (ex.: `https://erp-prime.vercel.app`). Se usar múltiplas origens, separe por vírgula.
   - **CLIENT_URL** = mesma URL do front (para links em e-mails, etc.).
3. Salve. O Railway pode redeployar automaticamente.

Depois disso, abra o front na Vercel e teste o login; o navegador deve conseguir chamar a API no Railway sem erro de CORS.

---

## 13. Verificação e troubleshooting

### 13.1 API não responde

- Confira os **Logs** do serviço da API no Railway.
- Verifique se o **Start Command** está correto: `node dist/src/server.js`.
- Confirme se o **Build** terminou sem erro (pasta `dist/` gerada).

### 13.2 Erro de conexão ao banco

- **"DATABASE_URL é obrigatório"** → Defina `USE_POSTGRES=true` e `DATABASE_URL` (referência ou valor) no serviço da API.
- **"connection refused" / "timeout"** → Verifique se o serviço PostgreSQL está ativo; use `DATABASE_PRIVATE_URL` se o Railway recomendar (rede interna).
- **"password authentication failed"** → Não edite manualmente usuário/senha do Postgres no Railway; use a variável que o Railway fornece (referência).

### 13.3 Schema não criou tabelas

- Veja os logs do primeiro deploy; deve aparecer "Schema PostgreSQL executado com sucesso".
- Se o schema já tiver sido executado antes e o banco estiver vazio por outro motivo, você pode rodar manualmente o conteúdo de `src/core/database/schema-full.postgres.sql` em um cliente conectado ao `DATABASE_URL` (por exemplo, via script ou ferramenta local com a mesma URL).

### 13.4 CORS no navegador

- Erro "No 'Access-Control-Allow-Origin' header" → Confira **ALLOWED_ORIGINS** no serviço da API (URL exata do front, com `https://`, sem barra no final).
- Se usar previews da Vercel, inclua uma URL `*.vercel.app` em **ALLOWED_ORIGINS** (o ERP Prime aceita qualquer origem `*.vercel.app` nesse caso).

### 13.5 Frontend chama URL errada

- O front deve usar **VITE_API_URL** com a URL do backend no Railway. Não inclua `/api` no final (o front já concatena). Ex.: `https://erp-prime-api-production-xxxx.up.railway.app`.
- Após alterar **VITE_API_URL**, faça **redeploy** do projeto na Vercel.

---

## 14. Backup do banco PostgreSQL

O Railway não oferece backup automático de banco no plano gratuito. Recomenda-se fazer backup periódico da base.

### 14.1 Obter DATABASE_URL

- No projeto Railway, serviço **PostgreSQL** → **Variables** (ou **Connect**) → copie **`DATABASE_URL`** ou **`DATABASE_PRIVATE_URL`**.

### 14.2 Backup com pg_dump (local)

Com **PostgreSQL client** instalado (ex.: `psql` e `pg_dump` no PATH):

```bash
pg_dump "DATABASE_URL_COPIADA" --no-owner --no-acl -F c -f backup_erp_prime.dump
```

Ou em formato SQL:

```bash
pg_dump "DATABASE_URL_COPIADA" --no-owner --no-acl -f backup_erp_prime.sql
```

Guarde o arquivo em local seguro (ex.: storage, outro servidor). Não commite o arquivo no repositório.

### 14.3 Restaurar (se necessário)

```bash
pg_restore -d "DATABASE_URL_NOVA" --no-owner --no-acl backup_erp_prime.dump
```

Ou, para SQL:

```bash
psql "DATABASE_URL_NOVA" -f backup_erp_prime.sql
```

---

## 15. Resumo rápido (checklist)

- [ ] Conta no Railway (login com GitHub).
- [ ] Projeto criado com serviço do repositório do ERP Prime (backend).
- [ ] Serviço **PostgreSQL** adicionado ao mesmo projeto.
- [ ] No serviço da **API**: variável **`DATABASE_URL`** (referência ao Postgres ou valor colado).
- [ ] No serviço da **API**: variável **`USE_POSTGRES`** = `true`.
- [ ] No serviço da **API**: **Build** = `npm ci --include=dev && npm run build`.
- [ ] No serviço da **API**: **Start** = `node dist/src/server.js`.
- [ ] Variáveis **NODE_ENV**, **JWT_SECRET**, **ALLOWED_ORIGINS**, **CLIENT_URL** definidas.
- [ ] **Domínio público** gerado para o serviço da API; URL anotada.
- [ ] Deploy executado com sucesso; logs mostram "Schema PostgreSQL executado com sucesso".
- [ ] Primeiro usuário criado (tela de registro ou API).
- [ ] Frontend (Vercel) com **VITE_API_URL** = URL da API no Railway; redeploy do front feito.
- [ ] Teste de login no front; sem erro de CORS.

Com isso, o PostgreSQL no Railway está criado, vinculado ao backend do ERP Prime e pronto para uso em produção.
