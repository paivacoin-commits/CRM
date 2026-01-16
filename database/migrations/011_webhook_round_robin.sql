-- Migration: Add Round-Robin configuration per webhook
-- Adiciona suporte para configuração de Round-Robin individual por webhook

-- 1. Adicionar coluna enable_round_robin na tabela de webhooks
ALTER TABLE public.hotmart_webhook_configs 
ADD COLUMN IF NOT EXISTS enable_round_robin BOOLEAN DEFAULT false;

-- 2. Migrar configuração global existente para os webhooks ativos
-- Isso preserva o comportamento atual do sistema
UPDATE public.hotmart_webhook_configs 
SET enable_round_robin = (
    SELECT COALESCE(enable_distribution, false)
    FROM public.hotmart_settings 
    WHERE id = 1
)
WHERE is_enabled = true;

-- 3. Verificar resultado
SELECT 
    id,
    webhook_number,
    campaign_id,
    enable_round_robin,
    is_enabled
FROM public.hotmart_webhook_configs 
ORDER BY webhook_number;
