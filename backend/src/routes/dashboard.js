/**
 * Dashboard Routes - Supabase Version (OPTIMIZED)
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
        const { campaign_id, subcampaign_id } = req.query;

        // Base filters helper
        // Se tem subcampaign_id: filtra pela subcampanha específica
        // Se tem campaign_id mas não subcampaign_id: mostra TODOS os leads da campanha (incluindo com subcampanha)
        // Assim as conversões (sale_completed) aparecem na campanha original
        const applyFilters = (query) => {
            if (sellerId) query = query.eq('seller_id', sellerId);
            if (campaign_id) query = query.eq('campaign_id', parseInt(campaign_id));
            if (subcampaign_id) {
                query = query.eq('subcampaign_id', parseInt(subcampaign_id));
            }
            // Nota: não excluímos mais leads com subcampanha da campanha original
            // para que as conversões (sale_completed) continuem contando
            return query;
        };

        // Buscar statuses primeiro (precisamos para várias queries)
        const { data: statuses } = await supabase.from('lead_statuses').select('*').order('display_order');

        // Executar TODAS as queries em paralelo
        const [
            totalResult,
            todayResult,
            checkingResult,
            salesResult,
            inGroupResult,
            outGroupResult,
            recentResult,
            sellersResult,
            ...statusCounts
        ] = await Promise.all([
            // Total de leads
            applyFilters(supabase.from('leads').select('*', { count: 'exact', head: true })),

            // Leads de hoje
            (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return applyFilters(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()));
            })(),

            // Checking
            applyFilters(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('checking', true)),

            // Vendas concluídas
            applyFilters(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('sale_completed', true)),

            // In group
            applyFilters(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('in_group', true)),

            // Out group
            applyFilters(supabase.from('leads').select('*', { count: 'exact', head: true }).or('in_group.eq.false,in_group.is.null')),

            // Recent leads
            (() => {
                let q = supabase.from('leads').select('uuid, first_name, product_name, lead_statuses(name, color)').order('created_at', { ascending: false }).limit(5);
                if (sellerId) q = q.eq('seller_id', sellerId);
                if (campaign_id) q = q.eq('campaign_id', parseInt(campaign_id));
                return q;
            })(),

            // Sellers
            supabase.from('users').select('id, name').eq('role', 'seller').eq('is_active', true),

            // Count por status (paralelo)
            ...(statuses || []).map(status =>
                applyFilters(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status_id', status.id))
            )
        ]);

        // Processar resultados
        const totalLeads = totalResult.count || 0;
        const todayLeads = todayResult.count || 0;
        const totalChecking = checkingResult.count || 0;
        const totalSales = salesResult.count || 0;
        const inGroup = inGroupResult.count || 0;
        const outGroup = outGroupResult.count || 0;
        const recentLeads = recentResult.data || [];
        const sellers = sellersResult.data || [];

        // Processar status counts + buscar leads com subcampanha que tinham esse status
        // APENAS quando não está filtrando por subcampanha específica
        let conversions = 0;
        let pendingLeads = 0;

        let statusExtraCounts = [];

        // Só busca previous_status_id se NÃO está filtrando por subcampanha específica
        if (!subcampaign_id) {
            const statusExtraCountsQueries = (statuses || []).map(async (status) => {
                let q = supabase
                    .from('leads')
                    .select('*', { count: 'exact', head: true })
                    .not('subcampaign_id', 'is', null)
                    .eq('previous_status_id', status.id);

                if (sellerId) q = q.eq('seller_id', sellerId);
                if (campaign_id) q = q.eq('campaign_id', parseInt(campaign_id));

                const { count } = await q;
                return count || 0;
            });

            statusExtraCounts = await Promise.all(statusExtraCountsQueries);
        }

        const byStatus = (statuses || []).map((status, i) => {
            const baseCount = statusCounts[i]?.count || 0;
            const extraCount = statusExtraCounts[i] || 0;
            const totalCount = baseCount + extraCount;

            if (status.is_conversion) conversions += totalCount;
            if (status.name === 'Novo' || status.name === 'Em Contato' || status.name === 'novo') pendingLeads += totalCount;
            return { name: status.name, color: status.color, count: totalCount };
        });

        // conversionStatusIds usado abaixo
        const conversionStatusIds = (statuses || []).filter(s => s.is_conversion).map(s => s.id);

        // Format recent leads
        const recentLeadsFormatted = recentLeads.map(l => ({
            uuid: l.uuid,
            first_name: l.first_name,
            product_name: l.product_name,
            status_name: l.lead_statuses?.name,
            status_color: l.lead_statuses?.color
        }));

        // Buscar performance das vendedoras em paralelo
        // conversionStatusIds já foi declarado acima

        const sellerPerformance = await Promise.all(sellers.map(async (seller) => {
            const [totalRes, convRes] = await Promise.all([
                supabase.from('leads').select('*', { count: 'exact', head: true }).eq('seller_id', seller.id),
                conversionStatusIds.length > 0
                    ? supabase.from('leads').select('*', { count: 'exact', head: true }).eq('seller_id', seller.id).in('status_id', conversionStatusIds)
                    : Promise.resolve({ count: 0 })
            ]);
            return {
                id: seller.id,
                name: seller.name,
                total_leads: totalRes.count || 0,
                conversions: convRes.count || 0
            };
        }));

        const conversionRate = totalLeads > 0 ? ((conversions / totalLeads) * 100).toFixed(1) : '0';

        res.json({
            summary: {
                totalLeads,
                today: todayLeads,
                totalConversions: conversions,
                conversions,
                pendingLeads,
                conversionRate,
                totalChecking,
                totalSales,
                inGroup,
                outGroup
            },
            byStatus,
            recentLeads: recentLeadsFormatted,
            sellerPerformance
        });
    } catch (error) {
        console.error('Error fetching dashboard:', error);
        res.status(500).json({ error: 'Erro ao buscar dados do dashboard' });
    }
});

export default router;
