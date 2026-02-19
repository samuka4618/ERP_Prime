-- Stored Procedures para o novo schema TESS/SPC
-- Compatível com SQL Server

USE consultas_tess;
GO

-- ==============================================
-- PROCEDURE: sp_InserirConsultaTESSCompleta
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirConsultaTESSCompleta
    @operador VARCHAR(255),
    @data_hora DATETIME,
    @produto VARCHAR(255),
    @protocolo VARCHAR(50),
    @cnpj VARCHAR(18),
    @razao_social VARCHAR(500),
    @situacao_cnpj VARCHAR(50) = NULL,
    @atualizacao DATETIME = NULL,
    @fundacao DATE = NULL,
    @logradouro VARCHAR(255) = NULL,
    @numero VARCHAR(20) = NULL,
    @complemento VARCHAR(255) = NULL,
    @bairro VARCHAR(100) = NULL,
    @cidade VARCHAR(100) = NULL,
    @estado VARCHAR(2) = NULL,
    @cep VARCHAR(10) = NULL,
    @telefones_fixos NVARCHAR(MAX) = NULL,
    @telefones_celulares NVARCHAR(MAX) = NULL,
    @emails NVARCHAR(MAX) = NULL,
    @score_pj INT = NULL,
    @limite_credito_pj DECIMAL(15,2) = NULL,
    @gasto_financeiro_estimado DECIMAL(15,2) = NULL,
    @score_credito INT = NULL,
    @risco VARCHAR(50) = NULL,
    @probabilidade_inadimplencia DECIMAL(5,2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @consultaId INT;
    DECLARE @empresaId INT;
    DECLARE @enderecoId INT;
    DECLARE @dadosContatoId INT;
    DECLARE @ocorrenciasId INT;
    DECLARE @scoreCreditoId INT;
    
    BEGIN TRANSACTION;
    
    BEGIN TRY
        -- 1. Inserir Consulta
        INSERT INTO consulta (operador, data_hora, produto, protocolo)
        VALUES (@operador, @data_hora, @produto, @protocolo);
        
        SET @consultaId = SCOPE_IDENTITY();
        
        -- 2. Inserir Empresa
        INSERT INTO empresa (cnpj, razao_social, situacao_cnpj, atualizacao, fundacao, id_consulta)
        VALUES (@cnpj, @razao_social, @situacao_cnpj, @atualizacao, @fundacao, @consultaId);
        
        SET @empresaId = SCOPE_IDENTITY();
        
        -- 3. Inserir Endereço
        INSERT INTO endereco (id_empresa, logradouro, numero, complemento, bairro, cidade, estado, cep)
        VALUES (@empresaId, @logradouro, @numero, @complemento, @bairro, @cidade, @estado, @cep);
        
        SET @enderecoId = SCOPE_IDENTITY();
        
        -- 4. Inserir Dados de Contato
        INSERT INTO dados_contato (id_empresa, telefones_fixos, telefones_celulares, emails)
        VALUES (@empresaId, @telefones_fixos, @telefones_celulares, @emails);
        
        SET @dadosContatoId = SCOPE_IDENTITY();
        
        -- 5. Inserir Ocorrências
        INSERT INTO ocorrencias (id_empresa, score_pj, limite_credito_pj, gasto_financeiro_estimado)
        VALUES (@empresaId, @score_pj, @limite_credito_pj, @gasto_financeiro_estimado);
        
        SET @ocorrenciasId = SCOPE_IDENTITY();
        
        -- 6. Inserir Score de Crédito
        INSERT INTO score_credito (id_empresa, score, risco, probabilidade_inadimplencia)
        VALUES (@empresaId, @score_credito, @risco, @probabilidade_inadimplencia);
        
        SET @scoreCreditoId = SCOPE_IDENTITY();
        
        COMMIT TRANSACTION;
        
        -- Retornar IDs inseridos
        SELECT 
            @consultaId AS consulta_id,
            @empresaId AS empresa_id,
            @enderecoId AS endereco_id,
            @dadosContatoId AS dados_contato_id,
            @ocorrenciasId AS ocorrencias_id,
            @scoreCreditoId AS score_credito_id;
            
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

-- ==============================================
-- PROCEDURE: sp_InserirSocio
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirSocio
    @empresa_id INT,
    @cpf VARCHAR(14),
    @nome VARCHAR(255),
    @entrada DATE = NULL,
    @participacao DECIMAL(15,2) = NULL,
    @valor_participacao DECIMAL(15,2) = NULL,
    @percentual_participacao DECIMAL(5,2) = NULL,
    @cargo VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO socios (id_empresa, cpf, nome, entrada, participacao, valor_participacao, percentual_participacao, cargo)
    VALUES (@empresa_id, @cpf, @nome, @entrada, @participacao, @valor_participacao, @percentual_participacao, @cargo);
    
    SELECT SCOPE_IDENTITY() AS socio_id;
END
GO

-- ==============================================
-- PROCEDURE: sp_InserirQuadroAdministrativo
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirQuadroAdministrativo
    @empresa_id INT,
    @cpf VARCHAR(14),
    @nome VARCHAR(255),
    @cargo VARCHAR(100) = NULL,
    @eleito_em DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO quadro_administrativo (id_empresa, cpf, nome, cargo, eleito_em)
    VALUES (@empresa_id, @cpf, @nome, @cargo, @eleito_em);
    
    SELECT SCOPE_IDENTITY() AS quadro_id;
END
GO

-- ==============================================
-- PROCEDURE: sp_InserirHistoricoPagamentoPositivo
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirHistoricoPagamentoPositivo
    @empresa_id INT,
    @compromissos_ativos VARCHAR(255) = NULL,
    @contratos_ativos INT = NULL,
    @credores INT = NULL,
    @parcelas_a_vencer_percentual DECIMAL(5,2) = NULL,
    @parcelas_pagas_percentual DECIMAL(5,2) = NULL,
    @parcelas_abertas_percentual DECIMAL(5,2) = NULL,
    @contratos_pagos VARCHAR(255) = NULL,
    @contratos_abertos VARCHAR(255) = NULL,
    @uso_cheque_especial BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO historico_pagamento_positivo (
        id_empresa, compromissos_ativos, contratos_ativos, credores,
        parcelas_a_vencer_percentual, parcelas_pagas_percentual, parcelas_abertas_percentual,
        contratos_pagos, contratos_abertos, uso_cheque_especial
    )
    VALUES (
        @empresa_id, @compromissos_ativos, @contratos_ativos, @credores,
        @parcelas_a_vencer_percentual, @parcelas_pagas_percentual, @parcelas_abertas_percentual,
        @contratos_pagos, @contratos_abertos, @uso_cheque_especial
    );
    
    SELECT SCOPE_IDENTITY() AS historico_id;
END
GO

-- ==============================================
-- PROCEDURE: sp_InserirSCR
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirSCR
    @empresa_id INT,
    @atualizacao DATE = NULL,
    @quantidade_operacoes INT = NULL,
    @inicio_relacionamento DATE = NULL,
    @valor_contratado VARCHAR(255) = NULL,
    @instituicoes INT = NULL,
    @carteira_ativa_total VARCHAR(255) = NULL,
    @vencimento_ultima_parcela VARCHAR(20) = NULL,
    @garantias_quantidade_maxima INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO scr (
        id_empresa, atualizacao, quantidade_operacoes, inicio_relacionamento,
        valor_contratado, instituicoes, carteira_ativa_total,
        vencimento_ultima_parcela, garantias_quantidade_maxima
    )
    VALUES (
        @empresa_id, @atualizacao, @quantidade_operacoes, @inicio_relacionamento,
        @valor_contratado, @instituicoes, @carteira_ativa_total,
        @vencimento_ultima_parcela, @garantias_quantidade_maxima
    );
    
    SELECT SCOPE_IDENTITY() AS scr_id;
END
GO

-- ==============================================
-- PROCEDURE: sp_InserirConsultaRealizada
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirConsultaRealizada
    @empresa_id INT,
    @data_hora DATETIME = NULL,
    @associado VARCHAR(255) = NULL,
    @cidade VARCHAR(100) = NULL,
    @origem VARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO consultas_realizadas (id_empresa, data_hora, associado, cidade, origem)
    VALUES (@empresa_id, @data_hora, @associado, @cidade, @origem);
    
    SELECT SCOPE_IDENTITY() AS consulta_realizada_id;
END
GO

-- ==============================================
-- PROCEDURE: sp_InserirTipoGarantia
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirTipoGarantia
    @scr_id INT,
    @tipo_garantia VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO tipos_garantias (id_scr, tipo_garantia)
    VALUES (@scr_id, @tipo_garantia);
    
    SELECT SCOPE_IDENTITY() AS tipo_garantia_id;
END
GO

-- ==============================================
-- PROCEDURE: sp_BuscarEmpresaPorCNPJ
-- ==============================================
CREATE OR ALTER PROCEDURE sp_BuscarEmpresaPorCNPJ
    @cnpj VARCHAR(18)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        e.id,
        e.cnpj,
        e.razao_social,
        e.situacao_cnpj,
        e.atualizacao,
        e.fundacao,
        c.operador,
        c.data_hora,
        c.produto,
        c.protocolo
    FROM empresa e
    INNER JOIN consulta c ON e.id_consulta = c.id
    WHERE e.cnpj = @cnpj;
END
GO

-- ==============================================
-- PROCEDURE: sp_BuscarDadosCompletosEmpresa
-- ==============================================
CREATE OR ALTER PROCEDURE sp_BuscarDadosCompletosEmpresa
    @cnpj VARCHAR(18)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Dados básicos da empresa
    SELECT 
        e.id AS empresa_id,
        e.cnpj,
        e.razao_social,
        e.situacao_cnpj,
        e.atualizacao,
        e.fundacao,
        c.operador,
        c.data_hora AS data_consulta,
        c.produto,
        c.protocolo
    FROM empresa e
    INNER JOIN consulta c ON e.id_consulta = c.id
    WHERE e.cnpj = @cnpj;
    
    -- Endereço
    SELECT 
        end.logradouro,
        end.numero,
        end.complemento,
        end.bairro,
        end.cidade,
        end.estado,
        end.cep,
        end.longitude,
        end.latitude
    FROM empresa e
    INNER JOIN endereco end ON e.id = end.id_empresa
    WHERE e.cnpj = @cnpj;
    
    -- Dados de contato
    SELECT 
        dc.telefones_fixos,
        dc.telefones_celulares,
        dc.emails
    FROM empresa e
    INNER JOIN dados_contato dc ON e.id = dc.id_empresa
    WHERE e.cnpj = @cnpj;
    
    -- Ocorrências
    SELECT 
        o.score_pj,
        o.limite_credito_pj,
        o.gasto_financeiro_estimado,
        o.consultas_realizadas
    FROM empresa e
    INNER JOIN ocorrencias o ON e.id = o.id_empresa
    WHERE e.cnpj = @cnpj;
    
    -- Sócios
    SELECT 
        s.cpf,
        s.nome,
        s.entrada,
        s.percentual_participacao,
        s.cargo
    FROM empresa e
    INNER JOIN socios s ON e.id = s.id_empresa
    WHERE e.cnpj = @cnpj;
    
    -- Quadro administrativo
    SELECT 
        qa.cpf,
        qa.nome,
        qa.cargo,
        qa.eleito_em
    FROM empresa e
    INNER JOIN quadro_administrativo qa ON e.id = qa.id_empresa
    WHERE e.cnpj = @cnpj;
    
    -- Score de crédito
    SELECT 
        sc.score,
        sc.risco,
        sc.probabilidade_inadimplencia,
        sc.limite_credito_valor,
        sc.gasto_financeiro_estimado_valor
    FROM empresa e
    INNER JOIN score_credito sc ON e.id = sc.id_empresa
    WHERE e.cnpj = @cnpj;
END
GO

-- ==============================================
-- PROCEDURE: sp_ListarEmpresas
-- ==============================================
CREATE OR ALTER PROCEDURE sp_ListarEmpresas
    @offset INT = 0,
    @limit INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        e.id,
        e.cnpj,
        e.razao_social,
        e.situacao_cnpj,
        e.atualizacao,
        c.data_hora AS data_consulta,
        c.operador,
        o.score_pj,
        sc.risco
    FROM empresa e
    INNER JOIN consulta c ON e.id_consulta = c.id
    LEFT JOIN ocorrencias o ON e.id = o.id_empresa
    LEFT JOIN score_credito sc ON e.id = sc.id_empresa
    ORDER BY e.id DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY;
END
GO

-- ==============================================
-- PROCEDURE: sp_EstatisticasConsultas
-- ==============================================
CREATE OR ALTER PROCEDURE sp_EstatisticasConsultas
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) AS total_consultas,
        COUNT(DISTINCT e.id) AS total_empresas,
        AVG(CAST(o.score_pj AS FLOAT)) AS media_score_pj,
        COUNT(CASE WHEN sc.risco = 'A' THEN 1 END) AS risco_a,
        COUNT(CASE WHEN sc.risco = 'B' THEN 1 END) AS risco_b,
        COUNT(CASE WHEN sc.risco = 'C' THEN 1 END) AS risco_c,
        COUNT(CASE WHEN sc.risco = 'D' THEN 1 END) AS risco_d,
        COUNT(CASE WHEN sc.risco = 'E' THEN 1 END) AS risco_e,
        COUNT(CASE WHEN sc.risco = 'F' THEN 1 END) AS risco_f
    FROM consulta c
    INNER JOIN empresa e ON c.id = e.id_consulta
    LEFT JOIN ocorrencias o ON e.id = o.id_empresa
    LEFT JOIN score_credito sc ON e.id = sc.id_empresa;
