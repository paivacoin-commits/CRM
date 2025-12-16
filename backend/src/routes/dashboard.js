/**
 * Dashboard Routes - Supabase Version
 */

import { Router } from 'express';
import { db, supabase } from '../database/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/dashboard
 */
router.get('/', async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin';
        const sellerId = isAdmin ? null : req.user.id;

        // Total de leads
        let totalQuery = supabase.from('leads').select('*', { count: 'exact', head: true });
        if (sellerId) totalQuery = totalQuery.eq('seller_id', sellerId);
        const { count: totalLeads } = await totalQuery;

        // Leads de hoje
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let todayQuery = supabase.from('leads').select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());
        if (sellerId) todayQuery = todayQuery.eq('seller_id', sellerId);
        const { count: todayLeads } = await todayQuery;

        // Status e conversões
        const { data: statuses } = await supabase.from('lead_statuses').select('*').order('display_order');

        let conversions = 0;
        let pendingLeads = 0;
        const byStatus = [];

        for (const status of (statuses || [])) {
            let countQuery = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status_id', status.id);
            if (sellerId) countQuery = countQuery.eq('seller_id', sellerId);
            const { count } = await countQuery;

            byStatus.push({
                name: status.name,
                color: status.color,
                count: count || 0
            });

            if (status.is_conversion) conversions += count || 0;
            if (status.name === 'Novo' || status.name === 'Em Contato') pendingLeads += count || 0;
        }

        // Leads recentes
        let recentQuery = supabase
            .from('leads')
            .select(`
                uuid, first_name, product_name,
                lead_statuses(name, color)
            `)
            .order('created_at', { ascending: false })
            .limit(5);
        if (sellerId) recentQuery = recentQuery.eq('seller_id', sellerId);
        const { data: recentLeads } = await recentQuery;

        const recentLeadsFormatted = (recentLeads || []).map(l => ({
            uuid: l.uuid,
            first_name: l.first_name,
            product_name: l.product_name,
            status_name: l.lead_statuses?.name,
            status_color: l.lead_statuses?.color
        }));

        // Performance das vendedoras (só para admin)
        let sellerPerformance = [];
        if (isAdmin) {
            const { data: sellers } = await supabase
                .from('users')
                .select('id, name')
                .eq('role', 'seller')
                .eq('is_active', true);

            for (const seller of (sellers || [])) {
                const { count: total } = await supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .eq('seller_id', seller.id);

                const conversionStatuses = (statuses || []).filter(s => s.is_conversion).map(s => s.id);
                let sellerConversions = 0;
                for (const statusId of conversionStatuses) {
                    const { count } = await supabase
                        .from('leads')
                        .select('*', { count: 'exact', head: true })
                        .eq('seller_id', seller.id)
                        .eq('status_id', statusId);
                    sellerConversions += count || 0;
                }

                sellerPerformance.push({
                    id: seller.id,
                    name: seller.name,
                    total_leads: total || 0,
                    conversions: sellerConversions
                });
            }
        }

        const conversionRate = totalLeads > 0 ? ((conversions / totalLeads) * 100).toFixed(1) : '0';

        res.json({
            summary: {
                totalLeads: totalLeads || 0,
                today: todayLeads || 0,
                totalConversions: conversions,
                conversions: conversions,
                pendingLeads: pendingLeads,
                conversionRate: conversionRate
            },
            byStatus,
            recentLeads: recentLeadsFormatted,
            sellerPerformance: isAdmin ? sellerPerformance : undefined
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    }
});

export default router;
