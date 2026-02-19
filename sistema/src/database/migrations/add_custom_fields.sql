-- Migration: Adicionar campos customizados para categorias e tickets
-- Data: 2025-12-18

-- Adicionar campo custom_fields na tabela ticket_categories
ALTER TABLE ticket_categories ADD COLUMN custom_fields TEXT;

-- Adicionar campo custom_data na tabela tickets
ALTER TABLE tickets ADD COLUMN custom_data TEXT;

