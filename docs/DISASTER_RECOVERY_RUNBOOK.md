# Runbook de Disaster Recovery (ERP Prime)

## Pré-requisitos

- Janela de manutenção aprovada
- Acesso administrativo ao ERP
- Backup validado previamente (`/api/system/backup/validate`)
- Chaves de integridade disponíveis (`BACKUP_HMAC_KEY`, `BACKUP_ENCRYPTION_KEY` quando aplicável)

## Fluxo de recuperação

1. **Congelar mudanças**
   - Interromper operações administrativas críticas
2. **Validar artefato**
   - Subir arquivo em `POST /api/system/backup/validate`
   - Confirmar `valid=true`
3. **Executar restore**
   - Subir arquivo em `POST /api/system/restore`
4. **Reiniciar aplicação**
   - Obrigatório para aplicação completa do restore SQLite
5. **Checklist pós-restore**
   - Login administrativo
   - Consulta de chamados
   - Consulta de agendamentos de relatório
   - Verificação de anexos/imagens/avatares
   - Verificação de permissões e auditoria
6. **Encerrar incidente**
   - Registrar horário de início/fim
   - Registrar backup aplicado (timestamp e versão)
   - Registrar validações executadas

## Rollback operacional

- Se falhar durante restore de storage, o sistema reverte os diretórios automaticamente.
- Em PostgreSQL, restore é executado com `--single-transaction`.
- Em SQLite, o arquivo ativo permanece até o restart aplicar `*.restored`.

## Verificações manuais recomendadas

- Tabelas críticas com contagem esperada (usuários, chamados, categorias, permissões)
- Integridade de arquivos anexos mais recentes
- Conferência de `data/backups/.env.restore.suggested` para ajustes de configuração

## Critérios de sucesso

- API saudável (`/health`)
- Usuários autenticam normalmente
- Módulos principais operacionais (Chamados, Cadastros, Compras, Descarregamento)
- Relatórios/agendamentos executando após recuperação
