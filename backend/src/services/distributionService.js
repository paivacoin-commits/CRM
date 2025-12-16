/**
 * Distribution Service - Lógica de Distribuição Round-Robin
 * 
 * Este serviço implementa a lógica de distribuição sequencial (Round-Robin)
 * de leads entre as vendedoras ativas no sistema.
 * 
 * COMO FUNCIONA O ROUND-ROBIN:
 * 1. Mantemos registro de qual vendedora recebeu o último lead
 * 2. Ao chegar novo lead, buscamos a PRÓXIMA vendedora na sequência
 * 3. Se chegamos ao fim da lista, voltamos para a primeira vendedora
 * 4. Vendedoras com is_in_distribution = false são ignoradas
 * 
 * EXEMPLO:
 * Vendedoras ativas: [Ana (id:1), Bia (id:2), Carol (id:3)]
 * - Lead 1 → Ana (última: null → primeira da lista)
 * - Lead 2 → Bia (última: Ana → próxima)
 * - Lead 3 → Carol (última: Bia → próxima)
 * - Lead 4 → Ana (última: Carol → volta ao início)
 */

import db from '../database/db.js';

/**
 * Obtém a próxima vendedora na fila de distribuição Round-Robin
 * @returns {Object|null} Dados da vendedora ou null se não houver vendedoras ativas
 */
export function getNextSellerInQueue() {
    // Passo 1: Buscar todas as vendedoras ativas na distribuição
    // Ordenamos por distribution_order para respeitar ordem configurável
    const activeSellers = db.prepare(`
        SELECT id, uuid, name, email 
        FROM users 
        WHERE role = 'seller' 
          AND is_active = 1 
          AND is_in_distribution = 1
        ORDER BY distribution_order ASC, id ASC
    `).all();

    // Se não há vendedoras ativas, retorna null
    if (activeSellers.length === 0) {
        console.warn('⚠️ Nenhuma vendedora ativa na distribuição');
        return null;
    }

    // Passo 2: Buscar a última vendedora que recebeu um lead
    const distributionControl = db.prepare(`
        SELECT last_seller_id FROM distribution_control WHERE id = 1
    `).get();

    const lastSellerId = distributionControl?.last_seller_id;

    // Passo 3: Determinar a próxima vendedora
    let nextSeller;

    if (!lastSellerId) {
        // Primeira distribuição - pegar a primeira vendedora da lista
        nextSeller = activeSellers[0];
    } else {
        // Encontrar o índice da última vendedora
        const lastIndex = activeSellers.findIndex(s => s.id === lastSellerId);

        if (lastIndex === -1) {
            // A última vendedora não está mais ativa, começar do início
            nextSeller = activeSellers[0];
        } else {
            // Pegar a próxima vendedora (com wrap-around para o início)
            const nextIndex = (lastIndex + 1) % activeSellers.length;
            nextSeller = activeSellers[nextIndex];
        }
    }

    // Passo 4: Atualizar o controle de distribuição
    db.prepare(`
        UPDATE distribution_control 
        SET last_seller_id = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = 1
    `).run(nextSeller.id);

    console.log(`📥 Lead atribuído para: ${nextSeller.name} (ID: ${nextSeller.id})`);
    return nextSeller;
}

/**
 * Obtém estatísticas da distribuição
 * @returns {Object} Estatísticas de leads por vendedora
 */
export function getDistributionStats() {
    return db.prepare(`
        SELECT 
            u.id,
            u.name,
            u.is_in_distribution,
            COUNT(l.id) as total_leads,
            SUM(CASE WHEN ls.is_conversion = 1 THEN 1 ELSE 0 END) as conversions,
            SUM(CASE WHEN l.status_id = 1 THEN 1 ELSE 0 END) as pending
        FROM users u
        LEFT JOIN leads l ON u.id = l.seller_id
        LEFT JOIN lead_statuses ls ON l.status_id = ls.id
        WHERE u.role = 'seller' AND u.is_active = 1
        GROUP BY u.id
        ORDER BY u.name
    `).all();
}
