# 🔥 Como Abrir Portas no Firewall do Windows

## ⚠️ Problema

Se outros computadores na rede não conseguem acessar o sistema (erro de timeout/network error), o **Firewall do Windows** está bloqueando as portas necessárias.

## 📋 Portas Necessárias

- **Porta 3000**: Backend (API e frontend em produção)
- **Porta 3001**: Frontend (Vite em desenvolvimento) - **SOMENTE se estiver em modo desenvolvimento**

## ✅ Solução: Abrir Portas no Firewall

**IMPORTANTE**: 
- Se estiver usando **produção** (frontend servido pelo backend): abra apenas a **porta 3000**
- Se estiver usando **desenvolvimento** (Vite separado): abra **portas 3000 E 3001**

### Método 1: Interface Gráfica (Recomendado)

1. **Abra o Firewall do Windows:**
   - Pressione `Windows + R`
   - Digite: `wf.msc` e pressione Enter
   - OU vá em: **Painel de Controle** → **Sistema e Segurança** → **Firewall do Windows** → **Configurações Avançadas**

2. **Criar Nova Regra de Entrada:**
   - Clique em **Regras de Entrada** (Inbound Rules) no painel esquerdo
   - Clique em **Nova Regra...** (New Rule...) no painel direito

3. **Configurar a Regra:**
   - Selecione **Porta** e clique em **Próximo**
   - Selecione **TCP**
   - Selecione **Portas locais específicas** e digite: `3000` (e depois `3001` se estiver em desenvolvimento)
   - Clique em **Próximo**
   - Selecione **Permitir a conexão** e clique em **Próximo**
   - Marque todas as opções: **Domínio**, **Privado**, **Público**
   - Clique em **Próximo**
   - Nome: `ERP PRIME - Porta 3000`
   - Descrição: `Permite acesso ao servidor ERP PRIME na porta 3000`
   - Clique em **Concluir**

4. **Verificar se a regra foi criada:**
   - Procure por "ERP PRIME" na lista de regras
   - Certifique-se de que está **Habilitada** (Status: Yes)

### Método 2: PowerShell (Administrador)

Abra o PowerShell como **Administrador** e execute:

```powershell
# Criar regra de entrada para porta 3000 (BACKEND - OBRIGATÓRIO)
New-NetFirewallRule -DisplayName "ERP PRIME - Porta 3000" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3000 `
    -Action Allow `
    -Profile Domain,Private,Public `
    -Description "Permite acesso ao servidor ERP PRIME na porta 3000"

# Criar regra de entrada para porta 3001 (FRONTEND VITE - APENAS SE ESTIVER EM DESENVOLVIMENTO)
New-NetFirewallRule -DisplayName "ERP PRIME - Porta 3001 (Vite)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 3001 `
    -Action Allow `
    -Profile Domain,Private,Public `
    -Description "Permite acesso ao frontend Vite na porta 3001 (apenas desenvolvimento)"
```

Para verificar se as regras foram criadas:

```powershell
Get-NetFirewallRule -DisplayName "ERP PRIME*" | Format-Table DisplayName, Enabled, Direction, Action
```

### Método 3: Linha de Comando (CMD como Administrador)

```cmd
REM Porta 3000 (Backend - OBRIGATÓRIO)
netsh advfirewall firewall add rule name="ERP PRIME - Porta 3000" dir=in action=allow protocol=TCP localport=3000

REM Porta 3001 (Frontend Vite - APENAS SE ESTIVER EM DESENVOLVIMENTO)
netsh advfirewall firewall add rule name="ERP PRIME - Porta 3001 (Vite)" dir=in action=allow protocol=TCP localport=3001
```

## 🧪 Testar a Conectividade

### 1. Testar do Servidor (Deve funcionar)
```bash
# Backend
curl http://localhost:3000/health
# ou
curl http://192.168.14.143:3000/health

# Frontend (se estiver em desenvolvimento)
curl http://localhost:3001
# ou
curl http://192.168.14.143:3001
```

### 2. Testar de Outro Computador na Rede

No outro computador, abra o navegador ou execute:

**Produção (frontend servido pelo backend):**
```bash
# No navegador
http://192.168.14.143:3000

# Testar API
http://192.168.14.143:3000/health
http://192.168.14.143:3000/api/test-connection
```

**Desenvolvimento (Vite separado):**
```bash
# No navegador - Frontend
http://192.168.14.143:3001

# Testar Backend
http://192.168.14.143:3000/health
http://192.168.14.143:3000/api/test-connection
```

**Resposta esperada:**
```json
{
  "status": "OK",
  "timestamp": "2026-01-07T...",
  "uptime": 1234.56,
  "environment": "development"
}
```

### 3. Verificar se a Porta Está Aberta

No outro computador, execute:

**Windows:**
```cmd
telnet 192.168.14.143 3000
```

**PowerShell:**
```powershell
Test-NetConnection -ComputerName 192.168.14.143 -Port 3000
```

Se funcionar, você verá algo como:
```
ComputerName     : 192.168.14.143
RemoteAddress    : 192.168.14.143
RemotePort       : 3000
InterfaceAlias   : Ethernet
SourceAddress    : 192.168.14.xxx
TcpTestSucceeded : True
```

## 🔍 Diagnóstico de Problemas

### ❌ Ainda não funciona?

1. **Verificar se o servidor está rodando:**
   ```bash
   netstat -ano | findstr :3000
   ```
   Deve mostrar que a porta 3000 está **LISTENING**

2. **Verificar se o firewall está bloqueando:**
   - Abra o Firewall do Windows
   - Verifique se a regra está **Habilitada**
   - Verifique se não há regras de bloqueio sobrepondo

3. **Verificar IP do servidor:**
   ```bash
   ipconfig
   ```
   Certifique-se de usar o IP correto (ex: 192.168.14.143)

4. **Testar com firewall temporariamente desabilitado:**
   - **⚠️ APENAS PARA TESTE!**
   - Desabilite temporariamente o firewall
   - Teste a conexão
   - Se funcionar, o problema é o firewall - reative e configure corretamente

5. **Verificar antivírus:**
   - Alguns antivírus têm firewall próprio
   - Adicione exceção para a porta 3000

## 📝 Notas Importantes

- ⚠️ **Segurança**: Abrir portas no firewall pode ser um risco de segurança. Use apenas em redes confiáveis (rede interna/local).
- 🏢 **Produção**: Para produção, considere usar HTTPS e configurar regras mais restritivas.
- 🔒 **Firewall de Rede**: Se houver firewall de rede (router/firewall corporativo), pode ser necessário configurá-lo também.

## 🚀 Após Configurar

Após abrir a porta no firewall:

1. **Reinicie o servidor:**
   ```bash
   npm start
   ```

2. **Teste de outro computador:**
   - Acesse: `http://192.168.14.143:3000`
   - Ou: `http://192.168.14.143:3001` (se estiver usando o frontend separado)

3. **Verifique os logs do servidor:**
   - Você deve ver as requisições chegando nos logs

## ✅ Checklist

- [ ] Regra de firewall criada para porta 3000 (entrada/TCP)
- [ ] Regra está habilitada
- [ ] Servidor está rodando e escutando na porta 3000
- [ ] Teste de conectividade passou de outro computador
- [ ] Sistema funciona corretamente de outros computadores

