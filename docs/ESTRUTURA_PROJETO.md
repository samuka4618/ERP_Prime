# Estrutura do Projeto ERP PRIME

Este documento descreve a organização completa do projeto ERP PRIME.

## 📁 Estrutura de Diretórios

```
erp-prime/
│
├── src/                          # Código-fonte do backend
│   ├── modules/                  # Módulos do ERP
│   │   ├── chamados/            # Módulo de gerenciamento de chamados
│   │   └── cadastros/           # Módulo de cadastros de clientes
│   ├── core/                     # Funcionalidades core do sistema
│   │   ├── auth/                # Autenticação e autorização
│   │   ├── users/               # Gerenciamento de usuários
│   │   ├── system/               # Configurações do sistema
│   │   └── database/            # Configuração e migrações do banco
│   ├── shared/                   # Recursos compartilhados
│   │   ├── middleware/          # Middlewares compartilhados
│   │   ├── utils/               # Utilitários
│   │   └── types/               # Tipos TypeScript
│   ├── config/                   # Arquivos de configuração
│   └── server.ts                # Ponto de entrada do servidor
│
├── frontend/                     # Aplicação frontend React
│   ├── src/
│   │   ├── components/          # Componentes React reutilizáveis
│   │   ├── pages/               # Páginas da aplicação
│   │   ├── contexts/            # Contextos React
│   │   ├── services/             # Serviços de API
│   │   └── types/                # Tipos TypeScript
│   └── dist/                     # Build de produção
│
├── data/                         # Dados do sistema
│   ├── database/                 # Bancos de dados SQLite
│   │   ├── chamados.db          # Banco principal
│   │   └── *.db-shm             # Arquivos de shared memory
│   │   └── *.db-wal             # Write-ahead log
│   └── backups/                  # Backups do banco de dados
│
├── storage/                      # Armazenamento de arquivos
│   ├── uploads/                  # Arquivos enviados pelos usuários
│   └── images/                   # Imagens (cadastros, etc)
│
├── logs/                         # Logs do sistema
│   ├── *.log                     # Logs diários
│   └── pm2-*.log                 # Logs do PM2
│
├── scripts/                      # Scripts de automação
│   ├── pm2-*.js                  # Configurações PM2
│   ├── pm2-*.bat                 # Scripts batch PM2
│   ├── test-*.js                 # Scripts de teste
│   └── ecosystem.config.js      # Configuração do PM2
│
├── docs/                         # Documentação
│   ├── ESTRUTURA_PROJETO.md      # Este arquivo
│   ├── DOCUMENTACAO_API.md      # Documentação da API
│   └── DOCUMENTACAO_SISTEMA.md   # Documentação do sistema
│
├── tools/                        # Ferramentas auxiliares
│   └── cadastros-legacy/         # Sistema de cadastros legado
│
├── tests/                        # Testes automatizados
│   ├── unit/                     # Testes unitários
│   ├── integration/              # Testes de integração
│   └── e2e/                      # Testes end-to-end
│
├── .gitignore                    # Arquivos ignorados pelo Git
├── package.json                  # Dependências e scripts
├── tsconfig.json                 # Configuração TypeScript
└── README.md                     # Documentação principal
```

## 📂 Descrição das Pastas Principais

### `src/`
Contém todo o código-fonte do backend, organizado de forma modular:
- **modules/**: Módulos independentes do ERP (chamados, cadastros, etc)
- **core/**: Funcionalidades essenciais (auth, users, system, database)
- **shared/**: Recursos compartilhados entre módulos
- **config/**: Arquivos de configuração

### `data/`
Armazena dados persistentes do sistema:
- **database/**: Bancos de dados SQLite e arquivos relacionados
- **backups/**: Backups automáticos do banco de dados

### `storage/`
Armazena arquivos enviados pelos usuários:
- **uploads/**: Documentos e anexos
- **images/**: Imagens de cadastros e outros

### `logs/`
Centraliza todos os logs do sistema:
- Logs diários por data
- Logs do PM2 (backend e frontend)
- Logs de serviços específicos

### `scripts/`
Scripts de automação e deploy:
- Configurações PM2
- Scripts de teste
- Scripts de backup

### `docs/`
Documentação completa do projeto:
- Estrutura do projeto
- Documentação da API
- Documentação do sistema

### `tools/`
Ferramentas auxiliares e sistemas legados:
- Sistema de cadastros legado (em migração)

### `tests/`
Testes automatizados organizados por tipo:
- **unit/**: Testes unitários de funções e classes
- **integration/**: Testes de integração entre módulos
- **e2e/**: Testes end-to-end da aplicação completa

## 🔄 Migração de Estrutura Antiga

A estrutura foi reorganizada para seguir padrões profissionais de ERP. As principais mudanças foram:

1. **Databases**: Movidos de `database/` para `data/database/`
2. **Logs**: Centralizados em `logs/` (antes espalhados)
3. **Uploads**: Movidos de `uploads/` para `storage/uploads/`
4. **Imagens**: Movidas de `imgCadastros/` para `storage/images/`
5. **Scripts**: Movidos para `scripts/`
6. **Documentação**: Movida para `docs/`
7. **Cadastros**: Movido para `tools/cadastros-legacy/`

## 📝 Convenções

- **Nomes de pastas**: minúsculas, separadas por hífen quando necessário
- **Arquivos de código**: camelCase para TypeScript/JavaScript
- **Arquivos de configuração**: kebab-case
- **Logs**: Formato `YYYY-MM-DD.log` ou `servico-tipo.log`

## 🚀 Próximos Passos

- [ ] Migrar completamente o sistema de cadastros legado para o módulo
- [ ] Implementar sistema de backups automáticos
- [ ] Adicionar mais testes automatizados
- [ ] Melhorar documentação da API

