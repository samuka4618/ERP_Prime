-- Cria a stored procedure sp_InserirEndereco compatível com DatabaseService
USE consultas_tess;
GO

CREATE OR ALTER PROCEDURE sp_InserirEndereco
    @IdEmpresa   INT,
    @Logradouro  VARCHAR(255) = NULL,
    @Numero      VARCHAR(20) = NULL,
    @Complemento VARCHAR(255) = NULL,
    @Bairro      VARCHAR(100) = NULL,
    @Cidade      VARCHAR(100) = NULL,
    @Estado      CHAR(2) = NULL,
    @CEP         VARCHAR(10) = NULL,
    @Longitude   DECIMAL(10, 8) = NULL,
    @Latitude    DECIMAL(10, 8) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO endereco (
        id_empresa, logradouro, numero, complemento, bairro,
        cidade, estado, cep, longitude, latitude
    ) VALUES (
        @IdEmpresa, @Logradouro, @Numero, @Complemento, @Bairro,
        @Cidade, @Estado, @CEP, @Longitude, @Latitude
    );
END
GO

PRINT 'sp_InserirEndereco criada/atualizada com sucesso.';

