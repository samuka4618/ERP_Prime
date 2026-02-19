# Documentação do Sistema de Chamados Financeiro

**Versão:** 1.0.0  
**Data:** 2025  
**Autor:** Equipe de Desenvolvimento

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Funcionalidades Principais](#funcionalidades-principais)
4. [Perfis de Usuário e Permissões](#perfis-de-usuário-e-permissões)
5. [Guia de Uso](#guia-de-uso)
6. [Módulos Específicos](#módulos-específicos)
7. [Configuração e Instalação](#configuração-e-instalação)
8. [Manutenção e Troubleshooting](#manutenção-e-troubleshooting)
9. [Segurança](#segurança)
10. [Glossário](#glossário)

---

## Visão Geral

### O que é o Sistema?

O **Sistema de Chamados Financeiro** é uma plataforma completa de gerenciamento de chamados (tickets) desenvolvida especificamente para o setor financeiro. O sistema permite que usuários solicitem suporte, que atendentes gerenciem e resolvam chamados, e que administradores monitorem métricas e performance do time.

### Objetivos do Sistema

- **Centralizar Solicitações**: Unificar todas as solicitações do setor financeiro em um único sistema
- **Rastreabilidade**: Manter histórico completo de todas as interações e alterações
- **SLA e Performance**: Monitorar e garantir cumprimento de SLAs (Service Level Agreements)
- **Automação**: Atribuição automática de chamados baseada em categorias
- **Análise de Dados**: Relatórios e dashboards para tomada de decisão
- **Cadastro de Clientes**: Sistema integrado de cadastro de novos clientes com análise de crédito

### Público-Alvo

- **Usuários**: Colaboradores que precisam solicitar suporte financeiro
- **Atendentes**: Equipe responsável por resolver os chamados
- **Administradores**: Gestores que precisam monitorar e configurar o sistema

### Problemas Resolvidos

1. **Falta de Rastreamento**: Elimina chamados perdidos ou esquecidos
2. **Ausência de Métricas**: Fornece dados para análise de performance
3. **Distribuição Injusta**: Sistema de atribuição automática distribui trabalho equitativamente
4. **Falta de Histórico**: Mantém registro completo de todas as interações
5. **Análise de Crédito Manual**: Automatiza consultas de CNPJ e análise de crédito

---

## Arquitetura do Sistema

### Stack Tecnológica

#### Backend
- **Node.js** (v16+)
- **Express.js** - Framework web
- **TypeScript** - Linguagem tipada
- **SQLite** - Banco de dados principal (desenvolvimento)
- **SQL Server** - Banco de dados para cadastros de clientes
- **JWT** - Autenticação e autorização
- **WebSocket (WS)** - Comunicação em tempo real
- **Multer** - Upload de arquivos
- **ExcelJS** - Geração de relatórios Excel

#### Frontend
- **React 18** - Biblioteca de interface
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS
- **React Router** - Roteamento
- **React Hot Toast** - Notificações
- **Lucide React** - Ícones

### Estrutura de Diretórios

```
sistema/
├── src/                          # Código fonte do backend
│   ├── controllers/              # Controladores (lógica de negócio)
│   ├── models/                   # Modelos de dados
│   ├── routes/                   # Definição de rotas da API
│   ├── services/                 # Serviços de negócio
│   ├── middleware/              # Middlewares (auth, validação, etc)
│   ├── database/                 # Migrações e schema do banco
│   ├── schemas/                  # Validação de dados (Joi)
│   ├── utils/                    # Utilitários
│   ├── types/                    # Definições TypeScript
│   └── server.ts                 # Ponto de entrada do servidor
├── frontend/                     # Código fonte do frontend
│   ├── src/
│   │   ├── components/          # Componentes React reutilizáveis
│   │   ├── pages/                # Páginas da aplicação
│   │   ├── contexts/             # Contextos React (Auth, etc)
│   │   ├── services/             # Serviços de API
│   │   └── types/                # Tipos TypeScript
│   └── dist/                     # Build de produção
├── cadastros/                    # Módulo de cadastro de clientes
│   ├── src/                      # Código do módulo
│   ├── database/                 # Scripts SQL
│   └── cache/                    # Cache de consultas CNPJ
├── logs/                         # Arquivos de log
├── uploads/                      # Arquivos enviados pelos usuários
└── imgCadastros/                 # Imagens de cadastros de clientes
```

### Fluxo de Dados

```
┌─────────────┐
│   Cliente   │
│  (Browser)  │
└──────┬──────┘
       │
       │ HTTP/HTTPS
       │
┌──────▼─────────────────┐
│   Frontend (React)     │
│   Porta: 3001          │
└──────┬─────────────────┘
       │
       │ API REST
       │
┌──────▼─────────────────┐
│   Backend (Express)    │
│   Porta: 3000          │
│                        │
│  ┌──────────────────┐  │
│  │  Middleware      │  │
│  │  (Auth, Validação)│ │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │  Controllers     │  │
│  └──────────────────┘  │
│  ┌──────────────────┐  │
│  │  Services        │  │
│  └──────────────────┘  │
└──────┬─────────────────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
┌──────▼──────┐ ┌─────▼──────┐ ┌─────▼──────┐
│   SQLite    │ │ SQL Server │ │ WebSocket │
│  (Chamados) │ │ (Cadastros)│ │ (Realtime)│
└─────────────┘ └────────────┘ └───────────┘
```

### Banco de Dados

#### SQLite (Sistema de Chamados)
- **users** - Usuários do sistema
- **categories** - Categorias de chamados
- **tickets** - Chamados
- **ticket_history** - Histórico de mensagens
- **ticket_attachments** - Anexos de chamados
- **notifications** - Notificações
- **system_config** - Configurações do sistema
- **reports** - Relatórios salvos
- **report_executions** - Execuções de relatórios
- **category_assignments** - Atribuições de categoria para atendentes

#### SQL Server (Cadastros de Clientes)
- **client_registrations** - Cadastros de novos clientes
- **client_registration_history** - Histórico de alterações
- **cnpj_query_status** - Status de consultas de CNPJ
- Tabelas de consultas TESS/SPC (consulta, empresa, endereco, etc.)

---

## Funcionalidades Principais

### 1. Sistema de Chamados

#### Para Usuários (Solicitantes)

**Criar Chamado**
- Preencher formulário com categoria, assunto, descrição e prioridade
- Upload de anexos (imagens, documentos)
- Visualização imediata após criação

**Acompanhar Chamados**
- Lista de todos os chamados criados
- Filtros por status, categoria, prioridade
- Visualização detalhada de cada chamado
- Histórico completo de mensagens
- Notificações em tempo real sobre atualizações

**Interagir com Chamados**
- Adicionar mensagens/respostas
- Aprovar ou rejeitar resoluções (quando aplicável)
- Reabrir chamados fechados
- Visualizar anexos enviados

#### Para Atendentes

**Visualizar Chamados Atribuídos**
- Lista de chamados atribuídos ao atendente
- Chamados em aberto disponíveis para "pegar" (claim)
- Indicadores visuais de SLA próximo do vencimento

**Gerenciar Chamados**
- Atualizar status do chamado
- Adicionar mensagens e respostas
- Upload de anexos
- Solicitar aprovação do solicitante
- Fechar chamados resolvidos

**Atribuição Automática**
- Sistema atribui automaticamente baseado na categoria do chamado
- Atendentes podem ser configurados para categorias específicas
- Distribuição equilibrada de carga de trabalho

#### Para Administradores

**Dashboard Completo**
- Métricas em tempo real (total de chamados, em aberto, resolvidos)
- Gráficos de distribuição por categoria, prioridade, atendente
- Indicadores de SLA (violações, taxa de cumprimento)
- Performance de atendentes
- Atividades recentes

**Gerenciamento de Usuários**
- Criar, editar, desativar usuários
- Definir roles (user, attendant, admin)
- Resetar senhas
- Visualizar estatísticas por usuário

**Gerenciamento de Categorias**
- Criar e editar categorias
- Definir SLAs por categoria (tempo de primeira resposta, tempo de resolução)
- Ativar/desativar categorias

**Configurações do Sistema**
- Ajustar SLAs globais
- Configurar limites de upload
- Habilitar/desabilitar notificações por email
- Personalizar nome do sistema

**Relatórios**
- Relatórios pré-configurados (SLA, Volume, Performance, etc.)
- Relatórios personalizados com campos customizados
- Exportação para Excel, PDF, CSV
- Agendamento de relatórios

**Monitoramento**
- Dashboard administrativo com métricas avançadas
- Análise de performance
- Alertas de SLA

### 2. Sistema de Cadastro de Clientes

#### Funcionalidades

**Cadastro Completo**
- Informações básicas (nome, CNPJ, email)
- Dados comerciais (ramo de atividade, vendedor, gestor)
- Informações financeiras (condição de pagamento, limite de crédito)
- Upload de imagens (externa e interna do estabelecimento)
- Anexos adicionais

**Consulta Automática de CNPJ**
- Integração com API CNPJA para obter dados da Receita Federal
- Cache de consultas para evitar requisições desnecessárias
- Processamento em fila para evitar sobrecarga

**Análise de Crédito**
- Integração com sistema TESS/SPC para análise de crédito
- Processamento automático de PDFs de consulta
- Extração de dados estruturados (scores, histórico, etc.)
- Armazenamento no banco de dados SQL Server

**Integração com Atak**
- Cadastro automático no sistema Atak após aprovação
- Sincronização de condições de pagamento
- Atualização de limites de crédito
- Consulta de dados completos do cliente

**Gerenciamento de Status**
- Fluxo: `cadastro_enviado` → `aguardando_analise_credito` → `cadastro_finalizado`
- Histórico completo de alterações
- Feedback e observações dos administradores

**Configurações**
- Gerenciamento de opções (ramo de atividade, vendedores, gestores, etc.)
- Ativação/desativação de opções
- Hierarquia de dados

### 3. Sistema de Notificações

**Notificações em Tempo Real**
- WebSocket para notificações instantâneas
- Notificações quando:
  - Novo chamado é criado
  - Status de chamado é alterado
  - Nova mensagem é adicionada
  - SLA está próximo do vencimento
  - Chamado é reaberto

**Notificações por Email** (Opcional)
- Configurável via SMTP
- Notificações de eventos importantes
- Relatórios agendados

### 4. Sistema de Relatórios

**Tipos de Relatórios Disponíveis**

1. **SLA Performance**
   - Taxa de cumprimento de SLA
   - Violações por categoria e atendente
   - Tempo médio de resposta e resolução
   - Tendências ao longo do tempo

2. **Volume de Chamados**
   - Total de chamados por período
   - Distribuição por status, prioridade, categoria
   - Horários de pico
   - Tendências diárias, semanais, mensais

3. **Performance de Atendentes**
   - Chamados resolvidos por atendente
   - Tempo médio de resolução
   - Taxa de cumprimento de SLA
   - Ranking de performance

4. **Análise por Categoria**
   - Métricas detalhadas por categoria
   - Distribuição de chamados
   - Performance de atendentes por categoria

5. **Chamados por Atendente**
   - Visão detalhada do trabalho de cada atendente
   - Distribuição por categoria e status
   - Tendências de performance

6. **Relatório Geral**
   - Visão completa de todos os chamados
   - Análise temporal completa
   - Distribuições múltiplas

7. **Relatórios Personalizados**
   - Seleção de campos customizados
   - Filtros avançados
   - Queries SQL personalizadas (para administradores avançados)

**Exportação**
- Formato Excel (.xlsx)
- Formato CSV
- Formato PDF (planejado)
- Formato JSON

**Agendamento**
- Relatórios podem ser agendados para execução automática
- Frequências: Diária, Semanal, Mensal
- Envio automático por email para destinatários configurados

---

## Perfis de Usuário e Permissões

### Perfil: Usuário (User)

**Permissões:**
- ✅ Criar chamados
- ✅ Visualizar seus próprios chamados
- ✅ Adicionar mensagens em seus chamados
- ✅ Aprovar/rejeitar resoluções
- ✅ Reabrir chamados fechados
- ✅ Visualizar anexos
- ✅ Criar cadastros de clientes
- ✅ Visualizar seus próprios cadastros
- ✅ Visualizar perfil próprio
- ✅ Alterar senha própria
- ❌ Gerenciar outros usuários
- ❌ Visualizar chamados de outros usuários
- ❌ Atribuir chamados
- ❌ Fechar chamados
- ❌ Acessar relatórios administrativos

### Perfil: Atendente (Attendant)

**Permissões:**
- ✅ Todas as permissões de Usuário
- ✅ Visualizar chamados atribuídos
- ✅ Visualizar chamados em aberto (para "pegar")
- ✅ Atualizar status de chamados atribuídos
- ✅ Adicionar mensagens em chamados atribuídos
- ✅ Solicitar aprovação
- ✅ Fechar chamados resolvidos
- ✅ Gerenciar dados financeiros de cadastros de clientes
- ✅ Visualizar dados do Atak
- ✅ Buscar condições de pagamento
- ❌ Criar/editar/desativar usuários
- ❌ Gerenciar categorias
- ❌ Configurações do sistema
- ❌ Relatórios administrativos avançados
- ❌ Deletar chamados

### Perfil: Administrador (Admin)

**Permissões:**
- ✅ **Todas as permissões** de Atendente e Usuário
- ✅ Gerenciar usuários (criar, editar, desativar, resetar senha)
- ✅ Gerenciar categorias
- ✅ Atribuir categorias para atendentes
- ✅ Configurações do sistema
- ✅ Acessar todos os relatórios
- ✅ Criar e gerenciar relatórios personalizados
- ✅ Dashboard administrativo completo
- ✅ Monitoramento de performance
- ✅ Deletar chamados
- ✅ Atualizar status de cadastros de clientes
- ✅ Reprocessar cadastros com erro
- ✅ Visualizar estatísticas de cadastros
- ✅ Acessar histórico completo

---

## Guia de Uso

### Como Criar um Chamado

1. **Acesse o Sistema**
   - Faça login com suas credenciais
   - Você será redirecionado para o Dashboard

2. **Navegue para Criar Chamado**
   - Clique em "Novo Chamado" no Dashboard, OU
   - Acesse o menu lateral → "Chamados" → "Novo Chamado"

3. **Preencha o Formulário**
   - **Categoria**: Selecione a categoria que melhor descreve sua solicitação
   - **Assunto**: Título claro e objetivo do chamado
   - **Descrição**: Detalhe sua solicitação com todas as informações relevantes
   - **Prioridade**: Selecione a urgência (Baixa, Média, Alta, Urgente)
   - **Anexos** (Opcional): Faça upload de arquivos relacionados

4. **Envie o Chamado**
   - Clique em "Criar Chamado"
   - Você receberá uma confirmação
   - O chamado será atribuído automaticamente a um atendente (se aplicável)

5. **Acompanhe**
   - Acesse "Chamados" no menu para ver seus chamados
   - Receba notificações em tempo real sobre atualizações
   - Você pode adicionar mensagens adicionais a qualquer momento

### Como Atender um Chamado (Atendente)

1. **Visualizar Chamados Atribuídos**
   - Acesse "Chamados" no menu
   - Veja a lista de chamados atribuídos a você
   - Chamados em vermelho indicam SLA próximo do vencimento

2. **Pegar um Chamado**
   - Em "Chamados", veja a lista de chamados em aberto
   - Clique em "Pegar Chamado" para assumir responsabilidade

3. **Atualizar Status**
   - Abra o chamado
   - Use os botões de ação para atualizar status:
     - "Em Andamento" - Você começou a trabalhar
     - "Aguardando Usuário" - Precisa de resposta do solicitante
     - "Aguardando Terceiros" - Aguardando resposta externa
     - "Solicitar Aprovação" - Envia para o solicitante aprovar

4. **Adicionar Mensagens**
   - Abra o chamado
   - Role até a seção de mensagens
   - Digite sua resposta e clique em "Enviar"
   - Você pode anexar arquivos às mensagens

5. **Fechar Chamado**
   - Quando o problema está resolvido, clique em "Fechar Chamado"
   - O solicitante receberá uma notificação
   - O chamado pode ser reaberto pelo solicitante se necessário

### Como Criar um Cadastro de Cliente

1. **Acesse Cadastros**
   - Menu lateral → "Cadastro de Clientes"
   - Clique em "Novo Cadastro"

2. **Preencha Informações Básicas**
   - Nome do cliente (razão social)
   - Nome fantasia (opcional)
   - CNPJ (será validado e consultado automaticamente)
   - Email
   - WhatsApp (opcional)

3. **Preencha Dados Comerciais**
   - Ramo de atividade
   - Vendedor responsável
   - Gestor responsável
   - Código da carteira
   - Lista de preço

4. **Preencha Informações Financeiras**
   - Forma de pagamento desejada
   - Prazo desejado (em dias)
   - Periodicidade de pedido
   - Valor estimado de pedido

5. **Upload de Imagens**
   - **Imagem Externa**: Foto da fachada do estabelecimento (obrigatório)
   - **Imagem Interna**: Foto do interior (obrigatório)
   - **Anexos**: Documentos adicionais (opcional)

6. **Informações Adicionais**
   - Forma de contato preferida
   - Rede social (opcional)
   - Link do Google Maps (opcional)

7. **Enviar Cadastro**
   - Clique em "Salvar"
   - O sistema iniciará automaticamente:
     - Consulta do CNPJ na Receita Federal
     - Análise de crédito (TESS/SPC)
     - Processamento em fila

8. **Acompanhar Status**
   - Visualize o status da consulta em tempo real
   - Receba notificações quando o processamento completar
   - Veja os dados extraídos da análise de crédito

### Como Gerar um Relatório

1. **Acesse Relatórios**
   - Menu lateral → "Relatórios" (apenas administradores)

2. **Escolha o Tipo**
   - Selecione um relatório pré-configurado OU
   - Crie um relatório personalizado

3. **Configure Parâmetros**
   - Período (data inicial e final)
   - Filtros (categoria, atendente, status, prioridade)
   - Campos a incluir (para relatórios personalizados)

4. **Execute**
   - Clique em "Gerar Relatório"
   - Aguarde o processamento
   - O resultado será exibido na tela

5. **Exportar**
   - Clique em "Exportar" e escolha o formato
   - Excel, CSV ou JSON
   - O arquivo será baixado automaticamente

6. **Agendar (Opcional)**
   - Clique em "Agendar"
   - Configure frequência (diária, semanal, mensal)
   - Adicione destinatários por email
   - O relatório será executado automaticamente

---

## Módulos Específicos

### Módulo de Cadastros de Clientes

#### Integrações

**1. API CNPJA (Receita Federal)**
- Consulta automática de dados da empresa
- Cache para evitar requisições repetidas
- Validação de CNPJ

**2. Sistema TESS/SPC**
- Consulta automática de análise de crédito
- Processamento de PDFs com IA
- Extração de dados estruturados:
  - Scores de crédito
  - Histórico de pagamentos
  - Ocorrências
  - Quadro societário
  - Dados de SCR

**3. Sistema Atak**
- Cadastro automático após aprovação
- Sincronização de dados financeiros
- Consulta de informações do cliente

#### Processo de Consulta de CNPJ

```
1. Usuário cria cadastro com CNPJ
   ↓
2. Sistema normaliza CNPJ (remove caracteres especiais)
   ↓
3. Verifica cache (últimas 24h)
   ↓
4. Se não estiver em cache:
   - Consulta API CNPJA
   - Salva resposta no cache
   ↓
5. Adiciona à fila de processamento
   ↓
6. Processa sequencialmente:
   - Baixa PDF do SPC
   - Processa com TESS AI
   - Extrai dados estruturados
   - Salva no banco SQL Server
   ↓
7. Atualiza status do cadastro
   ↓
8. Notifica usuário
```

#### Status de Cadastros

- **cadastro_enviado**: Cadastro criado, aguardando processamento
- **aguardando_analise_credito**: Processamento concluído, aguardando análise do administrador
- **cadastro_finalizado**: Aprovado e cadastrado no Atak

### Módulo de SLA (Service Level Agreement)

#### Como Funciona

Cada categoria possui dois SLAs configuráveis:

1. **SLA de Primeira Resposta**
   - Tempo máximo para primeira interação do atendente
   - Exemplo: 4 horas

2. **SLA de Resolução**
   - Tempo máximo para resolução do chamado
   - Exemplo: 24 horas

#### Cálculo Automático

- Ao criar um chamado, o sistema calcula automaticamente:
  - `sla_first_response` = `created_at` + `categoria.sla_first_response_hours`
  - `sla_resolution` = `created_at` + `categoria.sla_resolution_hours`

#### Alertas e Violações

- **Sistema monitora automaticamente**:
  - Chamados próximos do vencimento (vermelho no dashboard)
  - Violações de SLA (chamados em atraso)
  - Relatórios de cumprimento de SLA

#### Status Automáticos

- Se o SLA de primeira resposta é violado:
  - Status muda para `overdue_first_response`
- Se o SLA de resolução é violado:
  - Status muda para `overdue_resolution`

### Sistema de Notificações em Tempo Real

#### WebSocket

O sistema utiliza WebSocket para comunicação bidirecional:

- **Conexão**: `ws://localhost:3000/ws`
- **Autenticação**: Token JWT na conexão
- **Eventos**:
  - `ticket:created` - Novo chamado criado
  - `ticket:updated` - Chamado atualizado
  - `ticket:message` - Nova mensagem adicionada
  - `notification:new` - Nova notificação

#### Notificações Visuais

- Badge com contador no menu
- Notificações toast na tela
- Atualização automática de listas

### Sistema de Upload de Arquivos

#### Limites Configuráveis

- Tamanho máximo: Configurável em `system_config`
- Tipos permitidos: Configurável em `system_config`
- Localização: Diretório `uploads/`

#### Segurança

- Validação de tipo MIME
- Validação de tamanho
- Nomes de arquivo sanitizados
- Armazenamento seguro

---

## Configuração e Instalação

### Pré-requisitos

- Node.js 16 ou superior
- npm ou yarn
- SQLite3 (para sistema de chamados)
- SQL Server (para cadastros de clientes - opcional)
- Acesso à internet (para APIs externas)

### Instalação

#### 1. Clone o Repositório

```bash
git clone <url-do-repositorio>
cd sistema
```

#### 2. Instalar Dependências

```bash
npm run install:all
```

Este comando instala dependências do backend e frontend.

#### 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e configure:

```bash
cp env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Servidor
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# JWT
JWT_SECRET=sua_chave_secreta_aqui

# Email (Opcional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha
SMTP_FROM=noreply@sistema.com.br

# Banco de Dados SQL Server (Opcional - para cadastros)
DB_SERVER=localhost
DB_DATABASE=TessDataConsolidation
DB_USER=sa
DB_PASSWORD=sua_senha
DB_ENCRYPT=true
DB_TRUST_CERT=true

# Atak (Opcional - para integração)
ATAK_USERNAME=seu_usuario
ATAK_PASSWORD=sua_senha
ATAK_BASE_URL=https://atak.example.com
```

#### 4. Executar Migrações

```bash
npm run migrate
```

Isso criará todas as tabelas necessárias no banco de dados.

#### 5. Iniciar o Sistema

**Desenvolvimento:**
```bash
npm run dev:all
```

Isso inicia backend (porta 3000) e frontend (porta 3001) simultaneamente.

**Produção:**
```bash
npm run build:all
npm start
```

### Acesso ao Sistema

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

### Criar Primeiro Usuário Administrador

1. Acesse: http://localhost:3001/register
2. Preencha os dados
3. Selecione role "admin"
4. Faça login com as credenciais criadas

---

## Manutenção e Troubleshooting

### Logs do Sistema

Os logs são salvos em:
- `logs/` - Logs do sistema principal
- `logs/pm2-backend-out.log` - Saída do backend (PM2)
- `logs/pm2-backend-error.log` - Erros do backend (PM2)
- `logs/pm2-frontend-out.log` - Saída do frontend (PM2)
- `logs/pm2-frontend-error.log` - Erros do frontend (PM2)

### Problemas Comuns

#### 1. Erro ao Conectar ao Banco de Dados

**Sintoma**: Erro "Cannot connect to database"

**Solução**:
- Verifique se o SQLite está acessível
- Verifique permissões de escrita no diretório
- Execute `npm run migrate` novamente

#### 2. Porta Já em Uso

**Sintoma**: Erro "EADDRINUSE: address already in use"

**Solução**:
- Altere a porta no arquivo `.env`
- Ou encerre o processo que está usando a porta:
  ```bash
  # Windows
  netstat -ano | findstr :3000
  taskkill /PID <PID> /F
  ```

#### 3. Erro de Autenticação

**Sintoma**: Token inválido ou expirado

**Solução**:
- Faça logout e login novamente
- Verifique se `JWT_SECRET` está configurado no `.env`
- Limpe o cache do navegador

#### 4. Upload de Arquivos Falha

**Sintoma**: Erro ao fazer upload

**Solução**:
- Verifique permissões de escrita no diretório `uploads/`
- Verifique limites configurados em `system_config`
- Verifique espaço em disco

#### 5. Consulta de CNPJ Não Funciona

**Sintoma**: Cadastros ficam em "aguardando processamento"

**Solução**:
- Verifique conexão com internet
- Verifique logs em `cadastros/logs/`
- Verifique se a fila está processando: `/api/client-registrations/queue-status`
- Reprocesse manualmente: `/api/client-registrations/:id/reprocess`

### Backup

#### Backup do Banco SQLite

```bash
# Windows (PowerShell)
Copy-Item database.sqlite database.backup.sqlite

# Linux/Mac
cp database.sqlite database.backup.sqlite
```

#### Backup do Banco SQL Server

Use SQL Server Management Studio ou:
```bash
sqlcmd -S localhost -d TessDataConsolidation -Q "BACKUP DATABASE TessDataConsolidation TO DISK='C:\backup.bak'"
```

### Atualização do Sistema

1. **Fazer Backup**
   ```bash
   # Backup do banco
   cp database.sqlite database.backup.sqlite
   ```

2. **Atualizar Código**
   ```bash
   git pull origin main
   ```

3. **Instalar Novas Dependências**
   ```bash
   npm run install:all
   ```

4. **Executar Migrações**
   ```bash
   npm run migrate
   ```

5. **Recompilar**
   ```bash
   npm run build:all
   ```

6. **Reiniciar**
   ```bash
   npm start
   ```

### Monitoramento

#### Health Check

Acesse: http://localhost:3000/health

Resposta esperada:
```json
{
  "status": "OK",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

#### Métricas de Performance

Acesse: http://localhost:3000/api/performance/metrics (apenas admin)

---

## Segurança

### Autenticação e Autorização

- **JWT Tokens**: Tokens com expiração configurável
- **Hash de Senhas**: bcryptjs com salt rounds
- **Middleware de Autenticação**: Todas as rotas protegidas (exceto login/register)
- **Autorização por Role**: Controle de acesso baseado em permissões

### Proteções Implementadas

1. **Helmet.js**: Headers de segurança HTTP
2. **CORS**: Configurado para origens específicas
3. **Rate Limiting**: Proteção contra brute force (desabilitado em desenvolvimento)
4. **Validação de Dados**: Joi schemas para todas as entradas
5. **Sanitização**: Nomes de arquivos e inputs sanitizados
6. **SQL Injection**: Protegido com prepared statements

### Recomendações de Segurança

1. **Produção**:
   - Use `JWT_SECRET` forte e único
   - Configure `NODE_ENV=production`
   - Habilite HTTPS
   - Configure firewall adequadamente
   - Use rate limiting em produção

2. **Senhas**:
   - Exija senhas fortes
   - Implemente política de expiração (futuro)
   - Use 2FA para administradores (futuro)

3. **Banco de Dados**:
   - Backup regular
   - Acesso restrito
   - Senhas fortes

4. **Upload de Arquivos**:
   - Validação rigorosa de tipos
   - Limites de tamanho
   - Antivírus (recomendado)

---

## Glossário

- **SLA (Service Level Agreement)**: Acordo de nível de serviço - tempo máximo para resposta ou resolução
- **Ticket/Chamado**: Solicitação de suporte registrada no sistema
- **Atendente**: Usuário com permissão para resolver chamados
- **Solicitante**: Usuário que criou o chamado
- **Categoria**: Classificação do chamado (ex: Financeiro, Contábil, etc.)
- **Prioridade**: Nível de urgência (Baixa, Média, Alta, Urgente)
- **Status**: Estado atual do chamado (Aberto, Em Andamento, Resolvido, etc.)
- **CNPJ**: Cadastro Nacional da Pessoa Jurídica
- **TESS/SPC**: Sistema de análise de crédito
- **Atak**: Sistema ERP integrado
- **WebSocket**: Protocolo de comunicação em tempo real
- **JWT**: JSON Web Token - método de autenticação
- **API**: Application Programming Interface - interface de comunicação
- **Cache**: Armazenamento temporário para melhor performance

---

## Suporte e Contato

Para suporte técnico ou dúvidas sobre o sistema, entre em contato com a equipe de desenvolvimento.

**Documentação da API**: Consulte `DOCUMENTACAO_API.md` para detalhes técnicos da API REST.

---

**Última Atualização**: 2025  
**Versão do Documento**: 1.0.0

