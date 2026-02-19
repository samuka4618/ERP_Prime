-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inserir configuração padrão de timezone
INSERT OR IGNORE INTO system_config (config_key, config_value, description) 
VALUES ('timezone', 'America/Sao_Paulo', 'Timezone padrão do sistema');

-- Inserir outras configurações úteis
INSERT OR IGNORE INTO system_config (config_key, config_value, description) 
VALUES ('date_format', 'DD/MM/YYYY HH:mm', 'Formato de exibição de datas');

INSERT OR IGNORE INTO system_config (config_key, config_value, description) 
VALUES ('system_name', 'ERP PRIME', 'Nome do sistema');

-- Trigger para atualizar updated_at
CREATE TRIGGER IF NOT EXISTS update_system_config_updated_at 
    AFTER UPDATE ON system_config
    BEGIN
        UPDATE system_config SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;


