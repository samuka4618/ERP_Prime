-- Adicionar tabela de configuração para Condições de Pagamento
-- Compatível com SQL Server

USE consultas_tess;
GO

-- Criar tabela de configuração: Condição de Pagamento
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'client_config_condicao_pagamento')
BEGIN
    CREATE TABLE client_config_condicao_pagamento (
        id INT IDENTITY(1,1) PRIMARY KEY,
        nome NVARCHAR(255) NOT NULL,
        descricao NVARCHAR(500),
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );
    PRINT 'Tabela client_config_condicao_pagamento criada com sucesso';
END
ELSE
BEGIN
    PRINT 'Tabela client_config_condicao_pagamento já existe';
END
GO

-- Inserir alguns exemplos de condições de pagamento (ajustar conforme necessário)
IF NOT EXISTS (SELECT * FROM client_config_condicao_pagamento)
BEGIN
    INSERT INTO client_config_condicao_pagamento (nome, descricao, is_active) VALUES
    ('001', 'À Vista', 1),
    ('002', '30 Dias', 1),
    ('003', '60 Dias', 1),
    ('004', '90 Dias', 1),
    ('005', '30/60/90 Dias', 1);
    
    PRINT 'Exemplos de condições de pagamento inseridos';
END
ELSE
BEGIN
    PRINT 'Condições de pagamento já existem na tabela';
END
GO

PRINT 'Script executado com sucesso!';
GO

