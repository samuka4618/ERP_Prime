-- Adicionar campos para condição de pagamento e limite de crédito
-- Compatível com SQL Server

USE consultas_tess;
GO

-- Adicionar campo condicao_pagamento_id se não existir
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'condicao_pagamento_id')
BEGIN
    ALTER TABLE client_registrations ADD condicao_pagamento_id VARCHAR(50) NULL;
    PRINT 'Campo condicao_pagamento_id adicionado à tabela client_registrations';
END
ELSE
BEGIN
    PRINT 'Campo condicao_pagamento_id já existe na tabela client_registrations';
END
GO

-- Adicionar campo limite_credito se não existir
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'limite_credito')
BEGIN
    ALTER TABLE client_registrations ADD limite_credito DECIMAL(15,2) NULL;
    PRINT 'Campo limite_credito adicionado à tabela client_registrations';
END
ELSE
BEGIN
    PRINT 'Campo limite_credito já existe na tabela client_registrations';
END
GO

-- Adicionar campo para indicar se os dados foram enviados ao Atak
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('client_registrations') AND name = 'dados_financeiros_enviados_atak')
BEGIN
    ALTER TABLE client_registrations ADD dados_financeiros_enviados_atak BIT DEFAULT 0;
    PRINT 'Campo dados_financeiros_enviados_atak adicionado à tabela client_registrations';
END
ELSE
BEGIN
    PRINT 'Campo dados_financeiros_enviados_atak já existe na tabela client_registrations';
END
GO

PRINT 'Verificação concluída!';
GO

