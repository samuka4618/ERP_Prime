# Guia de Migração da Estrutura

Este documento descreve as mudanças realizadas na reorganização da estrutura do projeto para um ERP profissional.

## 📋 Mudanças Realizadas

### 1. Reorganização de Pastas

#### Antes → Depois

| Antes | Depois | Descrição |
|-------|--------|-----------|
| `database/` | `data/database/` | Bancos de dados movidos para pasta data |
| `database.sqlite` | `data/database/` | Banco SQLite movido |
| `uploads/` | `storage/uploads/` | Uploads movidos para storage |
| `imgCadastros/` | `storage/images/` | Imagens movidas para storage |
| `logs/` (espalhados) | `logs/` (centralizado) | Todos os logs centralizados |
| `cadastros/` | `tools/cadastros-legacy/` | Sistema legado movido para tools |
| `DOCUMENTACAO_*.md` | `docs/` | Documentação organizada |
| `pm2-*.js`, `pm2-*.bat` | `scripts/` | Scripts de automação organizados |
| `test-*.js` | `scripts/` | Scripts de teste movidos |
| `dist/` (antigo) | Removido | Build antigo removido |
| `public/` (vazio) | Removido | Pasta vazia removida |

### 2. Novas Pastas Criadas

- `data/` - Dados do sistema
  - `database/` - Bancos de dados
  - `backups/` - Backups automáticos
- `storage/` - Armazenamento de arquivos
  - `uploads/` - Arquivos enviados
  - `images/` - Imagens
- `scripts/` - Scripts de automação
- `docs/` - Documentação
- `tools/` - Ferramentas auxiliares
- `tests/` - Testes organizados
  - `unit/` - Testes unitários
  - `integration/` - Testes de integração
  - `e2e/` - Testes end-to-end

### 3. Arquivos de Configuração Atualizados

#### `src/config/database.ts`
- `DB_PATH`: `./database/chamados.db` → `./data/database/chamados.db`
- `UPLOAD_PATH`: `./uploads` → `./storage/uploads`
- Adicionado: `IMAGES_PATH`: `./storage/images`

#### `src/server.ts`
- Rotas de arquivos estáticos atualizadas:
  - `/imgCadastros` → `/storage/images` (com compatibilidade)
  - `/uploads` → `/storage/uploads` (com compatibilidade)

#### `src/shared/middleware/upload.ts`
- Caminho de uploads atualizado para `storage/uploads`

#### `src/shared/middleware/uploadClientImages.ts`
- Caminho de imagens atualizado para `storage/images`

#### `src/core/database/migrate.js`
- Caminho do banco atualizado para `data/database/chamados.db`

## 🔄 Compatibilidade

Para manter compatibilidade com código existente, foram adicionadas rotas de redirecionamento:
- `/imgCadastros` → `/storage/images`
- `/uploads` → `/storage/uploads`

## 📝 Variáveis de Ambiente

Atualize seu arquivo `.env` com os novos caminhos:

```env
# Banco de dados
DB_PATH=./data/database/chamados.db

# Armazenamento
UPLOAD_PATH=./storage/uploads
IMAGES_PATH=./storage/images
```

## ✅ Checklist de Migração

- [x] Mover databases para `data/database/`
- [x] Mover uploads para `storage/uploads/`
- [x] Mover imagens para `storage/images/`
- [x] Centralizar logs em `logs/`
- [x] Mover scripts para `scripts/`
- [x] Mover documentação para `docs/`
- [x] Mover sistema legado para `tools/`
- [x] Atualizar configurações
- [x] Atualizar rotas de arquivos estáticos
- [x] Criar `.gitignore` apropriado
- [x] Criar arquivos `.gitkeep` para pastas vazias

## 🚨 Ações Necessárias

1. **Atualizar variáveis de ambiente**: Configure as novas variáveis no `.env`
2. **Verificar permissões**: Certifique-se de que as pastas `data/` e `storage/` têm permissões de escrita
3. **Backup**: Faça backup dos dados antes de executar em produção
4. **Testar rotas**: Verifique se as rotas de arquivos estáticos estão funcionando

## 📚 Documentação Relacionada

- [ESTRUTURA_PROJETO.md](./ESTRUTURA_PROJETO.md) - Estrutura completa do projeto
- [README.md](../README.md) - Documentação principal

