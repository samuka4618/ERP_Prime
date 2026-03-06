# Passo a passo: Backend local + Frontend no Railway + Cloudflare Tunnel

Este guia descreve **do zero** como configurar o ERP Prime com:

- **Backend** rodando na sua máquina (localhost)
- **Frontend** publicado no **Railway**
- **Cloudflare Tunnel** expondo o backend local para a internet, para o frontend no Railway conseguir chamar a API

Não é necessário abrir portas no roteador. Você pode usar **dois tipos** de túnel:

| Ambiente | Tipo de túnel | URL | Quando usar |
|----------|----------------|-----|-------------|
| **Teste** | **Quick Tunnel** (TryCloudflare) | URL **muda** a cada reinício (ex.: `https://xxxx.trycloudflare.com`) | Desenvolvimento e testes rápidos; não exige conta Cloudflare |
| **Produção** | **Túnel gerenciado** (nome fixo) | URL **fixa** (ex.: `https://api.seudominio.com`) | Uso contínuo; exige conta Cloudflare e domínio adicionado à Cloudflare |

O guia cobre os dois: primeiro o **Quick Tunnel** (teste) e, em seguida, o **túnel gerenciado** (produção).

---

## Índice

### Parte A – Teste (Quick Tunnel)

1. [Visão geral e pré-requisitos](#1-visão-geral-e-pré-requisitos)
2. [Instalar o cloudflared (Cloudflare Tunnel)](#2-instalar-o-cloudflared-cloudflare-tunnel)
3. [Preparar o backend local](#3-preparar-o-backend-local)
4. [Iniciar o túnel (teste) e anotar a URL](#4-iniciar-o-túnel-teste-e-anotar-a-url)
5. [Deploy do frontend no Railway](#5-deploy-do-frontend-no-railway)
6. [Configurar CORS e PUBLIC_URL no backend](#6-configurar-cors-e-public_url-no-backend)
7. [Variáveis do frontend (VITE_API_URL)](#7-variáveis-do-frontend-vite_api_url)
8. [Testar o fluxo completo](#8-testar-o-fluxo-completo)
9. [Manter o túnel rodando](#9-manter-o-túnel-rodando)

### Parte B – Produção (túnel gerenciado, URL fixa)

10. [Túnel gerenciado para produção](#10-túnel-gerenciado-para-produção)

### Final

11. [Troubleshooting](#11-troubleshooting)
12. [Checklist resumido](#12-checklist-resumido)

---

## 1. Visão geral e pré-requisitos

### O que você vai ter ao final

| Componente      | Onde roda        | Acesso |
|-----------------|------------------|--------|
| **Backend (API)** | Sua máquina      | Exposto na internet via Cloudflare Tunnel (Quick Tunnel: URL variável; Produção: URL fixa) |
| **Frontend**      | Railway          | URL do Railway (ex.: `https://erp-prime-frontend.up.railway.app`) |
| **Banco de dados** | Local (SQLite) ou remoto (ex.: PostgreSQL no Railway) | Acessado apenas pelo backend |

O navegador abre o frontend no Railway; o frontend chama a API usando a URL do túnel. O túnel encaminha as requisições para o backend na sua máquina.

### Pré-requisitos (comuns)

- **Node.js** 16+ e **npm** na máquina onde o backend rodará
- **Conta no GitHub** com o repositório do ERP Prime
- **Conta no Railway** (login com GitHub): [railway.app](https://railway.app)
- **Repositório** do ERP Prime no GitHub (código atualizado)

Para **teste** (Parte A): não é obrigatório ter conta na Cloudflare.  
Para **produção** (Parte B): é necessário **conta na Cloudflare** e um **domínio** adicionado à Cloudflare (para ter URL fixa).

### Teste vs Produção

| | **Teste (Quick Tunnel)** | **Produção (túnel gerenciado)** |
|--|---------------------------|----------------------------------|
| **URL** | Muda a cada reinício | Fixa (ex.: `https://api.seudominio.com`) |
| **Conta Cloudflare** | Não obrigatória | Obrigatória |
| **Domínio** | Não precisa | Domínio adicionado à Cloudflare |
| **Limite** | ~200 req. simultâneas; sem SSE | Sem esse limite; suporta SSE/WebSocket |
| **Uso** | Desenvolvimento e testes | Uso contínuo, pode rodar como serviço |

### Limitações do Quick Tunnel (TryCloudflare) – só teste

- A URL do túnel **muda** cada vez que você reinicia o `cloudflared`.
- Quick Tunnels têm limite de **200 requisições simultâneas** e **não suportam Server-Sent Events (SSE)**. Para produção ou SSE/WebSocket, use o **túnel gerenciado** (Parte B).

---

## 2. Instalar o cloudflared (Cloudflare Tunnel)

O **cloudflared** é o cliente oficial do Cloudflare Tunnel. Instale na máquina onde o backend vai rodar.

### 2.1 Windows

**Opção A – winget (recomendado)**

1. Abra o **Terminal** (PowerShell ou Prompt de Comando).
2. Execute:
   ```powershell
   winget install --id Cloudflare.cloudflared
   ```
3. Feche e reabra o terminal. Teste: `cloudflared --version`.

**Opção B – Download manual**

1. Acesse: [Releases do cloudflared no GitHub](https://github.com/cloudflare/cloudflared/releases).
2. Baixe **cloudflared-windows-amd64.exe** (ou 386 se for 32 bits).
3. Renomeie para `cloudflared.exe` e coloque em uma pasta que esteja no **PATH** (ex.: `C:\Windows` ou crie uma pasta e adicione ao PATH).
4. No terminal: `cloudflared --version`.

### 2.2 macOS

**Opção A – Homebrew (recomendado)**

```bash
brew install cloudflared
```

**Opção B – Download manual**

1. Em [Releases do cloudflared](https://github.com/cloudflare/cloudflared/releases), baixe o `.tgz` ou `.pkg` para **Darwin** (arm64 para Apple Silicon, amd64 para Intel).
2. Instale e garanta que o executável está no PATH. Teste: `cloudflared --version`.

### 2.3 Linux

**Debian/Ubuntu (repositório Cloudflare)**

```bash
# Adicionar chave e repositório (consulte a doc oficial se o comando mudar)
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /etc/apt/keyrings/cloudflare.gpg >/dev/null
echo "deb [signed-by=/etc/apt/keyrings/cloudflare.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

**Outras distros / binário direto**

1. Em [Releases do cloudflared](https://github.com/cloudflare/cloudflared/releases), baixe o binário para Linux (amd64, arm64, etc.).
2. Coloque em um diretório no PATH (ex.: `/usr/local/bin`) e torne executável: `chmod +x cloudflared`.
3. Teste: `cloudflared --version`.

**Documentação oficial de instalação:** [Cloudflare – Downloads (cloudflared)](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).

---

## 3. Preparar o backend local

Na pasta raiz do projeto ERP Prime (onde está o `package.json` do backend):

### 3.1 Dependências e build

```bash
npm run install:all
npm run build
npm run migrate
```

(Se já tiver feito isso, pode pular.)

### 3.2 Arquivo `.env`

Use o `.env` da raiz. Garanta pelo menos:

- **`PORT`** – Porta em que o backend sobe (ex.: `3000` ou `3004`). O túnel vai apontar para `http://localhost:PORT`.
- **`JWT_SECRET`** – Chave para JWT.
- Banco: **SQLite** (`DB_PATH`) ou **PostgreSQL** (`USE_POSTGRES=true` e `DATABASE_URL`).

Para o frontend no Railway conseguir acessar o backend via túnel e para formulários/QR codes usarem a URL pública:

- **`PUBLIC_URL`** – Será a URL do túnel que você vai anotar no próximo passo (ex.: `https://abc123.trycloudflare.com`). Assim o backend não redireciona HTTPS→HTTP quando a requisição vier desse host e os links de formulário/QR usam essa URL.
- **`ALLOWED_ORIGINS`** – URL do frontend no Railway (ex.: `https://erp-prime-frontend.up.railway.app`). Pode ser mais de uma, separadas por vírgula.

Exemplo (ajuste depois com a URL real do túnel e do front):

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=sua_chave_secreta_aqui
PUBLIC_URL=https://SEU-SUBDOMINIO.trycloudflare.com
ALLOWED_ORIGINS=https://seu-frontend.up.railway.app
```

Você pode preencher `PUBLIC_URL` e `ALLOWED_ORIGINS` depois de ter a URL do túnel e do frontend (passos 4 e 5).

### 3.3 Iniciar o backend

Em um terminal, na raiz do projeto:

```bash
npm run start:server
```

Ou, se preferir sem Nginx/Ngrok:

```bash
node dist/src/server.js
```

Deixe esse terminal aberto. O backend deve estar acessível em `http://localhost:PORT` (ex.: `http://localhost:3000`). Confira no navegador: `http://localhost:3000/health` ou `http://localhost:3000/api/health` (conforme a rota do seu projeto).

---

## 4. Iniciar o túnel (teste) e anotar a URL

Em **outro** terminal (na mesma máquina):

```bash
cloudflared tunnel --url http://localhost:3000
```

Substitua `3000` pela porta definida em `PORT` no `.env`.

O **cloudflared** vai:

1. Conectar ao Cloudflare
2. Gerar uma URL pública (ex.: `https://abc-def-123.trycloudflare.com`)
3. Mostrar essa URL no terminal

Exemplo de saída:

```
Your quick Tunnel has been created! Visit it at:
https://abc-def-123.trycloudflare.com
```

**Anote essa URL.** Você vai usar em:

- **`PUBLIC_URL`** no `.env` do backend
- **`VITE_API_URL`** no frontend no Railway (a mesma URL, sem barra no final)

Depois de configurar o `.env`, reinicie o backend (Ctrl+C e `npm run start:server` de novo) para carregar `PUBLIC_URL` e `ALLOWED_ORIGINS`.

Deixe o **cloudflared** rodando enquanto quiser que o backend local esteja acessível pela internet. Se fechar o terminal, o túnel cai e a URL deixa de funcionar (e na próxima vez que rodar, a URL será outra).

---

## 5. Deploy do frontend no Railway

O frontend do ERP Prime fica na pasta **`frontend`** do repositório (React + Vite). No Railway você vai criar um **serviço** que faz o build dessa pasta e serve os arquivos estáticos.

### 5.1 Criar projeto e serviço

1. Acesse [dashboard.railway.app](https://dashboard.railway.app) e faça login (GitHub).
2. Clique em **New Project**.
3. Escolha **Deploy from GitHub repo**.
4. Se for a primeira vez, conecte o GitHub e autorize o Railway. Selecione o repositório **ERP_Prime** (ou o nome do seu repo).
5. Ao criar o projeto, o Railway pode adicionar um serviço ligado ao repositório. Se esse serviço for o **backend**, você pode deixá-lo desligado ou removê-lo e criar um **novo** serviço só para o frontend. O importante é ter **um serviço que aponte para a pasta `frontend`**.

### 5.2 Configurar o serviço do frontend

1. Clique no **serviço** que vai ser o frontend (ou crie um novo: **+ New** → **GitHub Repo** → mesmo repositório).
2. Abra **Settings** (ou **Variables** / **Settings** conforme a interface).
3. Defina:

| Configuração      | Valor |
|-------------------|--------|
| **Root Directory** | `frontend` |
| **Build Command**  | `npm install && npm run build` (ou apenas `npm run build` se o Railway já rodar `npm install`) |
| **Start Command**  | `npx serve -s dist -l $PORT` |
| **Watch Paths** (se existir) | `frontend/**` (opcional, para redeploy só quando algo em `frontend` mudar) |

O Railway define a variável **`PORT`** automaticamente. O comando `npx serve -s dist -l $PORT` serve a pasta `dist` (saída do `vite build`) como site estático na porta correta.

Se a interface do Railway tiver apenas **Build** e **Start** genéricos, use os mesmos valores acima. Em alguns casos o Build Command pode aparecer como **Nixpacks** ou **Custom**; informe o Root Directory como `frontend` e o comando de build como `npm run build`.

### 5.3 Gerar domínio público

1. No mesmo serviço (frontend), vá em **Settings** → **Networking** (ou **Public Networking**).
2. Clique em **Generate Domain** (ou **Add Domain**).
3. O Railway vai gerar uma URL como `https://nomedoservico-production-xxxx.up.railway.app`.
4. **Copie essa URL** – essa é a URL do **frontend**. Você vai usá-la em **`ALLOWED_ORIGINS`** e **`CLIENT_URL`** no backend (passo 6). A URL da **API** (para o frontend chamar) é a do **túnel** (passo 4), que será usada em **`VITE_API_URL`** no frontend (passo 7).

Resumo:

- **URL do frontend (Railway)** → use em `ALLOWED_ORIGINS` e `CLIENT_URL` no backend.
- **URL do túnel (Cloudflare)** → use em `PUBLIC_URL` no backend e em `VITE_API_URL` no frontend (Railway).

### 5.4 Deploy

1. Dê **Deploy** (ou aguarde o deploy automático após o push).
2. Espere o build terminar. Se o Start Command estiver correto, ao abrir o domínio público você verá a tela do ERP Prime (login, etc.), mas ainda **sem** API configurada – isso será ajustado com **VITE_API_URL** no próximo passo.

---

## 6. Configurar CORS e PUBLIC_URL no backend

No seu **.env** (backend local), confira:

```env
# URL do túnel (a que o cloudflared mostrou no passo 4)
PUBLIC_URL=https://SEU-SUBDOMINIO.trycloudflare.com

# URL do frontend no Railway (exatamente como aparece no navegador, sem barra no final)
ALLOWED_ORIGINS=https://nomedoservico-production-xxxx.up.railway.app

# Obrigatório quando o front está no Railway: URL do front para links de formulário e QR code.
# Sem isso, os links saem com a URL da API (túnel) e não abrem a página do formulário.
CLIENT_URL=https://nomedoservico-production-xxxx.up.railway.app
```

Reinicie o backend local (Ctrl+C no terminal do backend e rodar de novo `npm run start:server`) para aplicar as variáveis.

---

## 7. Variáveis do frontend (VITE_API_URL)

O frontend precisa saber **qual é a URL da API**. Como a API está atrás do Cloudflare Tunnel, essa URL é a do túnel.

1. No Railway, no **serviço do frontend**, vá em **Variables** (ou **Settings** → **Environment Variables**).
2. Adicione:

| Nome           | Valor |
|----------------|--------|
| **VITE_API_URL** | `https://SEU-SUBDOMINIO.trycloudflare.com` |

Use a **mesma** URL que você anotou no passo 4 (e que está em `PUBLIC_URL`). **Sem** barra no final. **Com** `https://`.

3. Salve. O Railway costuma fazer **redeploy** automático ao alterar variáveis. Se não fizer, dispare um **Redeploy** manual (Deployments → último deploy → Redeploy).

Importante: variáveis que começam com **VITE_** são injetadas no build. Por isso, após alterar **VITE_API_URL**, é necessário um **novo deploy** (build de novo) para o front passar a usar a nova URL.

---

## 8. Testar o fluxo completo

1. **Backend** rodando localmente (`npm run start:server`).
2. **cloudflared** rodando com `cloudflared tunnel --url http://localhost:PORT`.
3. **Frontend** no Railway já deployado, com **VITE_API_URL** = URL do túnel e **ALLOWED_ORIGINS** / **PUBLIC_URL** no backend.

Abra no navegador a **URL do frontend no Railway**. Você deve ver a tela de login. Faça login com um usuário já criado (ou crie o primeiro usuário pela tela de registro, se estiver habilitado).

- Se der erro de **CORS**, confira **ALLOWED_ORIGINS** (URL exata do front, com `https://`, sem barra no final).
- Se der erro de **rede** ou **Failed to fetch**, confira se o túnel está de pé e se **VITE_API_URL** está igual à URL que o `cloudflared` mostrou e se você fez redeploy do frontend após definir **VITE_API_URL**.

---

## 9. Manter o túnel rodando (teste)

- **Quick Tunnel:** enquanto o comando `cloudflared tunnel --url http://localhost:PORT` estiver rodando, o túnel fica ativo. Ao fechar o terminal, o túnel cai.
- A **URL muda** cada vez que você sobe o túnel de novo. Sempre que mudar, atualize no backend **PUBLIC_URL** e no frontend (Railway) **VITE_API_URL** e faça redeploy do frontend.
- Para **produção** com URL fixa e túnel estável, use o **túnel gerenciado** descrito na [seção 10](#10-túnel-gerenciado-para-produção).

---

## 10. Túnel gerenciado para produção

Para **produção**, use um **túnel gerenciado** na Cloudflare: a URL fica **fixa** (ex.: `https://api.seudominio.com`), não muda ao reiniciar o `cloudflared`, e você pode rodar o túnel como serviço (início com o sistema). É necessário ter **conta na Cloudflare** e um **domínio** adicionado à Cloudflare.

### 10.1 Pré-requisitos para produção

- **Conta na Cloudflare:** [dash.cloudflare.com](https://dash.cloudflare.com) (cadastro gratuito).
- **Domínio na Cloudflare:** você precisa **adicionar um site/domínio** à Cloudflare (ex.: `seudominio.com` ou um subdomínio gratuito). Se ainda não tiver:
  1. No dashboard da Cloudflare, clique em **Add a site**.
  2. Informe o domínio e siga o assistente (alterar nameservers no registrador ou adicionar registros DNS conforme indicado).
  - Documentação: [Add a site to Cloudflare](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/).

### 10.2 Onde criar o túnel

A Cloudflare oferece duas interfaces para túneis; use uma delas:

- **Cloudflare Zero Trust (recomendado para túneis):** [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks** → **Connectors** → **Cloudflare Tunnels**.
- **Dashboard principal:** [dash.cloudflare.com](https://dash.cloudflare.com) → **Networking** (ou seu site) → **Tunnels** (se disponível na sua conta).

Os passos abaixo descrevem o fluxo no **Zero Trust**; no dashboard principal o fluxo é parecido (Create tunnel → nome → conector Cloudflared → configurar hostname).

### 10.3 Criar o túnel e obter o comando de instalação

1. Acesse [Cloudflare Zero Trust](https://one.dash.cloudflare.com) e faça login.
2. Vá em **Networks** → **Connectors** → **Cloudflare Tunnels** (ou **Tunnels** no menu).
3. Clique em **Create a tunnel** (ou **Add a tunnel**).
4. Escolha o conector **Cloudflared** e avance.
5. **Nome do túnel:** use um nome que identifique o uso (ex.: `erp-prime-api`). Clique em **Save tunnel**.
6. Na tela seguinte, o Cloudflare mostra um **comando de instalação** para o seu sistema (Windows, macOS ou Linux), no formato:
   ```bash
   cloudflared tunnel run --token <TOKEN_LONGO>
   ```
7. **Copie esse comando** (ou apenas o valor de `--token`). Você vai usá-lo para iniciar o túnel na sua máquina. Não compartilhe o token.

### 10.4 Configurar o hostname público (Public hostname)

Antes de rodar o túnel, é preciso dizer qual URL pública vai apontar para o seu backend local.

1. Na mesma tela do túnel (ou em **Configure** / **Public Hostname** / **Published applications**), adicione um **Public Hostname** (ou “Public application” / “Published application”).
2. Preencha:
   - **Subdomain:** por exemplo `api` ou `erp-api` (o que você quiser; será a primeira parte da URL).
   - **Domain:** selecione no dropdown o **domínio** que você adicionou à Cloudflare (ex.: `seudominio.com`).
   - **Service type:** **HTTP**.
   - **URL:** `http://localhost:3000` (ou a porta que o backend usa – a mesma do `PORT` no seu `.env`).
3. Salve (**Save** / **Save tunnel**).

A URL pública do backend será então **`https://api.seudominio.com`** (ou o subdomínio que você escolheu). Essa URL **não muda** quando você reinicia o `cloudflared`.

### 10.5 Rodar o túnel na sua máquina

1. Na máquina onde o **backend** roda, abra um terminal.
2. Execute o comando que você copiou no passo 10.3, por exemplo:
   ```bash
   cloudflared tunnel run --token SEU_TOKEN_AQUI
   ```
3. O túnel deve conectar e aparecer como **Healthy** (ou **Active**) no dashboard da Cloudflare. Deixe esse terminal aberto enquanto quiser o backend acessível pela URL fixa.

### 10.6 Usar a URL fixa no ERP Prime

1. **Backend (.env):**
   - **PUBLIC_URL** = a URL fixa que você configurou (ex.: `https://api.seudominio.com`).
   - **ALLOWED_ORIGINS** = URL do frontend no Railway (ex.: `https://seu-frontend.up.railway.app`).
2. **Frontend (Railway):** variável **VITE_API_URL** = mesma URL fixa (ex.: `https://api.seudominio.com`), **sem** barra no final. Faça **redeploy** do frontend após alterar.
3. Reinicie o backend local para carregar o novo `PUBLIC_URL`.

A partir daí, o frontend no Railway usa sempre a mesma URL da API; não é preciso atualizar nada quando o túnel reinicia.

### 10.7 Rodar o túnel como serviço (opcional, produção)

Para o túnel subir automaticamente com o sistema e não depender de um terminal aberto:

- **Windows:** você pode criar uma tarefa agendada (Task Scheduler) que execute `cloudflared tunnel run --token SEU_TOKEN` ao logar ou ao iniciar o sistema. Ou instalar o cloudflared como serviço (documentação Cloudflare).
- **Linux (systemd):** crie um serviço, por exemplo `/etc/systemd/system/cloudflared.service`, com:
  ```ini
  [Unit]
  Description=Cloudflare Tunnel ERP Prime
  After=network.target

  [Service]
  Type=simple
  ExecStart=/usr/bin/cloudflared tunnel run --token SEU_TOKEN_AQUI
  Restart=on-failure
  RestartSec=5

  [Install]
  WantedBy=multi-user.target
  ```
  Depois: `sudo systemctl daemon-reload`, `sudo systemctl enable cloudflared`, `sudo systemctl start cloudflared`.
- **macOS:** use launchd ou um script que rode o comando ao login.

Documentação oficial: [Cloudflare Tunnel – Get started](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/), [Create a tunnel (dashboard)](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/).

---

## 11. Troubleshooting

### Erro de CORS no navegador

- **ALLOWED_ORIGINS** no `.env` do backend deve ser **exatamente** a origem do frontend (ex.: `https://seu-app.up.railway.app`), com `https://` e **sem** barra no final.
- Reinicie o backend após alterar o `.env`.

### Frontend não carrega / 404 no Railway

- Confirme **Root Directory** = `frontend` e **Start Command** = `npx serve -s dist -l $PORT`.
- Veja os **logs** do serviço no Railway para erros de build ou de start.

### "Failed to fetch" / API não responde

- Confirme que o **backend** está rodando localmente e que o **cloudflared** está ativo.
- Teste no navegador: abra **PUBLIC_URL** (ex.: `https://xxx.trycloudflare.com`) e veja se aparece alguma resposta (ex.: rota `/health` ou mensagem do servidor). Se não abrir, o túnel ou o backend estão inacessíveis.
- Confirme **VITE_API_URL** no Railway = URL do túnel (sem barra no final) e que você fez **redeploy** do frontend depois de definir essa variável.

### URL do túnel mudou

- Atualize no backend: **PUBLIC_URL**.
- No Railway (frontend): **VITE_API_URL** e rode um novo deploy.
- Reinicie o backend.

### Formulários públicos / QR code com URL errada

- Com **front no Railway e API no túnel**, os links do formulário devem abrir no **front** (Railway), não na API. Defina **CLIENT_URL** (ou **FRONTEND_URL**) no `.env` do backend com a URL do frontend (ex.: `https://seu-app.up.railway.app`). O sistema prioriza CLIENT_URL para gerar links de formulário e QR code.
- Se front e back estiverem no mesmo servidor/túnel, **PUBLIC_URL** continua sendo usada para esses links.

---

## 12. Checklist resumido

### Teste (Quick Tunnel)

- [ ] **cloudflared** instalado e no PATH (`cloudflared --version`).
- [ ] Backend local: `.env` com **PORT**, **JWT_SECRET**, **PUBLIC_URL** (URL do túnel), **ALLOWED_ORIGINS** (URL do front no Railway).
- [ ] Backend rodando: `npm run start:server` (ou `node dist/src/server.js`).
- [ ] Túnel (teste) rodando: `cloudflared tunnel --url http://localhost:PORT`; URL anotada.
- [ ] Railway: serviço do **frontend** com **Root Directory** = `frontend`, **Build** = `npm run build`, **Start** = `npx serve -s dist -l $PORT`.
- [ ] Railway: domínio público gerado para o frontend; URL anotada.
- [ ] Railway (frontend): variável **VITE_API_URL** = URL do túnel (sem barra no final); redeploy feito.
- [ ] Teste: abrir a URL do frontend no Railway e fazer login.

### Produção (túnel gerenciado)

- [ ] Conta Cloudflare e domínio adicionado à Cloudflare.
- [ ] Túnel criado no Zero Trust (ou dashboard) e **Public Hostname** configurado (HTTP → `localhost:PORT`).
- [ ] Comando `cloudflared tunnel run --token ...` copiado; túnel rodando (ou configurado como serviço).
- [ ] **PUBLIC_URL** e **VITE_API_URL** com a URL fixa (ex.: `https://api.seudominio.com`); backend reiniciado e frontend com redeploy.

Com isso, o frontend no Railway usa o backend local via Cloudflare Tunnel (teste com Quick Tunnel ou produção com túnel gerenciado). Para um fluxo com backend e banco também na nuvem, veja [DEPLOY.md](../DEPLOY.md) e [RAILWAY_POSTGRES_PASSO_A_PASSO.md](RAILWAY_POSTGRES_PASSO_A_PASSO.md).
