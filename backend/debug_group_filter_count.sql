-- Verificar contagem de leads "Fora do Grupo" para uma campanha específica
-- Este script ajuda a diagnosticar o problema de contagem

-- 1. Primeiro, encontrar o ID da campanha "LP 60 JAN SUPER"
SELECT id, name, is_active 
FROM campaigns 
WHERE name LIKE '%LP 60 JAN SUPER%' OR name LIKE '%SUPER INTERESSADO%';

-- 2. Contar total de leads na campanha (substitua <campaign_id> pelo ID encontrado acima)
-- SELECT COUNT(*) as total_leads
-- FROM leads
-- WHERE campaign_id = <campaign_id>
-- AND (is_active = true OR is_active IS NULL);

-- 3. Contar leads "Fora do Grupo" (in_group = false ou NULL na tabela lead_campaign_groups)
-- SELECT COUNT(DISTINCT l.id) as leads_fora_do_grupo
-- FROM leads l
-- LEFT JOIN lead_campaign_groups lcg ON l.id = lcg.lead_id AND l.campaign_id = lcg.campaign_id
-- WHERE l.campaign_id = <campaign_id>
-- AND (l.is_active = true OR l.is_active IS NULL)
-- AND (lcg.in_group = false OR lcg.in_group IS NULL);

-- 4. Contar leads "No Grupo" (in_group = true)
-- SELECT COUNT(DISTINCT l.id) as leads_no_grupo
-- FROM leads l
-- INNER JOIN lead_campaign_groups lcg ON l.id = lcg.lead_id AND l.campaign_id = lcg.campaign_id
-- WHERE l.campaign_id = <campaign_id>
-- AND (l.is_active = true OR l.is_active IS NULL)
-- AND lcg.in_group = true;

-- 5. Ver detalhes dos primeiros 10 leads "Fora do Grupo"
-- SELECT l.id, l.first_name, l.phone, l.campaign_id, lcg.in_group
-- FROM leads l
-- LEFT JOIN lead_campaign_groups lcg ON l.id = lcg.lead_id AND l.campaign_id = lcg.campaign_id
-- WHERE l.campaign_id = <campaign_id>
-- AND (l.is_active = true OR l.is_active IS NULL)
-- AND (lcg.in_group = false OR lcg.in_group IS NULL)
-- LIMIT 10;

-- 6. Verificar se há leads sem registro na tabela lead_campaign_groups
-- SELECT COUNT(*) as leads_sem_registro_grupo
-- FROM leads l
-- LEFT JOIN lead_campaign_groups lcg ON l.id = lcg.lead_id AND l.campaign_id = lcg.campaign_id
-- WHERE l.campaign_id = <campaign_id>
-- AND (l.is_active = true OR l.is_active IS NULL)
-- AND lcg.lead_id IS NULL;
