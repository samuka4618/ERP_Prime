-- Adicionar campo SUFRAMA à tabela empresa
-- Executar após a criação das tabelas principais

USE consultas_tess;
GO

-- Adicionar campo inscricao_suframa à tabela empresa
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('empresa') AND name = 'inscricao_suframa')
BEGIN
    ALTER TABLE empresa ADD inscricao_suframa VARCHAR(50);
    PRINT 'Campo inscricao_suframa adicionado à tabela empresa';
END
ELSE
BEGIN
    PRINT 'Campo inscricao_suframa já existe na tabela empresa';
END
GO

-- Adicionar campo para salvar resposta completa do CNPJÁ
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('empresa') AND name = 'cnpja_response')
BEGIN
    ALTER TABLE empresa ADD cnpja_response NVARCHAR(MAX);
    PRINT 'Campo cnpja_response adicionado à tabela empresa';
END
ELSE
BEGIN
    PRINT 'Campo cnpja_response já existe na tabela empresa';
END
GO

-- Adicionar campos adicionais para dados do CNPJÁ
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('empresa') AND name = 'nome_fantasia')
BEGIN
    ALTER TABLE empresa ADD nome_fantasia VARCHAR(500);
    PRINT 'Campo nome_fantasia adicionado à tabela empresa';
END
ELSE
BEGIN
    PRINT 'Campo nome_fantasia já existe na tabela empresa';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('empresa') AND name = 'porte')
BEGIN
    ALTER TABLE empresa ADD porte VARCHAR(100);
    PRINT 'Campo porte adicionado à tabela empresa';
END
ELSE
BEGIN
    PRINT 'Campo porte já existe na tabela empresa';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('empresa') AND name = 'natureza_juridica')
BEGIN
    ALTER TABLE empresa ADD natureza_juridica VARCHAR(200);
    PRINT 'Campo natureza_juridica adicionado à tabela empresa';
END
ELSE
BEGIN
    PRINT 'Campo natureza_juridica já existe na tabela empresa';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('empresa') AND name = 'capital_social')
BEGIN
    ALTER TABLE empresa ADD capital_social DECIMAL(15, 2);
    PRINT 'Campo capital_social adicionado à tabela empresa';
END
ELSE
BEGIN
    PRINT 'Campo capital_social já existe na tabela empresa';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('empresa') AND name = 'atividade_principal')
BEGIN
    ALTER TABLE empresa ADD atividade_principal VARCHAR(500);
    PRINT 'Campo atividade_principal adicionado à tabela empresa';
END
ELSE
BEGIN
    PRINT 'Campo atividade_principal já existe na tabela empresa';
END
GO

PRINT 'Migração concluída com sucesso!';
