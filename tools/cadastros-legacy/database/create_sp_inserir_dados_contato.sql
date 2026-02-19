-- Cria a stored procedure sp_InserirDadosContato compatível com DatabaseService
USE consultas_tess;
GO

CREATE OR ALTER PROCEDURE sp_InserirDadosContato
    @IdEmpresa           INT,
    @TelefonesFixos      NVARCHAR(MAX) = NULL,
    @TelefonesCelulares  NVARCHAR(MAX) = NULL,
    @Emails              NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO dados_contato (
        id_empresa, telefones_fixos, telefones_celulares, emails
    ) VALUES (
        @IdEmpresa, @TelefonesFixos, @TelefonesCelulares, @Emails
    );
END
GO

PRINT 'sp_InserirDadosContato criada/atualizada com sucesso.';