END
GO

-- ==============================================
-- PROCEDURE: sp_LimparDadosEmpresa
-- ==============================================
CREATE OR ALTER PROCEDURE sp_LimparDadosEmpresa
    @cnpj VARCHAR(18)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @empresaId INT;
    
    -- Buscar ID da empresa
    SELECT @empresaId = id FROM empresa WHERE cnpj = @cnpj;
    
    IF @empresaId IS NOT NULL
    BEGIN
        BEGIN TRANSACTION;
        
        BEGIN TRY
            -- Deletar dados relacionados (cascata deve funcionar, mas vamos ser explícitos)
            DELETE FROM tipos_garantias WHERE id_scr IN (SELECT id FROM scr WHERE id_empresa = @empresaId);
            DELETE FROM consultas_realizadas WHERE id_empresa = @empresaId;
            DELETE FROM scr WHERE id_empresa = @empresaId;
            DELETE FROM score_credito WHERE id_empresa = @empresaId;
            DELETE FROM historico_pagamento_positivo WHERE id_empresa = @empresaId;
            DELETE FROM quadro_administrativo WHERE id_empresa = @empresaId;
            DELETE FROM socios WHERE id_empresa = @empresaId;
            DELETE FROM ocorrencias WHERE id_empresa = @empresaId;
            DELETE FROM dados_contato WHERE id_empresa = @empresaId;
            DELETE FROM endereco WHERE id_empresa = @empresaId;
            DELETE FROM empresa WHERE id = @empresaId;
            
            COMMIT TRANSACTION;
            
            SELECT 'Dados da empresa removidos com sucesso' AS resultado;
        END TRY
        BEGIN CATCH
            ROLLBACK TRANSACTION;
            THROW;
        END CATCH
    END
    ELSE
    BEGIN
        SELECT 'Empresa não encontrada' AS resultado;
    END
