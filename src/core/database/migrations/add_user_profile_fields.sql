-- Migration: Adicionar campos corporativos ao perfil do usuário
-- Data: 2025-01-29

-- Adicionar campos de perfil corporativo
ALTER TABLE users ADD COLUMN phone VARCHAR(20);
ALTER TABLE users ADD COLUMN department VARCHAR(100);
ALTER TABLE users ADD COLUMN position VARCHAR(100);
ALTER TABLE users ADD COLUMN avatar VARCHAR(500);
ALTER TABLE users ADD COLUMN extension VARCHAR(10);
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN linkedin VARCHAR(255);
ALTER TABLE users ADD COLUMN skype VARCHAR(100);
ALTER TABLE users ADD COLUMN hire_date DATE;

