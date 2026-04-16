# Backup e Restore do Sistema

O ERP Prime possui backup/restore unificado para **SQLite e PostgreSQL**, com catálogo versionado, validação pré-restore e assinatura de integridade via HMAC.

## O que entra no backup

- **Banco principal**
  - SQLite: `database/chamados.db`
  - PostgreSQL: `database/postgres.dump` (gerado com `pg_dump -Fc`)
- **Storage completo**
  - `storage/uploads`
  - `storage/images`
  - `storage/avatars`
- **Configuração operacional**
  - `config/environment.snapshot.json` ou `config/environment.snapshot.enc` (se `BACKUP_ENCRYPTION_KEY` estiver configurada)
- **Logs de aplicação (opcional)**
  - `logs/*` quando `BACKUP_INCLUDE_LOGS=true` (padrão)
- **Metadados**
  - `manifest.json` com `items`, checksums, engine e assinatura (`integrity.manifestHmac`) quando `BACKUP_HMAC_KEY` estiver configurada

## Endpoints principais

- `GET /api/system/backup`
  - Gera e baixa o ZIP de backup
- `POST /api/system/backup/validate`
  - Valida o arquivo (estrutura, manifest, assinatura, limites) sem aplicar restore
  - Body: `multipart/form-data` com campo `file`
- `POST /api/system/restore`
  - Executa restore completo
  - Body: `multipart/form-data` com campo `file`
  - Limite: 500 MB
- `GET /api/system/backup/health`
  - Estado operacional do agendamento de backup (última execução, último erro, retenção, execução em andamento)
- `GET /api/system/backup/post-restore-checks`
  - Executa checklist técnico de verificação pós-restore sob demanda

## Restore: comportamento

- Valida ZIP e `manifest.json` antes de aplicar
- Rejeita restore com engine diferente do ambiente atual
- Aplica restore de banco via adapter:
  - SQLite: cria `chamados.db.restored` para aplicação no restart
  - PostgreSQL: executa `pg_restore --single-transaction --clean --if-exists`
- Restaura storage (`uploads/images/avatars`) com estratégia de rollback por diretório
- Salva snapshot de configuração em `data/backups/.env.restore.suggested` (não aplicado automaticamente)
- Retorna checklist pós-restore no payload (`data.checks`) com resumo de itens aprovados/falhos

## Segurança e integridade

- **HMAC do manifest**: configure `BACKUP_HMAC_KEY` para assinar e validar backup
- **Snapshot de configuração criptografado**: configure `BACKUP_ENCRYPTION_KEY`
- **Validação pré-restore** disponível para reduzir risco operacional
- **Audit log** de criação/restauração permanece ativo

## Automação e retenção

Automação opcional via variáveis:

- `BACKUP_AUTO_ENABLED=true`
- `BACKUP_AUTO_EVERY_MINUTES=720` (default: 12h)
- `BACKUP_RETENTION_COUNT=30`
- `BACKUP_OFFSITE_PATH=/caminho/offsite` (opcional)
- `BACKUP_OFFSITE_RETENTION_COUNT=30` (opcional)

Backups automáticos ficam em `data/backups/archives/`.

## Requisitos de PostgreSQL

Em ambientes PostgreSQL, o host precisa ter `pg_dump` e `pg_restore` disponíveis no PATH.

## Itens fora do escopo automático

- Bancos externos do módulo Cadastros (ex.: SQL Server) devem seguir política de backup própria do respectivo banco.
