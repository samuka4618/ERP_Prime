# Sistema de Chamados Financeiro

Sistema completo de gerenciamento de chamados para o setor financeiro, desenvolvido com Node.js, Express, TypeScript, React e SQLite.

## 🚀 Início Rápido

### Pré-requisitos
- Node.js (versão 16 ou superior)
- npm

### Instalação e Execução

1. **Instalar todas as dependências:**
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
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000

## 📋 Scripts Disponíveis

### Desenvolvimento
- `npm run dev:all` - Inicia backend e frontend simultaneamente
- `npm run dev:backend` - Inicia apenas o backend
- `npm run dev:frontend` - Inicia apenas o frontend
- `npm run dev` - Inicia apenas o backend (alias)

### Build
- `npm run build` - Compila o backend TypeScript
- `npm run build:all` - Compila backend e frontend

### Instalação
- `npm run install:all` - Instala dependências do backend e frontend

### Banco de Dados
- `npm run migrate` - Executa migrações do banco de dados

### Produção
- `npm start` - Inicia o servidor em modo produção
- `npm run build:all` - Compila backend e frontend para produção

## 🚀 Deploy em Produção

### 1. Preparação
```bash
# Instalar dependências
npm run install:all

# Compilar para produção
npm run build:all

# Executar migrações
npm run migrate
```

### 2. Configuração de Ambiente
Use o arquivo `.env` existente e configure as variáveis necessárias:
- `NODE_ENV=production` - Modo produção
- `JWT_SECRET`: Chave secreta para JWT (obrigatório)
- `SMTP_*`: Configurações de e-mail (opcional)
- `PORT=3000` - Porta do servidor
- `HOST=0.0.0.0` - Acesso via rede

### 3. Iniciar em Produção
```bash
npm start
```

O sistema estará disponível em:
- **Frontend**: http://localhost:3001 (servido pelo backend)
- **Backend API**: http://localhost:3000
- **Rede**: http://[SEU_IP]:3001

### 4. Criar Primeiro Usuário Administrador
Após iniciar o sistema, acesse a página de registro e crie o primeiro usuário com role "admin":
1. Acesse: http://localhost:3001/register
2. Preencha os dados do administrador
3. Selecione role "admin"
4. Faça login com as credenciais criadas

### 5. Acessar via Rede
Para acessar de outros computadores na rede:
1. Configure o firewall para permitir a porta 3000
2. Acesse: http://[IP_DO_SERVIDOR]:3001

## 🏗️ Estrutura do Projeto

```
sistema/
├── src/                    # Backend (Node.js + Express + TypeScript)
│   ├── controllers/        # Controladores da API
│   ├── models/            # Modelos de dados
│   ├── routes/            # Rotas da API
│   ├── services/          # Serviços de negócio
│   ├── middleware/        # Middlewares
│   ├── database/          # Configuração e migrações do banco
│   └── server.ts          # Arquivo principal do servidor
├── frontend/              # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/    # Componentes React
│   │   ├── pages/         # Páginas da aplicação
│   │   ├── contexts/      # Contextos React
│   │   ├── services/      # Serviços de API
│   │   └── types/         # Tipos TypeScript
│   └── package.json
└── package.json           # Configuração principal
```

## 🎯 Funcionalidades

### Para Usuários
- Criação e acompanhamento de chamados
- Upload de anexos
- Histórico de interações
- Notificações em tempo real

### Para Atendentes
- Visualização de chamados atribuídos
- Atribuição automática por categoria
- Gerenciamento de status
- Resposta a chamados

### Para Administradores
- Dashboard completo com métricas
- Gerenciamento de usuários
- Configuração de categorias e SLAs
- Relatórios personalizados
- Monitoramento em tempo real

## 🎨 Tema Escuro

O sistema possui suporte completo ao tema escuro com:
- Alternância automática baseada na preferência do sistema
- Persistência da escolha do usuário
- Transições suaves entre temas
- Consistência visual em todos os componentes

## 🔧 Tecnologias

### Backend
- Node.js + Express
- TypeScript
- SQLite
- JWT para autenticação
- Multer para upload de arquivos
- ExcelJS para geração de relatórios

### Frontend
- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- React Hot Toast
- Lucide React (ícones)

## 📝 Licença

MIT