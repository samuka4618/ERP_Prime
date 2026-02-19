-- Schema do banco de dados para consultas TESS/SPC
-- Criado em: 2025-01-10
-- Compatível com SQL Server

-- Criar o banco de dados (SQL Server)
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'consultas_tess')
BEGIN
    CREATE DATABASE consultas_tess
    COLLATE SQL_Latin1_General_CP1_CI_AI;
END
GO

-- Usar o banco de dados
USE consultas_tess;
GO

-- Tabela principal de consultas
CREATE TABLE consulta (
    id INT IDENTITY(1,1) PRIMARY KEY,
    operador VARCHAR(255) NOT NULL,
    data_hora DATETIME NOT NULL,
    produto VARCHAR(255) NOT NULL,
    protocolo VARCHAR(50) NOT NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);
GO

-- Tabela de empresas
CREATE TABLE empresa (
    id INT IDENTITY(1,1) PRIMARY KEY,
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    inscricao_estadual VARCHAR(50),
    razao_social VARCHAR(500) NOT NULL,
    situacao_cnpj VARCHAR(50),
    atualizacao DATETIME,
    fundacao DATE,
    id_consulta INT,
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (id_consulta) REFERENCES consulta(id) ON DELETE CASCADE
);
GO

-- Tabela de endereços
CREATE TABLE endereco (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(255),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    cep VARCHAR(10),
    longitude DECIMAL(10, 8),
    latitude DECIMAL(10, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de dados de contato
CREATE TABLE dados_contato (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    telefones_fixos JSON,
    telefones_celulares JSON,
    emails JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de ocorrências
CREATE TABLE ocorrencias (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    score_pj INT,
    dados_contato INT,
    historico_scr INT,
    historico_pagamentos_positivo INT,
    limite_credito_pj DECIMAL(15, 2),
    quadro_administrativo INT,
    consultas_realizadas INT,
    gasto_financeiro_estimado DECIMAL(15, 2),
    controle_societario INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de sócios
CREATE TABLE socios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    entrada DATE,
    participacao DECIMAL(15, 2),
    valor_participacao DECIMAL(15, 2),
    percentual_participacao DECIMAL(5, 2),
    cargo VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de quadro administrativo
CREATE TABLE quadro_administrativo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    cargo VARCHAR(100),
    eleito_em DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de histórico de pagamento positivo
CREATE TABLE historico_pagamento_positivo (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    compromissos_ativos VARCHAR(255),
    contratos_ativos INT,
    credores INT,
    parcelas_a_vencer_percentual DECIMAL(5, 2),
    parcelas_pagas_percentual DECIMAL(5, 2),
    parcelas_abertas_percentual DECIMAL(5, 2),
    contratos_pagos VARCHAR(255),
    contratos_abertos VARCHAR(255),
    uso_cheque_especial TINYINT(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de score de crédito
CREATE TABLE score_credito (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    score INT,
    risco VARCHAR(10),
    probabilidade_inadimplencia DECIMAL(5, 2),
    limite_credito_valor DECIMAL(15, 2),
    gasto_financeiro_estimado_valor DECIMAL(15, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela SCR (Sistema de Informações de Crédito)
CREATE TABLE scr (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    atualizacao DATE,
    quantidade_operacoes INT,
    inicio_relacionamento DATE,
    valor_contratado VARCHAR(255),
    instituicoes INT,
    carteira_ativa_total VARCHAR(255),
    vencimento_ultima_parcela VARCHAR(20),
    garantias_quantidade_maxima INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de consultas realizadas (histórico de consultas)
CREATE TABLE consultas_realizadas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_empresa INT NOT NULL,
    data_hora DATETIME,
    associado VARCHAR(255),
    cidade VARCHAR(100),
    origem VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa(id) ON DELETE CASCADE
);

-- Tabela de tipos de garantias (para normalizar os tipos de garantias do SCR)
CREATE TABLE tipos_garantias (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_scr INT NOT NULL,
    tipo_garantia VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_scr) REFERENCES scr(id) ON DELETE CASCADE
);

-- Índices para melhorar performance
CREATE INDEX idx_empresa_cnpj ON empresa(cnpj);
CREATE INDEX idx_empresa_razao_social ON empresa(razao_social);
CREATE INDEX idx_consulta_data_hora ON consulta(data_hora);

-- Índices para relacionamentos por id_empresa (essenciais para consultas)
CREATE INDEX idx_endereco_id_empresa ON endereco(id_empresa);
CREATE INDEX idx_dados_contato_id_empresa ON dados_contato(id_empresa);
CREATE INDEX idx_ocorrencias_id_empresa ON ocorrencias(id_empresa);
CREATE INDEX idx_socios_id_empresa ON socios(id_empresa);
CREATE INDEX idx_quadro_administrativo_id_empresa ON quadro_administrativo(id_empresa);
CREATE INDEX idx_historico_pagamento_id_empresa ON historico_pagamento_positivo(id_empresa);
CREATE INDEX idx_score_credito_id_empresa ON score_credito(id_empresa);
CREATE INDEX idx_scr_id_empresa ON scr(id_empresa);
CREATE INDEX idx_consultas_realizadas_id_empresa ON consultas_realizadas(id_empresa);

-- Índices adicionais para consultas específicas
CREATE INDEX idx_socios_cpf ON socios(cpf);
CREATE INDEX idx_quadro_administrativo_cpf ON quadro_administrativo(cpf);
CREATE INDEX idx_endereco_cidade ON endereco(cidade);
CREATE INDEX idx_endereco_estado ON endereco(estado);
CREATE INDEX idx_consultas_realizadas_data ON consultas_realizadas(data_hora);
CREATE INDEX idx_empresa_id_consulta ON empresa(id_consulta);

-- Comentários das tabelas
ALTER TABLE consulta COMMENT = 'Tabela principal que armazena informações sobre cada consulta realizada';
ALTER TABLE empresa COMMENT = 'Dados básicos da empresa consultada';
ALTER TABLE endereco COMMENT = 'Informações de endereço da empresa';
ALTER TABLE dados_contato COMMENT = 'Telefones e emails da empresa (armazenados como JSON)';
ALTER TABLE ocorrencias COMMENT = 'Dados de ocorrências e scores da consulta';
ALTER TABLE socios COMMENT = 'Informações dos sócios da empresa';
ALTER TABLE quadro_administrativo COMMENT = 'Quadro administrativo da empresa';
ALTER TABLE historico_pagamento_positivo COMMENT = 'Histórico de pagamentos positivos';
ALTER TABLE score_credito COMMENT = 'Scores e análises de crédito';
ALTER TABLE scr COMMENT = 'Dados do Sistema de Informações de Crédito';
ALTER TABLE consultas_realizadas COMMENT = 'Histórico de consultas realizadas na empresa';
ALTER TABLE tipos_garantias COMMENT = 'Tipos de garantias associadas ao SCR';
