# ERP PRIME

Sistema completo de gestão empresarial (ERP) modular desenvolvido com Node.js, Express, TypeScript, React e SQLite.

## 🏢 Sobre o ERP PRIME

O ERP PRIME é um sistema de gestão empresarial modular que oferece funcionalidades essenciais para gestão de negócios, incluindo módulos especializados para diferentes áreas da empresa.

## 📦 Módulos do Sistema

- **Core**: Funcionalidades essenciais do ERP (autenticação, usuários e configurações do sistema)
- **Módulo de Chamados**: Sistema completo de gerenciamento de chamados e tickets
- **Módulo de Cadastros**: Sistema de cadastro de clientes, configurações e análise de crédito

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
- `DB_PATH=./data/database/chamados.db` - Caminho do banco de dados
- `UPLOAD_PATH=./storage/uploads` - Caminho de uploads
- `IMAGES_PATH=./storage/images` - Caminho de imagens

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
├── src/                           # Backend (Node.js + Express + TypeScript)
│   ├── modules/                   # Módulos do ERP
│   │   ├── chamados/             # Módulo de Chamados
│   │   │   ├── controllers/       # Controladores do módulo
│   │   │   ├── models/           # Modelos do módulo
│   │   │   ├── routes/           # Rotas do módulo
│   │   │   ├── services/         # Serviços do módulo
│   │   │   └── schemas/          # Schemas de validação
│   │   └── cadastros/            # Módulo de Cadastros
│   │       ├── controllers/
│   │       ├── models/
│   │       ├── routes/
│   │       ├── services/
│   │       └── schemas/
│   ├── core/                      # Funcionalidades core
│   │   ├── auth/                  # Autenticação
│   │   ├── users/                 # Gerenciamento de usuários
│   │   ├── system/                # Configurações do sistema
│   │   └── database/              # Banco de dados
│   ├── shared/                    # Recursos compartilhados
│   │   ├── middleware/             # Middlewares compartilhados
│   │   ├── utils/                 # Utilitários
│   │   └── types/                 # Tipos TypeScript
│   ├── config/                    # Configurações
│   └── server.ts                  # Arquivo principal do servidor
├── frontend/                       # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── components/            # Componentes React
│   │   ├── pages/                 # Páginas da aplicação
│   │   ├── contexts/              # Contextos React
│   │   ├── services/              # Serviços de API
│   │   └── types/                 # Tipos TypeScript
│   └── package.json
├── data/                           # Dados do sistema
│   ├── database/                   # Bancos de dados
│   └── backups/                   # Backups
├── storage/                        # Armazenamento de arquivos
│   ├── uploads/                   # Arquivos enviados
│   └── images/                    # Imagens
├── logs/                           # Logs do sistema
├── scripts/                        # Scripts de deploy e automação
├── docs/                           # Documentação
├── tools/                          # Ferramentas auxiliares
├── tests/                          # Testes
│   ├── unit/                      # Testes unitários
│   ├── integration/               # Testes de integração
│   └── e2e/                       # Testes end-to-end
└── package.json                    # Configuração principal
```

## 🎯 Funcionalidades

### Core (Funcionalidades Essenciais do ERP)
- Autenticação e autorização de usuários
- Gerenciamento de usuários e permissões
- Configurações do sistema
- Métricas de performance

### Módulo de Chamados
Sistema completo de gerenciamento de chamados e tickets com:
- Criação e acompanhamento de chamados
- Upload de anexos
- Histórico de interações
- Notificações em tempo real
- Dashboard com métricas
- Relatórios e análises
- Atribuição automática por categoria
- SLA (Service Level Agreement) configurável

### Módulo de Cadastros
Sistema de cadastro de clientes e análise de crédito com:
- Cadastro completo de clientes
- Configurações personalizadas de clientes
- Análise de crédito integrada
- Consulta CNPJ automatizada
- Integração com sistemas externos

## 📝 Licença

MIT

## 👤 Autor

Samuel
