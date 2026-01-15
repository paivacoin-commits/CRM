-- SQL para criar suporte a múltiplos webhooks do Hotmart no Supabase
-- Execute este SQL no painel do Supabase (SQL Editor)

-- 1. Criar tabela de configurações de webhooks
CREATE TABLE IF NOT EXISTS public.hotmart_webhook_configs (
    id SERIAL PRIMARY KEY,
    webhook_number INTEGER NOT NULL UNIQUE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    webhook_secret TEXT,
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar coluna webhook_config_id na tabela de logs
ALTER TABLE public.hotmart_webhook_logs 
ADD COLUMN IF NOT EXISTS webhook_config_id INTEGER REFERENCES hotmart_webhook_configs(id) ON DELETE SET NULL;

-- 3. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_hotmart_configs_webhook_number 
ON public.hotmart_webhook_configs(webhook_number);

CREATE INDEX IF NOT EXISTS idx_hotmart_configs_enabled 
ON public.hotmart_webhook_configs(is_enabled);

CREATE INDEX IF NOT EXISTS idx_hotmart_logs_webhook_config 
ON public.hotmart_webhook_logs(webhook_config_id);

-- 4. Migrar configuração existente (se houver)
-- Cria webhook #1 com a campanha padrão atual
INSERT INTO public.hotmart_webhook_configs (webhook_number, campaign_id, is_enabled)
SELECT 
    1 as webhook_number,
    default_campaign_id,
    enable_auto_import
FROM public.hotmart_settings
WHERE id = 1
ON CONFLICT (webhook_number) DO NOTHING;

-- 5. Verificar se foi criado
SELECT * FROM public.hotmart_webhook_configs ORDER BY webhook_number;
