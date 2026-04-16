# Política de Backup do ERP Prime

## Objetivo
Definir padrão operacional para backup e restauração do ERP Prime com foco em disponibilidade, integridade e segurança.

## Princípios

- Estratégia **3-2-1-1-0**
  - 3 cópias dos dados
  - 2 mídias/localizações distintas
  - 1 cópia off-site
  - 1 cópia imutável quando possível
  - 0 erros em teste de restauração
- Menor privilégio para operação de backup/restore
- Testes periódicos de restauração (não apenas geração de backup)

## RPO/RTO recomendados

- **RPO**: até 12h (backups automáticos semestrais/diários conforme criticidade)
- **RTO**: até 2h para restore completo em ambiente padrão

## Escopo obrigatório de backup

- Banco principal (SQLite ou PostgreSQL)
- Storage: uploads, images, avatars
- Manifest com checksums e assinatura
- Snapshot de configuração operacional

## Frequência e retenção

- Produção: backup automático a cada 12h
- Retenção local: 30 arquivos
- Retenção off-site: 30 arquivos
- Backup manual obrigatório antes de mudanças críticas (deploy estrutural, migração, manutenção)

## Segurança

- `BACKUP_HMAC_KEY` obrigatório em produção
- `BACKUP_ENCRYPTION_KEY` obrigatório em produção
- Armazenar chaves em cofre de segredos (não em repositório)
- Rotação semestral de chaves e revisão de acesso trimestral

## Operação padrão

1. Validar backup via `POST /api/system/backup/validate`
2. Registrar ticket de mudança/janela
3. Executar restore
4. Reiniciar serviço
5. Executar checklist pós-restore
6. Arquivar relatório e evidências

## Monitoramento

- Alertar falhas de backup automático
- Alertar falhas de validação/restore
- Revisar espaço em disco de `data/backups/archives`
