-- Schema para Sistema de Cadastro de Clientes
-- Banco: consultas_tess (SQL Server 2019)
-- Criado em: 2025-01-10

-- Usar o banco de dados existente
USE consultas_tess;
GO

-- =============================================
-- TABELAS DE CONFIGURAÇÃO
-- =============================================

-- Tabela de configuração: Ramo de Atividade
CREATE TABLE client_config_ramo_atividade (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(255) NOT NULL,
    descricao NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Tabela de configuração: Vendedor
CREATE TABLE client_config_vendedor (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(255) NOT NULL,
    descricao NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Tabela de configuração: Gestor
CREATE TABLE client_config_gestor (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(255) NOT NULL,
    descricao NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Tabela de configuração: Código de Carteira
CREATE TABLE client_config_codigo_carteira (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(255) NOT NULL,
    descricao NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Tabela de configuração: Lista de Preço
CREATE TABLE client_config_lista_preco (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(255) NOT NULL,
    descricao NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Tabela de configuração: Forma de Pagamento Desejada
CREATE TABLE client_config_forma_pagamento_desejada (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nome NVARCHAR(255) NOT NULL,
    descricao NVARCHAR(500),
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- =============================================
-- TABELA PRINCIPAL: CADASTROS DE CLIENTES
-- =============================================

CREATE TABLE client_registrations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    nome_cliente NVARCHAR(255) NOT NULL,
    nome_fantasia NVARCHAR(255),
    cnpj VARCHAR(18) NOT NULL,
    email VARCHAR(255) NOT NULL,
    ramo_atividade_id INT,
    vendedor_id INT,
    gestor_id INT,
    codigo_carteira_id INT,
    prazo_desejado INT,
    periodicidade_pedido NVARCHAR(100),
    valor_estimado_pedido DECIMAL(15,2),
    lista_preco_id INT,
    forma_contato NVARCHAR(255),
    imagem_externa_path NVARCHAR(500) NOT NULL,
    imagem_interna_path NVARCHAR(500) NOT NULL,
    anexos_path NVARCHAR(MAX),
    whatsapp_cliente VARCHAR(20),
    rede_social NVARCHAR(255),
    link_google_maps NVARCHAR(500),
    forma_pagamento_desejada_id INT,
    status VARCHAR(50) NOT NULL DEFAULT 'cadastro_enviado',
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    
    -- Foreign Keys
    CONSTRAINT FK_client_ramo_atividade FOREIGN KEY (ramo_atividade_id) REFERENCES client_config_ramo_atividade(id),
    CONSTRAINT FK_client_vendedor FOREIGN KEY (vendedor_id) REFERENCES client_config_vendedor(id),
    CONSTRAINT FK_client_gestor FOREIGN KEY (gestor_id) REFERENCES client_config_gestor(id),
    CONSTRAINT FK_client_codigo_carteira FOREIGN KEY (codigo_carteira_id) REFERENCES client_config_codigo_carteira(id),
    CONSTRAINT FK_client_lista_preco FOREIGN KEY (lista_preco_id) REFERENCES client_config_lista_preco(id),
    CONSTRAINT FK_client_forma_pagamento_desejada FOREIGN KEY (forma_pagamento_desejada_id) REFERENCES client_config_forma_pagamento_desejada(id),
    
    -- Constraints
    CONSTRAINT CHK_status CHECK (status IN ('cadastro_enviado', 'aguardando_analise_credito', 'cadastro_finalizado'))
);
GO

-- =============================================
-- TABELA DE HISTÓRICO
-- =============================================

CREATE TABLE client_registration_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    registration_id INT NOT NULL,
    user_id INT NOT NULL,
    status_anterior VARCHAR(50),
    status_novo VARCHAR(50) NOT NULL,
    observacoes NVARCHAR(MAX),
    prazo_aprovado NVARCHAR(50),
    limite_aprovado NVARCHAR(50),
    created_at DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT FK_history_registration FOREIGN KEY (registration_id) REFERENCES client_registrations(id) ON DELETE CASCADE
);
GO

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================

-- Índices para client_registrations
CREATE INDEX IX_client_reg_status ON client_registrations(status);
CREATE INDEX IX_client_reg_cnpj ON client_registrations(cnpj);
CREATE INDEX IX_client_reg_user_id ON client_registrations(user_id);
CREATE INDEX IX_client_reg_created ON client_registrations(created_at);
CREATE INDEX IX_client_reg_email ON client_registrations(email);

-- Índices para client_registration_history
CREATE INDEX IX_client_hist_reg_id ON client_registration_history(registration_id);
CREATE INDEX IX_client_hist_created ON client_registration_history(created_at);

-- Índices para tabelas de configuração
CREATE INDEX IX_config_ramo_atividade_active ON client_config_ramo_atividade(is_active);
CREATE INDEX IX_config_vendedor_active ON client_config_vendedor(is_active);
CREATE INDEX IX_config_gestor_active ON client_config_gestor(is_active);
CREATE INDEX IX_config_codigo_carteira_active ON client_config_codigo_carteira(is_active);
CREATE INDEX IX_config_lista_preco_active ON client_config_lista_preco(is_active);
CREATE INDEX IX_config_forma_pagamento_desejada_active ON client_config_forma_pagamento_desejada(is_active);
GO

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

-- Trigger para client_registrations
CREATE TRIGGER trg_client_registrations_updated
ON client_registrations
AFTER UPDATE
AS
BEGIN
    UPDATE client_registrations
    SET updated_at = GETDATE()
    FROM client_registrations cr
    INNER JOIN inserted i ON cr.id = i.id;
END;
GO

-- Triggers para tabelas de configuração
CREATE TRIGGER trg_client_config_ramo_atividade_updated
ON client_config_ramo_atividade
AFTER UPDATE
AS
BEGIN
    UPDATE client_config_ramo_atividade
    SET updated_at = GETDATE()
    FROM client_config_ramo_atividade c
    INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE TRIGGER trg_client_config_vendedor_updated
ON client_config_vendedor
AFTER UPDATE
AS
BEGIN
    UPDATE client_config_vendedor
    SET updated_at = GETDATE()
    FROM client_config_vendedor c
    INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE TRIGGER trg_client_config_gestor_updated
ON client_config_gestor
AFTER UPDATE
AS
BEGIN
    UPDATE client_config_gestor
    SET updated_at = GETDATE()
    FROM client_config_gestor c
    INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE TRIGGER trg_client_config_codigo_carteira_updated
ON client_config_codigo_carteira
AFTER UPDATE
AS
BEGIN
    UPDATE client_config_codigo_carteira
    SET updated_at = GETDATE()
    FROM client_config_codigo_carteira c
    INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE TRIGGER trg_client_config_lista_preco_updated
ON client_config_lista_preco
AFTER UPDATE
AS
BEGIN
    UPDATE client_config_lista_preco
    SET updated_at = GETDATE()
    FROM client_config_lista_preco c
    INNER JOIN inserted i ON c.id = i.id;
END;
GO

CREATE TRIGGER trg_client_config_forma_pagamento_desejada_updated
ON client_config_forma_pagamento_desejada
AFTER UPDATE
AS
BEGIN
    UPDATE client_config_forma_pagamento_desejada
    SET updated_at = GETDATE()
    FROM client_config_forma_pagamento_desejada c
    INNER JOIN inserted i ON c.id = i.id;
END;
GO

-- =============================================
-- DADOS INICIAIS (OPCIONAL)
-- =============================================

-- Inserir dados iniciais para configurações (exemplos)
INSERT INTO client_config_ramo_atividade (nome, descricao) VALUES
('Tecnologia', 'Empresas do setor de tecnologia'),
('Comércio', 'Empresas do setor comercial'),
('Indústria', 'Empresas do setor industrial'),
('Serviços', 'Empresas do setor de serviços');

INSERT INTO client_config_vendedor (nome, descricao) VALUES
('João Silva', 'Vendedor sênior'),
('Maria Santos', 'Vendedora especialista'),
('Pedro Costa', 'Vendedor júnior');

INSERT INTO client_config_gestor (nome, descricao) VALUES
('Ana Oliveira', 'Gestora de vendas'),
('Carlos Lima', 'Gestor comercial'),
('Lucia Ferreira', 'Gestora regional');

INSERT INTO client_config_codigo_carteira (nome, descricao) VALUES
('Carteira A', 'Carteira premium'),
('Carteira B', 'Carteira padrão'),
('Carteira C', 'Carteira básica');

INSERT INTO client_config_lista_preco (nome, descricao) VALUES
('Lista Premium', 'Lista de preços premium'),
('Lista Padrão', 'Lista de preços padrão'),
('Lista Promocional', 'Lista de preços promocional');

INSERT INTO client_config_forma_pagamento_desejada (nome, descricao) VALUES
('À vista', 'Pagamento à vista'),
('30 dias', 'Pagamento em 30 dias'),
('60 dias', 'Pagamento em 60 dias'),
('90 dias', 'Pagamento em 90 dias'),
('Parcelado', 'Pagamento parcelado');

-- =============================================
-- COMENTÁRIOS DAS TABELAS
-- =============================================

EXEC sp_addextendedproperty 'MS_Description', 'Tabela principal de cadastros de clientes', 'SCHEMA', 'dbo', 'TABLE', 'client_registrations';
EXEC sp_addextendedproperty 'MS_Description', 'Histórico de mudanças de status dos cadastros', 'SCHEMA', 'dbo', 'TABLE', 'client_registration_history';
EXEC sp_addextendedproperty 'MS_Description', 'Configurações de ramo de atividade', 'SCHEMA', 'dbo', 'TABLE', 'client_config_ramo_atividade';
EXEC sp_addextendedproperty 'MS_Description', 'Configurações de vendedores', 'SCHEMA', 'dbo', 'TABLE', 'client_config_vendedor';
EXEC sp_addextendedproperty 'MS_Description', 'Configurações de gestores', 'SCHEMA', 'dbo', 'TABLE', 'client_config_gestor';
EXEC sp_addextendedproperty 'MS_Description', 'Configurações de código de carteira', 'SCHEMA', 'dbo', 'TABLE', 'client_config_codigo_carteira';
EXEC sp_addextendedproperty 'MS_Description', 'Configurações de lista de preço', 'SCHEMA', 'dbo', 'TABLE', 'client_config_lista_preco';
EXEC sp_addextendedproperty 'MS_Description', 'Configurações de forma de pagamento desejada', 'SCHEMA', 'dbo', 'TABLE', 'client_config_forma_pagamento_desejada';
GO

PRINT 'Schema de cadastro de clientes criado com sucesso!';
