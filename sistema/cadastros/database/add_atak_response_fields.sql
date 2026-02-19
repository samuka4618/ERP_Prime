-- Adicionar campos para armazenar resposta do sistema Atak
-- Compatível com SQL Server

USE consultas_tess;
GO

-- Adicionar campos na tabela client_registrations se não existirem
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'atak_cliente_id')
BEGIN
    ALTER TABLE client_registrations ADD atak_cliente_id INT NULL;
    PRINT 'Campo atak_cliente_id adicionado à tabela client_registrations';
END
ELSE
BEGIN
    PRINT 'Campo atak_cliente_id já existe na tabela client_registrations';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'atak_resposta_json')
BEGIN
    ALTER TABLE client_registrations ADD atak_resposta_json NVARCHAR(MAX) NULL;
    PRINT 'Campo atak_resposta_json adicionado à tabela client_registrations';
END
ELSE
BEGIN
    PRINT 'Campo atak_resposta_json já existe na tabela client_registrations';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'atak_data_cadastro')
BEGIN
    ALTER TABLE client_registrations ADD atak_data_cadastro DATETIME2 NULL;
    PRINT 'Campo atak_data_cadastro adicionado à tabela client_registrations';
END
ELSE
BEGIN
    PRINT 'Campo atak_data_cadastro já existe na tabela client_registrations';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'atak_erro')
BEGIN
    ALTER TABLE client_registrations ADD atak_erro NVARCHAR(500) NULL;
    PRINT 'Campo atak_erro adicionado à tabela client_registrations';
END
ELSE
BEGIN
    PRINT 'Campo atak_erro já existe na tabela client_registrations';
END
GO

-- Adicionar índices para melhor performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_client_registrations_atak_cliente_id')
BEGIN
    CREATE INDEX IX_client_registrations_atak_cliente_id ON client_registrations(atak_cliente_id);
    PRINT 'Índice IX_client_registrations_atak_cliente_id criado';
END
GO

-- Comentários
EXEC sp_addextendedproperty 'MS_Description', 'ID do cliente no sistema Atak', 'SCHEMA', 'dbo', 'TABLE', 'client_registrations', 'COLUMN', 'atak_cliente_id';
EXEC sp_addextendedproperty 'MS_Description', 'Resposta completa do cadastro no Atak em formato JSON', 'SCHEMA', 'dbo', 'TABLE', 'client_registrations', 'COLUMN', 'atak_resposta_json';
EXEC sp_addextendedproperty 'MS_Description', 'Data em que o cadastro foi enviado para o Atak', 'SCHEMA', 'dbo', 'TABLE', 'client_registrations', 'COLUMN', 'atak_data_cadastro';
EXEC sp_addextendedproperty 'MS_Description', 'Mensagem de erro caso o cadastro no Atak falhe', 'SCHEMA', 'dbo', 'TABLE', 'client_registrations', 'COLUMN', 'atak_erro';

GO

PRINT 'Campos do Atak adicionados com sucesso!';

