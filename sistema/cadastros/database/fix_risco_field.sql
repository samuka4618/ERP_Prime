-- Corrigir campo risco na tabela score_credito
USE consultas_tess;
GO

-- Verificar se a coluna existe e seu tipo atual
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'score_credito' AND COLUMN_NAME = 'risco';
GO

-- Alterar o tipo da coluna risco para VARCHAR(50)
ALTER TABLE score_credito 
ALTER COLUMN risco VARCHAR(50);
GO

-- Verificar se a alteração foi aplicada
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'score_credito' AND COLUMN_NAME = 'risco';
GO

PRINT 'Campo risco alterado para VARCHAR(50) com sucesso!';
GO
