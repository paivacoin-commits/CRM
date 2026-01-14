-- Consultar logs de exclusão salvos
-- Execute no Supabase SQL Editor

SELECT 
    id,
    phone,
    group_name,
    status,
    error_message,
    created_at
FROM exclusion_logs
ORDER BY created_at DESC
LIMIT 20;
