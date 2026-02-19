-- Cria a stored procedure sp_InserirConsulta compatível com DatabaseService
USE consultas_tess;
GO

CREATE OR ALTER PROCEDURE sp_InserirConsulta
    @Operador        VARCHAR(255),
    @DataHora        DATETIME2(3),
    @Produto         VARCHAR(255),
    @Protocolo       VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO consulta (operador, data_hora, produto, protocolo)
    VALUES (@Operador, @DataHora, @Produto, @Protocolo);

    SELECT SCOPE_IDENTITY() AS ConsultaID;
END
GO

PRINT 'sp_InserirConsulta criada/atualizada com sucesso.';

