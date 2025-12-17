-- ============================================
-- MIGRAÇÃO 004: Templates de WhatsApp por Vendedor
-- Execute este SQL no SQL Editor do Supabase
-- ============================================

-- Adicionar coluna seller_id na tabela whatsapp_templates
-- Se seller_id for NULL, o template é global (visível para todos)
-- Se seller_id tiver valor, é um template individual da vendedora
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS seller_id INTEGER REFERENCES users(id);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_seller ON whatsapp_templates(seller_id);

-- Opcional: Adicionar coluna created_by para saber quem criou
ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- IMPORTANTE: Remover templates antigos sem seller_id (globais)
-- Isso evita que templates apareçam para vendedores errados
DELETE FROM whatsapp_templates WHERE seller_id IS NULL;
