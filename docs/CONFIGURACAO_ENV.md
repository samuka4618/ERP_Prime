# Guia de Configuração do .env

Este documento explica como configurar o arquivo `.env` do ERP PRIME.

> **Contexto:** variáveis adicionais (satélite Railway, Postgres, etc.) estão descritas no **[MANUAL_COMPLETO_ERP_PRIME.md](./MANUAL_COMPLETO_ERP_PRIME.md)** (secção de configuração) e no ficheiro **`.env.example`** na raiz do repositório.

## 🚀 Configuração Inicial

### 1. Criar o arquivo .env

Se você ainda não tem um arquivo `.env`, copie o template:

```bash
cp .env.example .env
```

### 2. Atualizar Caminhos (Se já tiver .env)

Se você já possui um arquivo `.env`, atualize as seguintes variáveis:

#### Antes → Depois

```env
# ANTES
DB_PATH=./database/chamados.db
UPLOAD_PATH=./uploads

# DEPOIS
DB_PATH=./data/database/chamados.db
UPLOAD_PATH=./storage/uploads
IMAGES_PATH=./storage/images
UPLOADS_PATH=./storage/uploads
```

## 📋 Variáveis Obrigatórias

### Mínimas para Funcionamento

```env
# Servidor
PORT=3000
NODE_ENV=development

# Banco de Dados
DB_PATH=./data/database/chamados.db

# Autenticação (IMPORTANTE: Altere em produção!)
JWT_SECRET=sua_chave_secreta_jwt_aqui
```

## 🔐 Segurança

### Gerar JWT_SECRET Seguro

**Linux/Mac:**
```bash
openssl rand -base64 32
```

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 📧 Configuração de E-mail (Opcional)

### Gmail com App Password

1. Acesse: https://myaccount.google.com/apppasswords
2. Crie uma senha de app para "Mail"
3. Use a senha gerada (16 caracteres) no `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx  # Senha de app (sem espaços)
SMTP_FROM=ERP PRIME <seu_email@gmail.com>
```

## 🗄️ Banco de Dados SQL Server (Opcional)

Apenas necessário se usar o módulo de cadastros com SQL Server:

```env
DB_SERVER=localhost
DB_DATABASE=consultas_tess
DB_USER=sa
DB_PASSWORD=sua_senha
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

## 📁 Caminhos de Armazenamento

Os caminhos padrão já estão configurados corretamente:

```env
UPLOAD_PATH=./storage/uploads
IMAGES_PATH=./storage/images
UPLOADS_PATH=./storage/uploads
```

**Não altere** a menos que tenha um motivo específico.

## ⚙️ Configurações Avançadas

### SLA (Service Level Agreement)

```env
SLA_FIRST_RESPONSE=4      # Horas para primeira resposta
SLA_RESOLUTION=24         # Horas para resolução
REOPEN_DAYS=7             # Dias para permitir reabertura
```

### Upload de Arquivos

```env
MAX_FILE_SIZE=10485760  # 10MB em bytes
ALLOWED_FILE_TYPES=pdf,doc,docx,xls,xlsx,jpg,jpeg,png,gif,zip,rar
```

### Desenvolvimento

```env
DISABLE_RATE_LIMIT=false  # Desabilitar rate limiting
DEBUG=false               # Modo debug
```

## 🔷 Microsoft Entra ID (login com Microsoft) – opcional

Para permitir login com contas Microsoft (single-tenant), crie um **App registration** no [portal Azure](https://portal.azure.com) e configure no `.env`:

| Variável | Descrição |
|----------|-----------|
| `AZURE_CLIENT_ID` | Application (client) ID do app no Entra |
| `AZURE_TENANT_ID` | Directory (tenant) ID do seu diretório |
| `AZURE_CLIENT_SECRET` | Client secret (Certificates & secrets) |
| `AZURE_REDIRECT_URI` | URL de callback: `https://seu-backend.com/api/auth/microsoft/callback` |

**Passos no Azure:**

1. **Azure Active Directory** → **App registrations** → **New registration**
   - Nome: ex. "ERP PRIME"
   - Supported account types: **Single tenant**
   - Redirect URI: **Web** → `https://seu-dominio-backend.com/api/auth/microsoft/callback`

2. **Authentication:** conferir redirect URI; habilitar **ID tokens** em Implicit grant (ou usar apenas Authorization code).

3. **Certificates & secrets:** criar **Client secret** e copiar o valor em `AZURE_CLIENT_SECRET`.

4. **API permissions:** adicionar:
   - **Delegated:** `openid`, `profile`, `email` (e opcionalmente `User.Read` para foto)
   - **Application:** `User.Read.All` (para o admin listar usuários do tenant); exigir **Admin consent**.

5. Após configurar as variáveis, o botão "Entrar com Microsoft" aparece na tela de login. Apenas usuários **importados** pelo admin (em Usuários → Importar do Entra ID) podem fazer login.

## ✅ Checklist de Configuração

- [ ] Arquivo `.env` criado a partir do `env.example`
- [ ] `JWT_SECRET` alterado para uma chave segura
- [ ] `DB_PATH` configurado corretamente
- [ ] Caminhos de armazenamento verificados
- [ ] E-mail configurado (opcional)
- [ ] SQL Server configurado (se necessário)
- [ ] Microsoft Entra ID configurado (opcional)
- [ ] Arquivo `.env` adicionado ao `.gitignore` (não commitar!)

## 🚨 Importante

1. **NUNCA** commite o arquivo `.env` no Git
2. **SEMPRE** use `env.example` como template
3. **ALTERE** o `JWT_SECRET` em produção
4. **VERIFIQUE** as permissões das pastas `data/` e `storage/`

## 📚 Documentação Relacionada

- [README.md](../README.md) - Documentação principal
- [ESTRUTURA_PROJETO.md](./ESTRUTURA_PROJETO.md) - Estrutura do projeto
- [MIGRACAO_ESTRUTURA.md](./MIGRACAO_ESTRUTURA.md) - Guia de migração

