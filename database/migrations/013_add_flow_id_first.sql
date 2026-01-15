-- Adicionar coluna manychat_flow_id_first que estava faltando
-- Execute este script no SQL Editor do Supabase

ALTER TABLE public.cart_abandonment_settings 
ADD COLUMN IF NOT EXISTS manychat_flow_id_first TEXT;

-- Verificar se foi adicionada
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'cart_abandonment_settings' 
AND table_schema = 'public'
ORDER BY ordinal_position;
