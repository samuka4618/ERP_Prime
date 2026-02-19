-- Tabela para rastrear o status da consulta de CNPJ
CREATE TABLE cnpj_query_status (
    id INT IDENTITY(1,1) PRIMARY KEY,
    registration_id INT NOT NULL,
    cnpj VARCHAR(18) NOT NULL,
    status VARCHAR(50) NOT NULL, -- pending, consulting_spc, processing_tess, consulting_cnpja, saving_database, completed, failed
    current_step NVARCHAR(255) NULL,
    spc_status VARCHAR(50) NULL, -- pending, success, failed
    tess_status VARCHAR(50) NULL, -- pending, success, failed
    cnpja_status VARCHAR(50) NULL, -- pending, success, failed
    database_status VARCHAR(50) NULL, -- pending, success, failed
    error_message NVARCHAR(MAX) NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    
    CONSTRAINT FK_cnpj_query_status_registration 
        FOREIGN KEY (registration_id) 
        REFERENCES client_registrations(id)
        ON DELETE CASCADE
);

-- Índice para busca rápida
CREATE INDEX IX_cnpj_query_status_registration_id 
    ON cnpj_query_status(registration_id);

-- Índice para busca por CNPJ
CREATE INDEX IX_cnpj_query_status_cnpj 
    ON cnpj_query_status(cnpj);

