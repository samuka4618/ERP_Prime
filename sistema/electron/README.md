# Aplicativo Electron - Sistema de Chamados

Aplicativo desktop Electron que consome as mesmas APIs do sistema web.

## 📋 Pré-requisitos

- Node.js 18+ instalado
- Backend do sistema rodando na porta 3000
- Frontend buildado (ou servidor de desenvolvimento na porta 3001)

## 🚀 Instalação

1. Instalar dependências do Electron:
```bash
cd electron
npm install
```

## 🛠️ Desenvolvimento

### Modo Desenvolvimento

Para rodar em modo desenvolvimento (conecta ao servidor Vite do frontend):

```bash
npm run dev
```

**Importante**: O servidor de desenvolvimento do frontend deve estar rodando na porta 3001:
```bash
cd ../frontend
npm run dev
```

E o backend deve estar rodando na porta 3000:
```bash
cd ..
npm run dev:backend
```

### Modo Produção

Para rodar com o build estático do frontend:

1. Primeiro, fazer build do frontend:
```bash
cd ../frontend
npm run build
```

2. Depois, rodar o Electron:
```bash
cd ../electron
npm start
```

## 📦 Build para Distribuição

### Windows

**Importante**: Se você encontrar erros relacionados a symbolic links durante o build, você tem duas opções:

**Opção 1 - Limpar cache e tentar novamente:**
```bash
npm run clean:cache
npm run build:win
```

**Opção 2 - Executar PowerShell como Administrador:**
1. Abra o PowerShell como Administrador
2. Navegue até a pasta `electron`
3. Execute:
```bash
npm run build:win
```

**Opção 3 - Build sem assinatura (recomendado para desenvolvimento):**
```bash
npm run build:win:unsigned
```

O build sem assinatura é mais rápido e não requer privilégios de administrador.

**⚠️ Importante**: Após fazer alterações nos arquivos do Electron (como `main.js`, `preload.js`, `config-manager.js`), você precisa fazer um novo build para que as mudanças sejam incluídas no executável.

### macOS
```bash
npm run build:mac
```

### Linux
```bash
npm run build:linux
```

Os arquivos compilados estarão na pasta `electron/dist/`.

## ⚙️ Configuração

### Configuração Inicial

Na **primeira vez** que você executar o aplicativo (em modo produção), uma janela de configuração será exibida solicitando a URL do backend.

**⚠️ IMPORTANTE**: Informe apenas a **URL base do backend**, **SEM** o `/api` no final.

**Exemplos corretos:**
- ✅ `http://localhost:3000`
- ✅ `http://192.168.1.100:3000`
- ✅ `https://meu-servidor.com:3000`

**Exemplos incorretos:**
- ❌ `http://localhost:3000/api` (não coloque /api)
- ❌ `http://192.168.1.100:3000/api` (não coloque /api)

O sistema adiciona `/api` automaticamente às requisições.

**Passos:**
1. Informe a URL base do servidor backend (ex: `http://localhost:3000`)
2. Clique em "Salvar"
3. A configuração será salva automaticamente e não será solicitada novamente

### Alterar URL do Backend

Após a configuração inicial, você pode alterar a URL do backend de várias formas:

1. **Via variável de ambiente** (em desenvolvimento):
```bash
BACKEND_URL=http://192.168.1.100:3000 npm start
```

2. **Usando o script de reset (recomendado)**:
   ```bash
   npm run reset:config
   ```
   
   Ou execute diretamente o arquivo `.bat`:
   ```bash
   reset-config.bat
   ```
   
   Ou dê duplo clique no arquivo `reset-config.bat` na pasta `electron`.

3. **Deletando manualmente o arquivo de configuração**:
   - Windows: `%APPDATA%\sistema-chamados-electron\config.json`
   - macOS: `~/Library/Application Support/sistema-chamados-electron/config.json`
   - Linux: `~/.config/sistema-chamados-electron/config.json`
   
   Ao deletar o arquivo, a janela de configuração será exibida novamente na próxima execução.

4. **Modificando manualmente o arquivo de configuração**:
   Edite o arquivo `config.json` no diretório de dados do aplicativo e altere o valor de `backendUrl`.

### ⚠️ Problemas com Configuração

Se você configurou uma URL incorreta e o aplicativo não abre mais:

1. **Execute o script de reset**:
   ```bash
   npm run reset:config
   ```

2. **Ou delete manualmente o arquivo**:
   - Windows: Delete `%APPDATA%\sistema-chamados-electron\config.json`
   - Execute o aplicativo novamente e a janela de configuração aparecerá

## 🔧 Estrutura do Projeto

```
electron/
├── main.js              # Processo principal do Electron
├── preload.js           # Script de ponte segura
├── config-manager.js    # Gerenciador de configurações (solicita URL na primeira execução)
├── config.js            # Configurações do aplicativo
├── api-adapter.js       # Adaptador de API (não usado diretamente)
├── package.json         # Dependências e scripts
├── start.bat            # Script de inicialização (Windows)
├── start.sh             # Script de inicialização (Linux/Mac)
└── README.md            # Este arquivo
```

## 📝 Funcionalidades

O aplicativo Electron oferece as mesmas funcionalidades do frontend web:

- ✅ Autenticação de usuários
- ✅ Gerenciamento de chamados
- ✅ Dashboard com estatísticas
- ✅ Notificações em tempo real
- ✅ Upload de anexos
- ✅ Relatórios
- ✅ Cadastro de clientes
- ✅ Configurações do sistema

## 🐛 Troubleshooting

### O aplicativo não conecta ao backend

1. Verifique se o backend está rodando na porta 3000
2. Verifique a URL configurada em `main.js`
3. Verifique o firewall e permissões de rede

### Erro ao carregar a aplicação

1. Certifique-se de que o frontend foi buildado (`npm run build` na pasta frontend)
2. Verifique se o arquivo `frontend/dist/index.html` existe
3. Em desenvolvimento, verifique se o servidor Vite está rodando na porta 3001

### Problemas com CORS

O Electron não tem as mesmas restrições de CORS do navegador, mas se encontrar problemas:

1. Verifique as configurações do backend em `src/server.ts`
2. Certifique-se de que o CORS está configurado para aceitar requisições do Electron

## 📄 Licença

MIT

