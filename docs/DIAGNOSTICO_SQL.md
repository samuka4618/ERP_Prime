# 🔍 Guia de Diagnóstico - Conexão SQL Server

Este guia ajuda a diagnosticar e resolver problemas de conexão com o SQL Server.

## 📋 Checklist de Verificação

### 1. Verificar Arquivo .env

Certifique-se de que o arquivo `.env` existe na raiz do projeto e contém as seguintes variáveis:

```env
DB_SERVER=192.168.x.x          # IP ou hostname do servidor SQL
DB_DATABASE=consultas_tess      # Nome do banco de dados
DB_USER=sa                      # Usuário do SQL Server
DB_PASSWORD=sua_senha_aqui      # Senha do usuário
DB_PORT=1433                    # Porta (padrão: 1433)
DB_ENCRYPT=false                # Criptografia (false para conexões locais)
DB_TRUST_CERT=true              # Confiar em certificado (recomendado: true)
```

### 2. Testar Conexão

Execute o script de teste:

```bash
npm run test-sql
```

Este script irá:
- Verificar se todas as variáveis estão configuradas
- Tentar conectar ao SQL Server
- Mostrar informações detalhadas sobre erros
- Testar uma query simples

### 3. Problemas Comuns e Soluções

#### ❌ Erro: "Timeout" ou "Connection timed out"

**Possíveis causas:**
- IP do servidor incorreto
- SQL Server não está acessível na rede
- Firewall bloqueando a porta 1433
- SQL Server não aceita conexões TCP/IP

**Soluções:**
1. Verifique se o IP está correto:
   ```bash
   ping <IP_DO_SERVIDOR>
   ```

2. Verifique se a porta está aberta:
   ```bash
   telnet <IP_DO_SERVIDOR> 1433
   ```

3. No SQL Server, verifique:
   - SQL Server Configuration Manager → SQL Server Network Configuration → Protocols for [INSTANCE]
   - Certifique-se de que "TCP/IP" está habilitado
   - Reinicie o serviço SQL Server após habilitar

4. No Firewall do Windows:
   - Adicione regra de entrada para porta 1433
   - Ou desabilite temporariamente para teste

#### ❌ Erro: "Login failed" ou "Authentication failed"

**Possíveis causas:**
- Usuário ou senha incorretos
- Autenticação SQL Server não habilitada
- Usuário sem permissão no banco

**Soluções:**
1. Verifique as credenciais no arquivo `.env`
2. No SQL Server Management Studio, teste a conexão com as mesmas credenciais
3. Certifique-se de que a autenticação SQL Server está habilitada:
   - SQL Server Management Studio → Propriedades do Servidor → Segurança
   - Marque "Autenticação SQL Server e Windows"

#### ❌ Erro: "Cannot find server" ou "ENOTFOUND"

**Possíveis causas:**
- IP/hostname incorreto
- Servidor não acessível na rede
- DNS não resolve o hostname

**Soluções:**
1. Use o IP ao invés do hostname (mais confiável)
2. Verifique se consegue fazer ping no servidor
3. Se usar hostname, verifique se o DNS está funcionando

#### ❌ Erro: "Certificate" ou "SSL"

**Solução:**
Adicione no arquivo `.env`:
```env
DB_TRUST_CERT=true
```

### 4. Verificar Configuração do SQL Server

#### Habilitar Conexões TCP/IP

1. Abra **SQL Server Configuration Manager**
2. Vá em **SQL Server Network Configuration** → **Protocols for [INSTANCE]**
3. Clique com botão direito em **TCP/IP** → **Enable**
4. Clique com botão direito em **TCP/IP** → **Properties**
5. Na aba **IP Addresses**, verifique:
   - **IPAll** → **TCP Dynamic Ports**: Deixe vazio ou configure uma porta fixa
   - **IPAll** → **TCP Port**: 1433 (ou a porta que você configurou)
6. Reinicie o serviço SQL Server

#### Habilitar Autenticação SQL Server

1. Abra **SQL Server Management Studio**
2. Conecte-se ao servidor
3. Clique com botão direito no servidor → **Properties**
4. Vá em **Security**
5. Marque **SQL Server and Windows Authentication mode**
6. Clique em **OK**
7. Reinicie o serviço SQL Server

#### Criar Usuário e Dar Permissões

```sql
-- Criar login
CREATE LOGIN seu_usuario WITH PASSWORD = 'sua_senha';

-- Dar permissão no banco
USE consultas_tess;
CREATE USER seu_usuario FOR LOGIN seu_usuario;
ALTER ROLE db_owner ADD MEMBER seu_usuario;
```

### 5. Testar Manualmente

Você pode testar a conexão usando o `sqlcmd` (se instalado):

```bash
sqlcmd -S <IP_DO_SERVIDOR>,1433 -U <USUARIO> -P <SENHA> -d <BANCO_DE_DADOS>
```

Ou usando o SQL Server Management Studio:
- Server name: `<IP_DO_SERVIDOR>,1433`
- Authentication: SQL Server Authentication
- Login: `<USUARIO>`
- Password: `<SENHA>`

### 6. Logs Detalhados

O sistema agora mostra logs mais detalhados ao tentar conectar. Verifique o console quando iniciar o servidor para ver:
- IP do servidor sendo usado
- Banco de dados
- Usuário
- Porta
- Mensagens de erro específicas

### 7. Verificar se o Banco Existe

Execute no SQL Server Management Studio:

```sql
SELECT name FROM sys.databases WHERE name = 'consultas_tess';
```

Se não existir, você precisa criar o banco ou usar um banco existente.

## 🆘 Ainda com Problemas?

Se após seguir todos os passos ainda houver problemas:

1. Execute `npm run test-sql` e copie a saída completa
2. Verifique os logs do SQL Server (SQL Server Error Log)
3. Verifique os logs do Windows Event Viewer
4. Teste a conexão de outra máquina para isolar o problema

## 📝 Exemplo de .env Correto

```env
# SQL Server
DB_SERVER=192.168.1.100
DB_DATABASE=consultas_tess
DB_USER=sa
DB_PASSWORD=MinhaSenh@123
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_CERT=true
```

**Importante:** 
- Não use espaços ao redor do `=`
- Não use aspas nas variáveis
- Use o IP ao invés do hostname se possível
- Certifique-se de que o arquivo está na raiz do projeto (mesmo nível do package.json)

