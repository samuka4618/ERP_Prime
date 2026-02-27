# Deploy completo: ERP Prime (Vercel + Render)

Guia passo a passo para publicar o **frontend** na **Vercel** e o **backend** no **Render**. Siga a ordem indicada.

---

## Índice

1. [Pré-requisitos](#1-pré-requisitos)
2. [Ordem do deploy](#2-ordem-do-deploy)
3. [Parte A: Deploy do backend (Render)](#3-parte-a-deploy-do-backend-render)
4. [Parte B: Deploy do frontend (Vercel)](#4-parte-b-deploy-do-frontend-vercel)
5. [Parte C: Ligar front e back](#5-parte-c-ligar-front-e-back)
6. [Persistência de dados (Render Disk)](#6-persistência-de-dados-render-disk)
7. [Variáveis de ambiente – referência completa](#7-variáveis-de-ambiente--referência-completa)
8. [Domínios customizados](#8-domínios-customizados)
9. [Testes e validação](#9-testes-e-validação)
10. [Problemas comuns e solução](#10-problemas-comuns-e-solução)
11. [Checklist final](#11-checklist-final)

---

## 1. Pré-requisitos

- [ ] **Conta no GitHub** (ou GitLab) com o repositório do ERP Prime.
- [ ] **Conta na Vercel**: [vercel.com](https://vercel.com) → Sign Up (pode usar GitHub).
- [ ] **Conta no Render**: [render.com](https://render.com) → Get Started (pode usar GitHub).
- [ ] Código **commitado e pushed** na branch que será usada no deploy (ex.: `main` ou `master`).
- [ ] **Node.js 18+** instalado localmente (só para testar build antes, se quiser).

---

## 2. Ordem do deploy

1. **Backend primeiro (Render)**  
   Assim você obtém a URL da API (ex.: `https://erp-prime-api.onrender.com`) antes de configurar o front.

2. **Frontend depois (Vercel)**  
   Você configura a variável `VITE_API_URL` com a URL do backend.

3. **Voltar ao Render**  
   Configurar `ALLOWED_ORIGINS` e `CLIENT_URL` com a URL do front na Vercel.

---

## 3. Parte A: Deploy do backend (Render)

### 3.1 Acessar o Render

1. Acesse [dashboard.render.com](https://dashboard.render.com).
2. Faça login (com GitHub, se preferir).

### 3.2 Criar o Web Service

**Opção A – Pelo dashboard (recomendado na primeira vez)**  
1. Clique em **"New +"** (canto superior direito).  
2. Selecione **"Web Service"**.  
3. Se for a primeira vez, **conecte seu repositório** (GitHub/GitLab):
   - Clique em **"Connect account"** ou **"Configure account"**.
   - Autorize o Render a acessar sua organização/repositório.
   - Selecione o repositório **ERP_Prime** (ou o nome que estiver no Git).
4. Clique em **"Connect"** no repositório correto.

**Opção B – Blueprint (render.yaml)**  
Se preferir, você pode usar o arquivo **`render.yaml`** na raiz do repositório: no Render, **New +** → **Blueprint** → conecte o repo. O Render cria o Web Service com base no YAML. Ainda assim será preciso definir manualmente no dashboard as variáveis sensíveis (ex.: `JWT_SECRET`, `ALLOWED_ORIGINS`, `CLIENT_URL`, SMTP, etc.), pois o `render.yaml` não deve conter segredos.

### 3.3 Configurações do serviço

Preencha exatamente como abaixo (ajuste nome se quiser):

| Campo | Valor |
|-------|--------|
| **Name** | `erp-prime-api` (ou outro nome; será a base da URL). |
| **Region** | Escolha a mais próxima dos usuários (ex.: **Oregon (US West)** ou **Frankfurt**). |
| **Branch** | `main` ou a branch que você usa (ex.: `master`). |
| **Root Directory** | Deixe **vazio** (a raiz do repositório já é a pasta do backend). |
| **Runtime** | **Node**. |
| **Plan** | **Free** (para começar; depois pode mudar para pago + disco). |

### 3.4 Build & Start

| Campo | Valor |
|-------|--------|
| **Build Command** | `npm ci --include=dev && npm run build` |
| **Start Command** | `node dist/src/server.js` |

- **`npm ci --include=dev`** — No Render, `NODE_ENV=production` faz o `npm ci` **não** instalar as devDependencies (pacotes `@types/*`). O TypeScript precisa deles para compilar. O flag `--include=dev` garante que as devDependencies sejam instaladas no build.
- O script **build** do `package.json` roda `tsc` e gera a pasta `dist/`.

### 3.5 Variáveis de ambiente

Você pode **importar o .env inteiro** ou **adicionar variáveis uma a uma**.

#### Opção 1: Importar o .env inteiro (recomendado)

1. Na seção **Environment** do Web Service, procure **"Bulk Edit"** ou o botão que abre o editor em massa (às vezes um ícone de tabela ou "Import").
2. Copie **todo o conteúdo** do seu arquivo `.env` local (o que está na raiz do projeto ERP_Prime).
3. Cole no campo de edição em massa. O Render aceita o formato `KEY=valor`, uma variável por linha. Linhas em branco e comentários (`#`) são ignorados.
4. Clique em **"Save Changes"** (ou equivalente).
5. **Depois de importar, edite estas variáveis** (clique no lápis ao lado de cada uma):

| Variável | Ajuste obrigatório em produção |
|----------|---------------------------------|
| `NODE_ENV` | Troque para `production`. |
| `PORT` | **Apague** ou deixe em branco — o Render define automaticamente. |
| `ALLOWED_ORIGINS` | Deixe em branco por enquanto; preencha depois com a URL do front (ex.: `https://erp-prime.vercel.app`). |
| `CLIENT_URL` | Deixe em branco por enquanto; preencha depois com a mesma URL do front. |
| `JWT_SECRET` | **Recomendado:** gere uma nova chave só para produção (ex.: `openssl rand -hex 32`) e substitua o valor atual. |

6. **Revise também** (opcional mas importante):

| Variável | Sugestão para produção |
|----------|-------------------------|
| `DB_SERVER` | Se o SQL Server estiver na sua rede local (ex.: `192.168.14.1`), o Render **não** conseguirá acessar. Remova ou use um servidor acessível pela internet (VPN/túnel). |
| `ATAK_BASE_URL` | Se for `http://192.168.14.13:9010`, o Render não acessa. Ajuste para uma URL pública do Atak, se houver. |
| `USE_NGROK` | Defina como `false` no Render (Ngrok é para expor ambiente local). |
| `DB_PATH`, `UPLOAD_PATH`, `IMAGES_PATH`, `UPLOADS_PATH` | No plano Free podem ficar como estão (ex.: `./data/...`); os dados não persistem. Se ativar [Render Disk](#6-persistência-de-dados-render-disk), troque para `/data/database/chamados.db`, `/data/storage/uploads`, etc. |

**Segurança:** Nunca faça commit do `.env` no Git. Use apenas o arquivo que está na sua máquina para copiar e colar no Render.

**Se aparecer "too long?" no valor de uma variável:** O Render limita o tamanho do valor de cada variável. Isso costuma acontecer quando, ao colar o .env no **Bulk Edit**, uma linha fica quebrada ou várias linhas são interpretadas como um único valor (ex.: tudo depois de `JWT_SECRET=` vira o valor). **Solução:** edite a variável que mostra "too long?" (clique nela), apague o conteúdo e digite só o valor correto em uma linha (ex.: para `JWT_SECRET`, apenas a chave em hex, sem quebras de linha). Se precisar, use **"Add from .env"** de novo com um .env que tenha uma variável por linha, sem valores com quebra de linha.

#### Opção 2: Adicionar variáveis uma a uma

Se preferir não importar o .env:

Clique em **"Add Environment Variable"** e cadastre pelo menos:

| Key | Value | Observação |
|-----|--------|------------|
| `NODE_ENV` | `production` | Obrigatório. |
| `JWT_SECRET` | *(gere uma string longa e aleatória)* | Obrigatório. Ex.: use um gerador ou `openssl rand -hex 32`. |
| `ALLOWED_ORIGINS` | *(deixe em branco por enquanto)* | Será preenchido depois com a URL do front (ex.: `https://seu-app.vercel.app`). |
| `CLIENT_URL` | *(deixe em branco por enquanto)* | Será preenchido depois com a mesma URL do front. |

Depois adicione as demais (SMTP, SQL Server, Atak, CNPJÁ, TESS, Infobip, etc.) conforme a [Seção 7](#7-variáveis-de-ambiente--referência-completa).

---

**Importante:** No plano **Free**, o Render não persiste arquivos entre deploys. Ou seja, SQLite e uploads são perdidos ao redeploy ou após inatividade. Para persistência, veja a [Seção 6](#6-persistência-de-dados-render-disk).

### 3.6 Deploy

Antes de clicar em **"Create Web Service"**, confira se não há erro em nenhum campo (às vezes o Render mostra *"There's an error above"* em vermelho sem destacar o campo). Veja a lista abaixo e a [Seção 10](#10-problemas-comuns-e-solução) (*"Erro 'There's an error above' no Render"*).

1. Clique em **"Create Web Service"**.
2. O Render vai clonar o repositório, rodar `npm ci`, `npm run build` e depois `node dist/src/server.js`.
3. Acompanhe os **Logs**. O primeiro deploy pode levar alguns minutos.
4. Se der erro de build, confira os logs (erro de TypeScript, dependência faltando, etc.).
5. Quando aparecer **"Your service is live at …"**, anote a URL, por exemplo:  
   `https://erp-prime-api.onrender.com`

### 3.7 Testar o backend

No navegador ou com curl:

- Health: `https://SEU-SERVICO.onrender.com/health`
- API base: `https://SEU-SERVICO.onrender.com/api`

Se retornar JSON (ex.: `{"ok":true}` ou lista de rotas), o backend está no ar.

---

## 4. Parte B: Deploy do frontend (Vercel)

### 4.1 Acessar a Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login (com GitHub, se preferir).
2. No dashboard, clique em **"Add New…"** → **"Project"**.

### 4.2 Importar o repositório

1. Selecione o **mesmo repositório** do ERP Prime (GitHub/GitLab).
2. Clique em **"Import"**.

### 4.3 Configurações do projeto

A raiz do repositório contém backend + pasta `frontend/`. O arquivo **`vercel.json`** na raiz já está configurado para buildar apenas o frontend. Use:

| Campo | Valor |
|-------|--------|
| **Project Name** | `erp-prime` ou o nome que preferir (vira parte da URL). |
| **Framework Preset** | **Other** (ou Vite, se aparecer; o Vercel detecta às vezes). |
| **Root Directory** | Deixe **em branco** (raiz). O `vercel.json` usa `cd frontend` no build. |
| **Build Command** | Pode deixar em branco; o `vercel.json` usa: `cd frontend && npm ci && npm run build`. |
| **Output Directory** | Pode deixar em branco; o `vercel.json` usa: `frontend/dist`. |
| **Install Command** | Pode deixar em branco; o `vercel.json` usa: `cd frontend && npm ci`. |

**Alternativa:** Se preferir que a raiz do projeto na Vercel seja a pasta do frontend:

- Defina **Root Directory** = `frontend`.
- **Build Command**: `npm run build`.
- **Output Directory**: `dist`.
- **Install Command**: `npm ci` (ou em branco).

Nesse caso, o `vercel.json` da raiz do repo pode ser ignorado para esse projeto (a Vercel usa as configurações da UI quando Root Directory está definido).

### 4.4 Variáveis de ambiente (Vercel)

Antes de dar Deploy, vá em **Environment Variables** e adicione:

| Key | Value | Environments |
|-----|--------|----------------|
| `VITE_API_URL` | `https://SEU-SERVICO.onrender.com` | Marque **Production**, **Preview** e **Development** (para previews e dev). |

- Troque `SEU-SERVICO` pelo nome real do seu Web Service no Render (ex.: `erp-prime-api`).
- **Não** coloque barra no final (use `https://erp-prime-api.onrender.com`, não `.../`).
- O Vite só injeta variáveis que começam com `VITE_` no bundle; por isso o nome `VITE_API_URL`.
- **Importante:** sempre que alterar `VITE_API_URL` (ou qualquer variável `VITE_*`), é necessário fazer um **novo deploy** do projeto na Vercel (Deployments → ⋮ no último deploy → Redeploy).

### 4.5 Deploy

1. Clique em **"Deploy"**.
2. Aguarde o build (instalação de dependências + `npm run build` no frontend).
3. Ao terminar, a Vercel mostra a URL do projeto, por exemplo:  
   `https://erp-prime.vercel.app`  
   Anote essa URL.

### 4.6 Teste rápido do front

Abra a URL do projeto. Você deve ver a tela de login do ERP Prime. Ainda pode dar erro ao logar se o CORS no backend não estiver configurado — isso é ajustado na Parte C.

---

## 5. Parte C: Ligar front e back

O front (Vercel) precisa poder chamar o back (Render). Isso exige **CORS** e **URL do cliente** no backend.

### 5.1 No Render (backend)

1. Vá no seu **Web Service** no Render.
2. Aba **"Environment"**.
3. Edite ou adicione:

| Key | Value |
|-----|--------|
| `ALLOWED_ORIGINS` | `https://erp-prime.vercel.app` (a URL exata do seu projeto na Vercel, sem barra no final). |
| `CLIENT_URL` | `https://erp-prime.vercel.app` (mesma URL; usada em links de e-mail, por exemplo). |

Se você tiver mais de um domínio (ex.: preview da Vercel e domínio customizado), use vírgula em `ALLOWED_ORIGINS`:

```env
ALLOWED_ORIGINS=https://erp-prime.vercel.app,https://app.seudominio.com.br
```

4. Salve. O Render faz um **redeploy automático** ao alterar variáveis.

### 5.2 Aguardar redeploy e testar

1. Espere o redeploy do Render terminar (status "Live").
2. Abra de novo o front na Vercel e tente **fazer login**.
3. Se der erro de CORS no console do navegador, confira se `ALLOWED_ORIGINS` está exatamente igual à origem do front (protocolo + domínio, sem barra).

---

## 6. Persistência de dados (Render Disk)

No plano **Free**, o sistema de arquivos do Render é **efêmero**: tudo em disco (SQLite, uploads) é perdido em redeploy ou após o serviço “dormir”.

Para **persistir** banco e arquivos:

1. **Plano pago** no Render (ex.: Starter) com **Disk**.
2. No seu Web Service: **Settings** → **Disks** → **Add Disk**:
   - **Name**: `data`
   - **Mount Path**: `/data`
   - **Size**: 1 GB (ou o que precisar).
3. Variáveis de ambiente (ajuste no **Environment**):

```env
DB_PATH=/data/database/chamados.db
UPLOAD_PATH=/data/storage/uploads
IMAGES_PATH=/data/storage/images
UPLOADS_PATH=/data/storage/uploads
```

4. O backend precisa **criar** esses diretórios na primeira subida. No **Start Command** você pode usar:

```bash
mkdir -p /data/database /data/storage/uploads /data/storage/images && node dist/src/server.js
```

Ou garantir no código que esses diretórios existem ao iniciar (já é uma boa prática). Após isso, SQLite e uploads passam a persistir entre deploys.

---

## 7. Variáveis de ambiente – referência completa

### 7.1 Backend (Render)

Todas as variáveis que o backend pode usar, com indicação de uso em produção.

| Variável | Obrigatório | Descrição / Valor sugerido |
|----------|-------------|----------------------------|
| `NODE_ENV` | Sim | `production` |
| `PORT` | Não | Definido automaticamente pelo Render. |
| `JWT_SECRET` | Sim | String longa e aleatória (ex.: `openssl rand -hex 32`). |
| `JWT_EXPIRES_IN` | Não | Ex.: `24h`. |
| **`ALLOWED_ORIGINS`** | **Sim (com front na Vercel)** | URL(s) do front, separadas por vírgula. Ex.: `https://erp-prime.vercel.app`. |
| **`CLIENT_URL`** ou **`FRONTEND_URL`** | **Recomendado** | URL do front (links em e-mails). Ex.: `https://erp-prime.vercel.app`. |
| `DB_PATH` | Sim* | Caminho do SQLite. Sem disco: ex. `./data/database/chamados.db`. Com disco: `/data/database/chamados.db`. |
| `UPLOAD_PATH` | Sim* | Ex.: `./storage/uploads` ou `/data/storage/uploads`. |
| `IMAGES_PATH` | Sim* | Ex.: `./storage/images` ou `/data/storage/images`. |
| `UPLOADS_PATH` | Sim* | Ex.: `./storage/uploads` ou `/data/storage/uploads`. |
| `SMTP_HOST` | Se usar e-mail | Ex.: `smtp.gmail.com`. |
| `SMTP_PORT` | Não | Ex.: `587`. |
| `SMTP_USER` | Se usar e-mail | E-mail do SMTP. |
| `SMTP_PASS` | Se usar e-mail | Senha ou “App Password” do e-mail. |
| `SMTP_FROM` | Não | Nome e e-mail do remetente. |
| `SLA_FIRST_RESPONSE` | Não | Número (horas). |
| `SLA_RESOLUTION` | Não | Número (horas). |
| `REOPEN_DAYS` | Não | Número (dias). |
| `MAX_FILE_SIZE` | Não | Em bytes. Ex.: `10485760` (10 MB). |
| `ALLOWED_FILE_TYPES` | Não | Ex.: `pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif,zip,rar`. |
| **SQL Server (cadastros)** | | |
| `DB_SERVER` | Se usar SQL Server | Host do SQL Server. Em nuvem precisa ser acessível pela internet (VPN/túnel). |
| `DB_DATABASE` | Se usar | Nome do banco. |
| `DB_USER` | Se usar | Usuário. |
| `DB_PASSWORD` | Se usar | Senha. |
| `DB_PORT` | Não | Ex.: `1433`. |
| `DB_ENCRYPT` | Não | Ex.: `false`. |
| `DB_TRUST_CERT` | Não | Ex.: `true`. |
| **Atak** | | |
| `ATAK_BASE_URL` | Se usar | URL base da API Atak. |
| `ATAK_USERNAME` / `ATAK_PASSWORD` ou `ATAK_TOKEN` | Se usar | Autenticação Atak. |
| **CNPJÁ** | | |
| `CNPJA_API_KEY` | Se usar | Chave da API. |
| `CNPJA_BASE_URL` | Não | Ex.: `https://api.cnpja.com`. |
| **TESS AI** | | |
| `TESS_API_KEY`, `TESS_BASE_URL`, etc. | Se usar | Conforme documentação TESS. |
| **Infobip (SMS)** | | |
| `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_SENDER` | Se usar | Para SMS no módulo descarregamento. |
| **Outros** | | |
| `LOG_PATH` | Não | Ex.: `./logs`. |
| `SYSTEM_NAME` | Não | Nome do sistema em e-mails. Ex.: `ERP PRIME`. |
| `USE_NGROK` | Não | Em produção no Render normalmente `false`. |
| `DISABLE_RATE_LIMIT` | Não | Em produção deixe `false`. |
| `DEBUG` | Não | Em produção deixe `false`. |

\* Em produção com disco, use os paths em `/data/...`; sem disco, o app sobe mas dados não persistem.

### 7.2 Frontend (Vercel)

| Variável | Obrigatório (produção) | Descrição |
|----------|-------------------------|-----------|
| `VITE_API_URL` | Sim (front e back em hosts diferentes) | URL base do backend, **sem barra no final**. Ex.: `https://erp-prime-api.onrender.com`. |

Opcional (desenvolvimento local):

| Variável | Uso |
|----------|-----|
| `VITE_BACKEND_PORT` | Porta do backend em dev (padrão `3004`). |

---

## 8. Domínios customizados

### 8.1 Backend (Render)

1. No Web Service: **Settings** → **Custom Domains** → **Add Custom Domain**.
2. Informe o domínio (ex.: `api.seudominio.com.br`).
3. Siga as instruções do Render para criar o registro CNAME (ou A) no seu DNS.
4. Depois de ativo, use essa URL em `VITE_API_URL` no front e inclua em `ALLOWED_ORIGINS` e `CLIENT_URL` se for o mesmo domínio do front.

### 8.2 Frontend (Vercel)

1. No projeto: **Settings** → **Domains** → **Add**.
2. Digite o domínio (ex.: `app.seudominio.com.br`).
3. Configure no seu provedor de DNS conforme a Vercel indicar (CNAME ou A).
4. Atualize no Render: `ALLOWED_ORIGINS` e `CLIENT_URL` com esse domínio.

---

## 9. Testes e validação

Após o deploy:

1. **Frontend**
   - Abrir a URL da Vercel.
   - Tela de login carrega.
   - Console do navegador (F12) sem erros de rede/CORS.

2. **Login**
   - Fazer login com um usuário existente (ou criar um antes, se tiver rota de registro).
   - Verificar redirecionamento para o dashboard.

3. **API**
   - Chamadas a listagens (chamados, usuários, etc.) retornando dados.
   - Upload de arquivo (se usar) funcionando.

4. **E-mail**
   - Se configurou SMTP, testar “Esqueci a senha” ou envio de notificação para conferir `CLIENT_URL` nos links.

5. **WebSocket / SSE**
   - Se o sistema usa tempo real (notificações, atualização de chamados), testar abrindo duas abas e verificando se atualiza.

---

## 10. Problemas comuns e solução

| Problema | Causa provável | Solução |
|----------|-----------------|--------|
| **"There's an error above. Please fix it to continue."** (Render não mostra onde) | Algum campo obrigatório acima do aviso está vazio ou inválido. | **Confira de cima para baixo:** (1) **Repositório** — está conectado e a **branch** (ex.: `main`) está selecionada? (2) **Name** — preenchido (ex.: `erp-prime-api`)? (3) **Build Command** — exatamente `npm ci && npm run build`. (4) **Start Command** — exatamente `node dist/src/server.js`. (5) **Environment** — se usou Bulk Edit com o .env, não pode ter linha com só `KEY=` sem valor; variáveis vazias às vezes dão erro: remova ou preencha. (6) **Plan** — selecione **Free** se a página pedir. Role a tela inteira e verifique cada seção. |
| **Variável com "too long?" no valor** (ex.: JWT_SECRET) | O valor colado ficou grande demais ou várias linhas do .env foram interpretadas como um único valor. | Clique na variável, apague o conteúdo do valor e digite **apenas** o valor correto em uma linha (ex.: para `JWT_SECRET`, só a chave em hex). Se usou "Add from .env", confira se no arquivo não há valores com quebra de linha; no .env cada variável deve ser `KEY=valor` em uma única linha. |
| Erro de CORS no navegador | Front em um domínio e back em outro sem CORS | Garantir `ALLOWED_ORIGINS` no Render com a URL **exata** do front (incluindo `https://`), sem barra no final. Redeploy do backend. |
| "Failed to fetch" / rede | URL da API errada ou backend fora do ar | Verificar `VITE_API_URL` na Vercel. Testar no navegador: `https://SEU-BACKEND.onrender.com/health`. No plano Free, o serviço “acorda” após alguns segundos. |
| Build do front falha na Vercel | Comando ou pasta errada | Se **Root Directory** estiver vazio, o `vercel.json` deve comandar `cd frontend && npm ci && npm run build` e output `frontend/dist`. Ou defina Root = `frontend`, Build = `npm run build`, Output = `dist`. |
| Build do back falha no Render (erros "Could not find a declaration file for module 'express'") | Com `NODE_ENV=production`, o `npm ci` não instala devDependencies; o `tsc` precisa dos `@types/*`. | Use **Build Command**: `npm ci --include=dev && npm run build`. Veja a [Seção 3.4](#34-build--start). |
| Build do back falha no Render (outros erros TS ou dependência) | Erro de TypeScript ou dependência | Ver logs no Render. Rodar localmente `npm ci && npm run build` na raiz. Corrigir erros e dar push. |
| Login não funciona / 401 | JWT ou cookie/origem | Confirmar `JWT_SECRET` definido no Render. Verificar se `ALLOWED_ORIGINS` inclui a origem do front e se `withCredentials`/cookies estão corretos no front. |
| Dados sumiram após redeploy | Plano Free sem disco | Normal no Free. Para persistir, ativar Render Disk e configurar `DB_PATH` e paths de upload em `/data/...` (Seção 6). |
| SQL Server não conecta | Backend na nuvem, SQL na rede local | O Render não acessa sua rede. Opções: expor o SQL Server (com segurança/VPN), ou usar um banco na nuvem para esses dados. |

---

## 11. Checklist final

- [ ] Backend no Render: serviço **Live**, URL anotada.
- [ ] Variáveis do backend: `NODE_ENV`, `JWT_SECRET`, `ALLOWED_ORIGINS`, `CLIENT_URL` (e as que você usa: SMTP, DB_PATH, etc.).
- [ ] Frontend na Vercel: projeto deployado, URL anotada.
- [ ] Variável do front: `VITE_API_URL` = URL do backend (sem barra no final).
- [ ] CORS: `ALLOWED_ORIGINS` = URL do front (e de outros domínios, se houver).
- [ ] Teste de login e navegação no front.
- [ ] (Opcional) Persistência: Render Disk + paths em `/data/...` e Start Command criando pastas.
- [ ] (Opcional) Domínios customizados configurados e refletidos em `VITE_API_URL`, `ALLOWED_ORIGINS` e `CLIENT_URL`.

Com isso, o deploy do ERP Prime com front na Vercel e back no Render está completo e atualizado.