END
GO

-- Comentários das stored procedures
EXEC sp_addextendedproperty 'MS_Description', 'Insere uma consulta TESS completa com todos os dados básicos', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_InserirConsultaTESSCompleta';
EXEC sp_addextendedproperty 'MS_Description', 'Insere um sócio na empresa', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_InserirSocio';
EXEC sp_addextendedproperty 'MS_Description', 'Insere um membro do quadro administrativo', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_InserirQuadroAdministrativo';
EXEC sp_addextendedproperty 'MS_Description', 'Insere histórico de pagamento positivo', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_InserirHistoricoPagamentoPositivo';
EXEC sp_addextendedproperty 'MS_Description', 'Insere dados SCR', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_InserirSCR';
EXEC sp_addextendedproperty 'MS_Description', 'Insere uma consulta realizada', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_InserirConsultaRealizada';
EXEC sp_addextendedproperty 'MS_Description', 'Insere um tipo de garantia', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_InserirTipoGarantia';
EXEC sp_addextendedproperty 'MS_Description', 'Busca empresa por CNPJ', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_BuscarEmpresaPorCNPJ';
EXEC sp_addextendedproperty 'MS_Description', 'Busca dados completos de uma empresa', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_BuscarDadosCompletosEmpresa';
EXEC sp_addextendedproperty 'MS_Description', 'Lista empresas com paginação', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_ListarEmpresas';
EXEC sp_addextendedproperty 'MS_Description', 'Retorna estatísticas das consultas', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_EstatisticasConsultas';
EXEC sp_addextendedproperty 'MS_Description', 'Remove todos os dados de uma empresa', 'SCHEMA', 'dbo', 'PROCEDURE', 'sp_LimparDadosEmpresa';
GO
