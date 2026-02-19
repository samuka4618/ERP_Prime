-- Stored Procedure para inserir empresa com dados do CNPJÁ
-- Compatível com SQL Server

USE consultas_tess;
GO

-- ==============================================
-- PROCEDURE: sp_InserirEmpresa
-- ==============================================
CREATE OR ALTER PROCEDURE sp_InserirEmpresa
    @CNPJ VARCHAR(18),
    @InscricaoEstadual VARCHAR(50) = NULL,
    @InscricaoSuframa VARCHAR(50) = NULL,
    @RazaoSocial VARCHAR(500),
    @NomeFantasia VARCHAR(500) = NULL,
    @SituacaoCNPJ VARCHAR(50) = NULL,
    @Porte VARCHAR(100) = NULL,
    @NaturezaJuridica VARCHAR(200) = NULL,
    @CapitalSocial DECIMAL(15,2) = NULL,
    @AtividadePrincipal VARCHAR(500) = NULL,
    @Atualizacao DATETIME2(3),
    @Fundacao DATE = NULL,
    @IdConsulta INT,
    @CnpjaResponse NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @EmpresaID INT;
    
    BEGIN TRY
        -- Verificar se a empresa já existe
        SELECT @EmpresaID = id 
        FROM empresa 
        WHERE cnpj = @CNPJ;
        
        IF @EmpresaID IS NOT NULL
        BEGIN
            -- Atualizar empresa existente
            UPDATE empresa SET
                inscricao_estadual = ISNULL(@InscricaoEstadual, inscricao_estadual),
                inscricao_suframa = ISNULL(@InscricaoSuframa, inscricao_suframa),
                razao_social = ISNULL(@RazaoSocial, razao_social),
                nome_fantasia = ISNULL(@NomeFantasia, nome_fantasia),
                situacao_cnpj = ISNULL(@SituacaoCNPJ, situacao_cnpj),
                porte = ISNULL(@Porte, porte),
                natureza_juridica = ISNULL(@NaturezaJuridica, natureza_juridica),
                capital_social = ISNULL(@CapitalSocial, capital_social),
                atividade_principal = ISNULL(@AtividadePrincipal, atividade_principal),
                atualizacao = ISNULL(@Atualizacao, atualizacao),
                fundacao = ISNULL(@Fundacao, fundacao),
                cnpja_response = ISNULL(@CnpjaResponse, cnpja_response),
                updated_at = GETDATE()
            WHERE id = @EmpresaID;
        END
        ELSE
        BEGIN
            -- Inserir nova empresa
            INSERT INTO empresa (
                cnpj,
                inscricao_estadual,
                inscricao_suframa,
                razao_social,
                nome_fantasia,
                situacao_cnpj,
                porte,
                natureza_juridica,
                capital_social,
                atividade_principal,
                atualizacao,
                fundacao,
                id_consulta,
                cnpja_response
            ) VALUES (
                @CNPJ,
                @InscricaoEstadual,
                @InscricaoSuframa,
                @RazaoSocial,
                @NomeFantasia,
                @SituacaoCNPJ,
                @Porte,
                @NaturezaJuridica,
                @CapitalSocial,
                @AtividadePrincipal,
                @Atualizacao,
                @Fundacao,
                @IdConsulta,
                @CnpjaResponse
            );
            
            SET @EmpresaID = SCOPE_IDENTITY();
        END
        
        -- Retornar o ID da empresa
        SELECT @EmpresaID AS EmpresaID;
        
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
    END CATCH
END
GO

PRINT 'Stored Procedure sp_InserirEmpresa criado/atualizado com sucesso!';
