-- Execute este SQL no Supabase SQL Editor
-- Isso adiciona a coluna para salvar a campanha padrão do GreatPages

ALTER TABLE api_settings 
ADD COLUMN IF NOT EXISTS greatpages_default_campaign_id INTEGER;

COMMENT ON COLUMN api_settings.greatpages_default_campaign_id IS 'ID da campanha padrão para leads recebidos do GreatPages';

-- Verificar se a coluna foi criada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'api_settings' 
AND column_name = 'greatpages_default_campaign_id';
