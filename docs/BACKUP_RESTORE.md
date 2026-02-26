# Backup e Restore do Sistema

O ERP Prime permite gerar um **arquivo único de backup** (ZIP) contendo o banco de dados SQLite e todo o storage (uploads, imagens, logo). Esse arquivo pode ser usado para recuperar o sistema após falhas ou para realizar uma nova instalação com os mesmos dados.

## O que entra no backup

- **Banco de dados**: `data/database/chamados.db` (usuários, chamados, relatórios, compras, descarregamento, configurações do sistema, templates de e-mail, auditoria, permissões).
- **Storage**: `storage/uploads` (anexos, logo do sistema) e `storage/images` (imagens de cadastros).

## O que NÃO entra no backup

- **Arquivo `.env`**: nunca é incluído (segredos: JWT, SMTP, Infobip, etc.). Em nova instalação, configure o `.env` a partir do `env.example` (copie para `.env` e preencha).
- **Dados do módulo Cadastros (SQL Server)**: ficam em banco externo. Para backup dos cadastros, use as ferramentas nativas do SQL Server (BACKUP DATABASE, bcp ou solução do provedor).

## Gerar backup

**Requisito**: usuário administrador (ou permissão `system.backup.create`).

- **Pela API**: `GET /api/system/backup`  
  - Retorna o arquivo ZIP para download (nome no formato `erp-backup-YYYYMMDDTHHmmss.zip`).
- **Pela interface**: acesse a área de Administração > Backup e Restore (se disponível) e clique em "Gerar backup".

O backup é gerado em tempo real (stream). Antes de compactar, o sistema executa um checkpoint WAL no SQLite para garantir que o arquivo do banco esteja consistente.

## Restaurar backup

**Requisito**: usuário administrador (ou permissão `system.backup.restore`).

- **Pela API**: `POST /api/system/restore`  
  - Body: `multipart/form-data` com campo **`file`** contendo o arquivo ZIP.  
  - Tamanho máximo: 500 MB.

Após a restauração:

1. O banco de dados em `data/database/chamados.db` é substituído pelo do backup.
2. As pastas `storage/uploads` e `storage/images` são sobrescritas com o conteúdo do backup.
3. **Reinicie o servidor** para que a aplicação utilize o banco restaurado.

## Estrutura do arquivo ZIP

```
erp-backup-YYYYMMDDTHHmmss.zip
├── manifest.json          # Versão do backup, data, versão da aplicação, lista de itens
├── database/
│   └── chamados.db
├── storage/
│   ├── uploads/
│   └── images/
```

O `manifest.json` contém:

- `backupVersion`: versão do formato do backup (compatibilidade futura).
- `appVersion`: versão da aplicação que gerou o backup.
- `createdAt`: data/hora de criação (ISO 8601).
- `contents`: lista de paths incluídos no backup.

## Nova instalação usando o backup

1. Instale as dependências e faça o build do projeto.
2. Crie as pastas necessárias: `data/database/`, `storage/uploads/`, `storage/images/`.
3. Configure o `.env` a partir do `.env.example` (não copie o `.env` do ambiente antigo com senhas).
4. Inicie o servidor uma vez (para criar o banco vazio e migrações, se aplicável) ou restaure antes do primeiro start.
5. Restaure o backup:
   - **Opção A**: após o primeiro start, faça login como admin (se existir usuário seed) e chame `POST /api/system/restore` com o ZIP; depois reinicie o servidor.
   - **Opção B**: use um script que extraia o ZIP e coloque `database/chamados.db` em `data/database/` e `storage/*` em `storage/`; na primeira subida a aplicação usará esse banco.

## Segurança e auditoria

- Apenas administradores (ou perfis com as permissões de backup) podem gerar e restaurar backup.
- As ações **Gerar backup** e **Restaurar backup** são registradas na auditoria do sistema (`system.backup.create`, `system.backup.restore`), com usuário, data/hora e IP.

## Limites e boas práticas

- **Tamanho**: o backup pode ficar grande se houver muitos anexos. O limite de upload para restore é 500 MB.
- **Frequência**: recomenda-se gerar backups periódicos (diário/semanal) e armazená-los em local seguro (outro servidor ou nuvem).
- **Cadastros (SQL Server)**: faça backup separado do banco de cadastros conforme a política do seu ambiente.
