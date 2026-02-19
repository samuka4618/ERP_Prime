-- Script para adicionar constraint UNIQUE no CNPJ da tabela client_registrations
-- Isso previne cadastros duplicados no nível do banco de dados

USE consultas_tess;
GO

-- 1. Primeiro, normalizar todos os CNPJs existentes (remover formatação)
-- Remove pontos, barras, traços e espaços, deixando apenas números
UPDATE client_registrations
SET cnpj = REPLACE(REPLACE(REPLACE(REPLACE(cnpj, '.', ''), '/', ''), '-', ''), ' ', '')
WHERE cnpj LIKE '%.%' OR cnpj LIKE '%/%' OR cnpj LIKE '%-%';
GO

-- 2. Identificar e tratar registros duplicados (manter apenas o mais recente)
-- Primeiro, vamos listar os duplicados
SELECT 
    cnpj,
    COUNT(*) as total_duplicados,
    STRING_AGG(CAST(id AS VARCHAR), ', ') as ids
FROM client_registrations
GROUP BY cnpj
HAVING COUNT(*) > 1;
GO

-- 3. Opcional: Remover duplicados mantendo apenas o registro mais recente
-- DESCOMENTE AS LINHAS ABAIXO APENAS SE DESEJAR REMOVER AUTOMATICAMENTE OS DUPLICADOS
/*
WITH Duplicados AS (
    SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY cnpj ORDER BY created_at DESC) as rn
    FROM client_registrations
)
DELETE FROM client_registrations
WHERE id IN (
    SELECT id FROM Duplicados WHERE rn > 1
);
GO
*/

-- 4. Criar índice único no CNPJ
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_client_registrations_cnpj' AND object_id = OBJECT_ID('client_registrations'))
BEGIN
    CREATE UNIQUE INDEX UQ_client_registrations_cnpj 
    ON client_registrations(cnpj);
    PRINT 'Índice único criado com sucesso na coluna cnpj';
END
ELSE
BEGIN
    PRINT 'Índice único já existe na coluna cnpj';
END
GO

-- 5. Verificar se a constraint foi criada
SELECT 
    i.name AS index_name,
    i.is_unique,
    i.is_primary_key,
    COL_NAME(ic.object_id, ic.column_id) AS column_name
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
WHERE i.object_id = OBJECT_ID('client_registrations')
    AND i.name = 'UQ_client_registrations_cnpj';
GO

