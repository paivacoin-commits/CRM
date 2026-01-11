-- Verificar configuração de espelhamento das campanhas
SELECT 
    id,
    name,
    mirror_campaign_id,
    (SELECT name FROM campaigns WHERE id = c.mirror_campaign_id) as mirror_campaign_name
FROM campaigns c
WHERE name LIKE '%SUPER INTERESSADOS%' OR name LIKE '%LP 05 JAN%'
ORDER BY id;

-- Verificar quantos leads existem em cada campanha
SELECT 
    c.id,
    c.name,
    COUNT(l.id) as total_leads,
    COUNT(CASE WHEN l.seller_id IS NOT NULL THEN 1 END) as leads_with_seller
FROM campaigns c
LEFT JOIN leads l ON l.campaign_id = c.id
WHERE c.name LIKE '%SUPER INTERESSADOS%' OR c.name LIKE '%LP 05 JAN%'
GROUP BY c.id, c.name
ORDER BY c.id;
