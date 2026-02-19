-- Script para adicionar o campo atak_cliente_id caso tenha faltado
-- Compatível com SQL Server

USE consultas_tess;
GO

-- Verificar e adicionar o campo atak_cliente_id se não existir
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'atak_cliente_id')
BEGIN
    ALTER TABLE client_registrations ADD atak_cliente_id INT NULL;
    PRINT 'Campo atak_cliente_id adicionado com sucesso!';
END
ELSE
BEGIN
    PRINT 'Campo atak_cliente_id já existe na tabela client_registrations';
END
GO

-- Adicionar índice se não existir
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_client_registrations_atak_cliente_id' AND object_id = OBJECT_ID('client_registrations'))
BEGIN
    CREATE INDEX IX_client_registrations_atak_cliente_id ON client_registrations(atak_cliente_id);
    PRINT 'Índice IX_client_registrations_atak_cliente_id criado com sucesso!';
END
ELSE
BEGIN
    PRINT 'Índice IX_client_registrations_atak_cliente_id já existe';
END
GO

PRINT 'Verificação concluída!';

