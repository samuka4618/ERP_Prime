# Estrutura do projeto ERP PRIME

Este documento descreve a **organização de diretórios** do repositório. Para arquitetura funcional, módulos e fluxos, veja o **[MANUAL_COMPLETO_ERP_PRIME.md](./MANUAL_COMPLETO_ERP_PRIME.md)** e o **[índice de documentação](./INDICE_DOCUMENTACAO.md)**.

---

## Árvore de diretórios (visão atual)

```
ERP_Prime/
├── src/                          # Backend TypeScript (entry: server.ts)
│   ├── config/                   # database.ts, sqlserver.ts (env)
│   ├── core/                     # auth, users, permissions, system, database, audit, backup
│   ├── modules/
│   │   ├── chamados/             # tickets, categorias, anexos, relatórios, realtime
│   │   ├── cadastros/            # client-registrations, client-config, analise-credito
│   │   ├── compras/              # solicitações, orçamentos, aprovadores, compradores, anexos
│   │   └── descarregamento/      # agendamentos, fornecedores, docas, formulários, SMS, satélite
│   ├── shared/                   # middleware, utils, types
│   ├── database/                 # migrate.ts (script npm run migrate na raiz)
│   └── server.ts               # Express, /api, estáticos, WS, pollers
│
├── frontend/                     # SPA React (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── hooks/
│   │   ├── pages/                # Chamados, Cadastros, Compras/, Descarregamento/, admin...
│   │   ├── services/             # api.ts
│   │   ├── types/
│   │   └── utils/
│   ├── dist/                     # Build de produção (npm run build)
│   ├── MODULOS.md
│   └── FRONTEND_BEST_PRACTICES.md
│
├── RailwaySatellite/             # Serviço público (Railway): API + web/ (React motorista)
│   ├── src/
│   └── web/
│
├── data/                         # SQLite local (DB_PATH), backups
├── storage/                      # uploads, images, avatars (paths por env)
├── logs/                         # Logs da aplicação / PM2 (se usados)
├── scripts/                      # nginx, PM2, SSL, copy-schema, reset-db, create-user...
├── nginx/                        # Exemplos de configuração proxy
├── docs/                         # Documentação (manual completo, deploy, API...)
├── tests/                        # Jest (ex.: tests/auth, tests/schemas)
├── tools/
│   └── cadastros-legacy/         # Ferramentas / integrações legadas
├── sistema/                      # Árvore legada/paralela (não é o entrypoint do package.json raiz)
│
├── docker-compose.postgres.yml
├── package.json
├── tsconfig.json
├── vercel.json
├── .env.example
└── README.md
```

---

## Descrição das pastas principais

### `src/`

Backend modular: cada pasta em `modules/` regista as suas rotas no `apiRouter` a partir de `server.ts`. O núcleo transversal fica em `core/`.

### `frontend/`

Interface única do ERP para utilizadores autenticados e rotas públicas selecionadas (ex.: formulário de descarregamento).

### `RailwaySatellite/`

Microserviço opcional: Postgres dedicado, rotas `/internal` (ERP) e `/api/public` + UI em `/d/:slug` e `/t/:token`.

### `data/` e `storage/`

- **data/** — persistência SQLite quando não se usa Postgres no ERP.
- **storage/** — ficheiros submetidos pelos utilizadores (deve entrar nos backups).

### `scripts/` e `nginx/`

Automação de arranque (Node + Nginx opcional), PM2, certificados e tarefas de manutenção.

### `docs/`

Documentação Markdown; o ficheiro central de produto é `MANUAL_COMPLETO_ERP_PRIME.md`.

### `tests/`

Testes Jest (estrutura pode crescer; atualmente inclui testes de auth e schemas).

### `tools/cadastros-legacy/`

Código e scripts históricos de cadastros — não confundir com `src/modules/cadastros/`.

### `sistema/`

Projeto ou monorepo antigo em paralelo. **Não** substitui `src/` + `frontend/` para o comando `npm run dev` da raiz.

---

## Migração de estrutura antiga (histórico)

Alterações já consolidadas no layout atual:

1. Bases SQLite em `data/database/`
2. Logs centralizados em `logs/` (quando aplicável)
3. Uploads em `storage/uploads/` e imagens em `storage/images/`
4. Scripts operacionais em `scripts/`
5. Documentação em `docs/`
6. Cadastros de negócio no módulo `src/modules/cadastros/`; legado em `tools/cadastros-legacy/`

---

## Convenções

- **Pastas:** minúsculas; hífen quando fizer sentido (`category-assignments` na API é kebab-case).
- **Código TypeScript:** camelCase para variáveis/funções; PascalCase para classes/componentes React.
- **Permissões:** `modulo.recurso.acao` (ex.: `descarregamento.agendamentos.view`).

---

## Manutenção

Ao criar um novo módulo ou pasta de topo:

1. Atualizar a árvore acima e o [MANUAL_COMPLETO_ERP_PRIME.md](./MANUAL_COMPLETO_ERP_PRIME.md).
2. Se for módulo de API, registar em `src/server.ts` e documentar o prefixo `/api/...`.
