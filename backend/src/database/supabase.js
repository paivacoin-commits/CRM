/**
 * Supabase Database Client
 * Cliente otimizado para operações com Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios no arquivo .env');
    process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Helper para queries comuns
 */
export const db = {
    // ==================== USERS ====================
    async getUserByEmail(email) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email.toLowerCase())
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getUserByUuid(uuid) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('uuid', uuid)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getUserById(id) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getUserByName(name) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .ilike('name', name)
            .eq('is_active', true)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getUsers() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async getSellers() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'seller')
            .eq('is_active', true)
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async getActiveSellersInDistribution() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'seller')
            .eq('is_active', true)
            .eq('is_in_distribution', true)
            .order('distribution_order')
            .order('id');
        if (error) throw error;
        return data || [];
    },

    async createUser(userData) {
        const { data, error } = await supabase
            .from('users')
            .insert(userData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateUser(uuid, userData) {
        const { data, error } = await supabase
            .from('users')
            .update({ ...userData, updated_at: new Date().toISOString() })
            .eq('uuid', uuid)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteUser(uuid) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('uuid', uuid);
        if (error) throw error;
    },

    async getUserLeadStats(userId) {
        // Total de leads do usuário
        const { count: total_leads } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('seller_id', userId);

        // Buscar status de conversão
        const { data: conversionStatuses } = await supabase
            .from('lead_statuses')
            .select('id')
            .eq('is_conversion', true);

        let conversions = 0;
        if (conversionStatuses && conversionStatuses.length > 0) {
            const statusIds = conversionStatuses.map(s => s.id);
            const { count } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('seller_id', userId)
                .in('status_id', statusIds);
            conversions = count || 0;
        }

        return { total_leads: total_leads || 0, conversions };
    },

    // ==================== LEADS ====================
    async getLeads({ status, search, search_observation, campaign_id, subcampaign_id, in_group, show_inactive, seller_id, page = 1, limit = 50 }) {
        // ESTRATÉGIA ESPECIAL para filtro in_group:
        // Como o in_group vem de uma tabela separada (lead_campaign_groups),
        // precisamos buscar TODOS os leads que correspondem aos outros filtros primeiro,
        // depois aplicar o filtro in_group, e então paginar manualmente.
        // Isso garante que a paginação funcione corretamente.

        const useInGroupFilter = in_group !== undefined;
        const fetchLimit = useInGroupFilter ? 5000 : limit; // Buscar mais leads se filtro in_group está ativo
        const fetchOffset = useInGroupFilter ? 0 : (page - 1) * limit;

        let query = supabase
            .from('leads')
            .select(`
                *,
                lead_statuses!status_id(id, name, color),
                users!seller_id(id, name),
                campaigns!campaign_id(id, name),
                subcampaigns!subcampaign_id(id, name, color)
            `, { count: 'exact' });

        if (!show_inactive) {
            query = query.or('is_active.eq.true,is_active.is.null');
        }
        if (seller_id) query = query.eq('seller_id', seller_id);
        if (status === 'null') {
            query = query.is('status_id', null);
        } else if (status) {
            query = query.eq('status_id', status);
        }
        if (campaign_id) query = query.eq('campaign_id', campaign_id);
        if (subcampaign_id) query = query.eq('subcampaign_id', subcampaign_id);

        if (search) {
            query = query.or(`first_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        }
        if (search_observation) {
            query = query.ilike('observations', `%${search_observation}%`);
        }

        query = query.order('created_at', { ascending: false }).range(fetchOffset, fetchOffset + fetchLimit - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        // Buscar in_group de todos os leads de uma vez
        const leadIds = (data || []).map(l => l.id);
        let campaignGroupsMap = new Map();

        if (leadIds.length > 0) {
            // Buscar in_group para os leads DA CAMPANHA ESPECÍFICA
            let pageGroupQuery = supabase
                .from('lead_campaign_groups')
                .select('lead_id, campaign_id, in_group')
                .in('lead_id', leadIds);

            // Filtrar por campaign_id se estiver filtrando por campanha
            if (campaign_id) {
                pageGroupQuery = pageGroupQuery.eq('campaign_id', campaign_id);
            }

            const { data: campaignGroups } = await pageGroupQuery;

            // Criar mapa: lead_id + campaign_id -> in_group
            (campaignGroups || []).forEach(cg => {
                const key = `${cg.lead_id}_${cg.campaign_id}`;
                campaignGroupsMap.set(key, cg.in_group);
            });
        }

        // Mapear dados para formato esperado
        let leads = (data || []).map(l => {
            const key = `${l.id}_${l.campaign_id}`;
            let inGroupValue = campaignGroupsMap.has(key) ? campaignGroupsMap.get(key) : false;

            return {
                ...l,
                status_id: l.lead_statuses?.id || l.status_id,
                status_name: l.lead_statuses?.name,
                status_color: l.lead_statuses?.color,
                seller_id: l.seller_id,
                seller_name: l.users?.name,
                campaign_name: l.campaigns?.name,
                subcampaign_id: l.subcampaign_id,
                subcampaign_name: l.subcampaigns?.name,
                subcampaign_color: l.subcampaigns?.color,
                in_group: inGroupValue
            };
        });

        // Aplicar filtro de in_group e paginar manualmente se necessário
        let finalTotal = count || 0;
        let paginatedLeads = leads;

        if (useInGroupFilter) {
            const inGroupBool = in_group === 'true';

            console.log(`🔍 [DEBUG] Filtro in_group aplicado:`, {
                campaign_id,
                in_group,
                inGroupBool,
                totalLeadsBeforeFilter: leads.length,
                totalCountBeforeFilter: count
            });

            // Filtrar leads por in_group
            const filteredLeads = leads.filter(l => l.in_group === inGroupBool);

            console.log(`🔍 [DEBUG] Leads após filtro in_group: ${filteredLeads.length}`);

            // Paginar manualmente
            const offset = (page - 1) * limit;
            paginatedLeads = filteredLeads.slice(offset, offset + limit);
            finalTotal = filteredLeads.length;

            console.log(`🔍 [DEBUG] Paginação manual:`, {
                page,
                limit,
                offset,
                totalFiltered: filteredLeads.length,
                pageLeads: paginatedLeads.length,
                finalTotal
            });
        }

        return { leads: paginatedLeads, total: finalTotal };
    },

    async getRecentCheckings(limit = 10) {
        // Explicitly select fields to ensure reliability
        const { data, error } = await supabase
            .from('leads')
            .select('uuid, first_name, email, phone, updated_at, observations, checking')
            .eq('checking', true)
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    },

    async getRecentGreatPages(limit = 10) {
        // Buscar leads recentes recebidos do GreatPages
        const { data, error } = await supabase
            .from('leads')
            .select('uuid, first_name, email, phone, created_at, source, campaigns(name)')
            .eq('source', 'greatpages')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return (data || []).map(l => ({
            ...l,
            campaign_name: l.campaigns?.name
        }));
    },

    async getLeadByUuid(uuid) {
        const { data, error } = await supabase
            .from('leads')
            .select(`
                *,
                lead_statuses!status_id(id, name, color),
                users!seller_id(id, name),
                campaigns!campaign_id(id, name),
                subcampaigns!subcampaign_id(id, name, color)
            `)
            .eq('uuid', uuid)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;
        return {
            ...data,
            status_id: data.lead_statuses?.id || data.status_id,
            status_name: data.lead_statuses?.name,
            status_color: data.lead_statuses?.color,
            seller_name: data.users?.name,
            subcampaign_name: data.subcampaigns?.name,
            subcampaign_color: data.subcampaigns?.color
        };
    },

    async getLeadByEmail(email) {
        if (!email || email.length < 3) return null;
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('id, email, phone, first_name, product_name, status_id, checking, subcampaign_id, previous_status_id, previous_checking, campaign_id, seller_id')
                .ilike('email', email)
                .limit(1)
                .maybeSingle();
            if (error) {
                console.error('getLeadByEmail error:', error);
                return null;
            }
            return data;
        } catch (err) {
            console.error('getLeadByEmail exception:', err);
            return null;
        }
    },

    async getLeadByPhone(phoneEnd) {
        if (!phoneEnd || phoneEnd.length < 10) return null;
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('id, email, phone, first_name, product_name, status_id, checking, subcampaign_id, previous_status_id, previous_checking, campaign_id, seller_id')
                .ilike('phone', `%${phoneEnd}`)
                .limit(1);
            if (error) {
                console.error('getLeadByPhone error:', error);
                return null;
            }
            return data?.[0] || null;
        } catch (err) {
            console.error('getLeadByPhone exception:', err);
            return null;
        }
    },

    async getLeadByPhoneAndCampaign(phoneEnd, campaignId) {
        if (!phoneEnd || phoneEnd.length < 8) return null;
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('id, email, phone, first_name, product_name, status_id, checking, subcampaign_id, previous_status_id, previous_checking, campaign_id, seller_id, in_group')
                .eq('campaign_id', campaignId)
                .ilike('phone', `%${phoneEnd}`)
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('getLeadByPhoneAndCampaign error:', error);
                return null;
            }
            return data;
        } catch (err) {
            console.error('getLeadByPhoneAndCampaign exception:', err);
            return null;
        }
    },

    async getLeadByEmailAndCampaign(email, campaignId) {
        if (!email || email.length < 3) return null;
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('id, email, phone, first_name, product_name, status_id, checking, subcampaign_id, previous_status_id, previous_checking, campaign_id, seller_id, in_group, observations')
                .eq('campaign_id', campaignId)
                .ilike('email', email)
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error('getLeadByEmailAndCampaign error:', error);
                return null;
            }
            return data;
        } catch (err) {
            console.error('getLeadByEmailAndCampaign exception:', err);
            return null;
        }
    },

    async getDefaultStatus() {
        const { data, error } = await supabase
            .from('lead_statuses')
            .select('id, name')
            .order('display_order', { ascending: true })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') {
            console.error('getDefaultStatus error:', error);
            return null;
        }
        return data;
    },

    async createLead(leadData) {
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateLead(uuid, leadData) {
        const { data, error } = await supabase
            .from('leads')
            .update({ ...leadData, updated_at: new Date().toISOString() })
            .eq('uuid', uuid)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateLeadById(id, leadData) {
        const { data, error } = await supabase
            .from('leads')
            .update({ ...leadData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteLead(uuid) {
        const { data, error } = await supabase
            .from('leads')
            .delete()
            .eq('uuid', uuid)
            .select();
        if (error) throw error;
        return { changes: data?.length || 0 };
    },

    async deleteLeadsByBatchId(batchId) {
        const { data, error } = await supabase
            .from('leads')
            .delete()
            .eq('import_batch_id', batchId)
            .select();
        if (error) throw error;
        return data?.length || 0;
    },

    async getAllLeadUuids(filters) {
        let allUuids = [];
        const PAGE_SIZE = 1000;
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            let query = supabase.from('leads').select('uuid');

            if (!filters.show_inactive) {
                query = query.or('is_active.eq.true,is_active.is.null');
            }
            if (filters.status) query = query.eq('status_id', filters.status);
            if (filters.campaign_id) query = query.eq('campaign_id', filters.campaign_id);
            if (filters.in_group !== undefined) query = query.eq('in_group', filters.in_group === 'true');
            if (filters.seller_id) query = query.eq('seller_id', filters.seller_id);
            if (filters.search) {
                query = query.or(`first_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
            }

            // Paginação para contornar limite do servidor
            query = query.range(from, from + PAGE_SIZE - 1);

            const { data, error } = await query;
            if (error) throw error;

            if (data && data.length > 0) {
                const uuids = data.map(l => l.uuid);
                allUuids = allUuids.concat(uuids);

                if (data.length < PAGE_SIZE) {
                    hasMore = false;
                } else {
                    from += PAGE_SIZE;
                }
            } else {
                hasMore = false;
            }
        }

        return allUuids;
    },

    // ==================== STATUSES ====================
    async getStatuses() {
        const { data, error } = await supabase
            .from('lead_statuses')
            .select('*')
            .order('display_order');
        if (error) throw error;
        return data || [];
    },

    async getStatusById(id) {
        const { data, error } = await supabase
            .from('lead_statuses')
            .select('*')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getStatusByName(name) {
        const { data, error } = await supabase
            .from('lead_statuses')
            .select('*')
            .eq('name', name)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async createStatus(statusData) {
        const { data, error } = await supabase
            .from('lead_statuses')
            .insert(statusData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateStatus(id, statusData) {
        const { data, error } = await supabase
            .from('lead_statuses')
            .update(statusData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteStatus(id) {
        const { error } = await supabase
            .from('lead_statuses')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async getMaxStatusOrder() {
        const { data, error } = await supabase
            .from('lead_statuses')
            .select('display_order')
            .order('display_order', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data?.display_order || 0;
    },

    async countLeadsByStatus(statusId) {
        const { count, error } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('status_id', statusId);
        if (error) throw error;
        return count || 0;
    },

    // ==================== CAMPAIGNS ====================
    async getCampaigns({ active_only = false } = {}) {
        let query = supabase.from('campaigns').select('*').order('created_at', { ascending: false });
        if (active_only) query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) throw error;

        // Para cada campanha, buscar contagem de leads
        const campaignsWithCounts = await Promise.all((data || []).map(async (campaign) => {
            const { count: totalLeads } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id);

            const { count: notInGroup } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)
                .or('in_group.eq.false,in_group.is.null');

            return {
                ...campaign,
                total_leads: totalLeads || 0,
                not_in_group: notInGroup || 0
            };
        }));

        return campaignsWithCounts;
    },

    async getCampaignsForSeller(sellerId, { active_only = false } = {}) {
        // Buscar campanhas onde o seller tem leads
        let query = supabase
            .from('leads')
            .select('campaign_id, campaigns!campaign_id(id, uuid, name, description, is_active, created_at, updated_at, mirror_campaign_id)')
            .eq('seller_id', sellerId)
            .not('campaign_id', 'is', null);

        const { data, error } = await query;
        if (error) throw error;

        // Extrair campanhas únicas
        const campaignsMap = new Map();
        (data || []).forEach(item => {
            if (item.campaigns && (!active_only || item.campaigns.is_active)) {
                campaignsMap.set(item.campaigns.id, item.campaigns);
            }
        });

        const uniqueCampaigns = Array.from(campaignsMap.values());

        // Para cada campanha, buscar contagem de leads DO SELLER
        const campaignsWithCounts = await Promise.all(uniqueCampaigns.map(async (campaign) => {
            const { count: totalLeads } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)
                .eq('seller_id', sellerId);

            const { count: notInGroup } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('campaign_id', campaign.id)
                .eq('seller_id', sellerId)
                .or('in_group.eq.false,in_group.is.null');

            return {
                ...campaign,
                total_leads: totalLeads || 0,
                not_in_group: notInGroup || 0
            };
        }));

        // Ordenar por data de criação (mais recente primeiro)
        return campaignsWithCounts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    async getCampaignById(uuidOrId) {
        if (!uuidOrId) return null;
        let query = supabase.from('campaigns').select('*');

        const isUuid = typeof uuidOrId === 'string' && uuidOrId.length > 20;

        if (isUuid) {
            query = query.eq('uuid', uuidOrId);
        } else {
            query = query.eq('id', uuidOrId);
        }

        const { data, error } = await query.single();
        if (error) {
            console.error('getCampaignById error:', error);
            return null;
        }
        return data;
    },

    async getCampaignByUuid(uuid) {
        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('uuid', uuid)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async createCampaign(campaignData) {
        const { data, error } = await supabase
            .from('campaigns')
            .insert(campaignData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateCampaign(uuid, campaignData) {
        const { data, error } = await supabase
            .from('campaigns')
            .update({ ...campaignData, updated_at: new Date().toISOString() })
            .eq('uuid', uuid)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteCampaign(uuid) {
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('uuid', uuid);
        if (error) throw error;
    },

    async deactivateAllCampaigns() {
        const { error } = await supabase
            .from('campaigns')
            .update({ is_active: false })
            .neq('id', 0); // Update all
        if (error) throw error;
    },

    // ==================== IMPORT BATCHES ====================
    async getImportBatches() {
        const { data, error } = await supabase
            .from('import_batches')
            .select(`
                *,
                campaigns(name)
            `)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(b => ({
            ...b,
            campaign_name: b.campaigns?.name
        }));
    },

    async getImportBatchByUuid(uuid) {
        const { data, error } = await supabase
            .from('import_batches')
            .select('*')
            .eq('uuid', uuid)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async createImportBatch(batchData) {
        const { data, error } = await supabase
            .from('import_batches')
            .insert(batchData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateImportBatch(id, batchData) {
        const { error } = await supabase
            .from('import_batches')
            .update(batchData)
            .eq('id', id);
        if (error) throw error;
    },

    async deleteImportBatch(uuid) {
        const { error } = await supabase
            .from('import_batches')
            .delete()
            .eq('uuid', uuid);
        if (error) throw error;
    },

    async countLeadsByBatchId(batchId) {
        const { count, error } = await supabase
            .from('leads')
            .select('*', { count: 'exact', head: true })
            .eq('import_batch_id', batchId);
        if (error) throw error;
        return count || 0;
    },

    // ==================== API SETTINGS ====================
    async getApiSettings() {
        const { data, error } = await supabase
            .from('api_settings')
            .select('*')
            .eq('id', 1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async upsertApiSettings(settings) {
        // Primeiro, verificar se já existe
        const existing = await this.getApiSettings();

        if (existing) {
            // Se existe, fazer UPDATE
            const { data, error } = await supabase
                .from('api_settings')
                .update({ ...settings, updated_at: new Date().toISOString() })
                .eq('id', 1)
                .select()
                .single();
            if (error) throw error;
            return data;
        } else {
            // Se não existe, fazer INSERT com todos os campos obrigatórios
            const { data, error } = await supabase
                .from('api_settings')
                .insert({
                    id: 1,
                    webhook_token: settings.webhook_token || uuidv4(),
                    webhook_enabled: settings.webhook_enabled !== undefined ? settings.webhook_enabled : true,
                    require_token: settings.require_token !== undefined ? settings.require_token : false,
                    round_robin_enabled: settings.round_robin_enabled !== undefined ? settings.round_robin_enabled : true,
                    greatpages_ngrok_url: settings.greatpages_ngrok_url || null,
                    greatpages_default_campaign_id: settings.greatpages_default_campaign_id || null,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();
            if (error) throw error;
            return data;
        }
    },

    // ==================== DISTRIBUTION CONTROL ====================
    async getDistributionControl() {
        const { data, error } = await supabase
            .from('distribution_control')
            .select('*')
            .eq('id', 1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async updateDistributionControl(lastSellerId) {
        const { error } = await supabase
            .from('distribution_control')
            .upsert({
                id: 1,
                last_seller_id: lastSellerId,
                updated_at: new Date().toISOString()
            });
        if (error) throw error;
    },

    // ==================== DASHBOARD ====================
    async getDashboardStats(sellerId = null) {
        // Total de leads
        let totalQuery = supabase.from('leads').select('*', { count: 'exact', head: true });
        if (sellerId) totalQuery = totalQuery.eq('seller_id', sellerId);
        const { count: totalLeads } = await totalQuery;

        // Leads por status
        const { data: statuses } = await supabase.from('lead_statuses').select('id, name, color, is_conversion');

        const statusCounts = {};
        let conversions = 0;

        for (const status of (statuses || [])) {
            let countQuery = supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status_id', status.id);
            if (sellerId) countQuery = countQuery.eq('seller_id', sellerId);
            const { count } = await countQuery;
            statusCounts[status.name] = count || 0;
            if (status.is_conversion) conversions += count || 0;
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

        return {
            total_leads: totalLeads || 0,
            conversions,
            conversion_rate: totalLeads ? ((conversions / totalLeads) * 100).toFixed(1) : 0,
            status_counts: statusCounts,
            recent_leads: (recentLeads || []).map(l => ({
                uuid: l.uuid,
                first_name: l.first_name,
                product_name: l.product_name,
                status_name: l.lead_statuses?.name,
                status_color: l.lead_statuses?.color
            }))
        };
    },

    // ==================== SUBCAMPAIGNS ====================
    async getSubcampaigns({ campaign_id, active_only }) {
        let query = supabase
            .from('subcampaigns')
            .select('*, campaigns(id, name)')
            .order('created_at', { ascending: false });

        if (campaign_id) query = query.eq('campaign_id', campaign_id);
        if (active_only) query = query.eq('is_active', true);

        const { data, error } = await query;
        if (error) throw error;

        // Para cada subcampanha, buscar contagem de leads
        const subcampaignsWithCounts = await Promise.all((data || []).map(async (subcampaign) => {
            const { count: totalLeads } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('subcampaign_id', subcampaign.id);

            return {
                ...subcampaign,
                total_leads: totalLeads || 0
            };
        }));

        return subcampaignsWithCounts;
    },

    async getSubcampaignByUuid(uuid) {
        const { data, error } = await supabase
            .from('subcampaigns')
            .select('*, campaigns(id, name)')
            .eq('uuid', uuid)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getSubcampaignById(id) {
        const { data, error } = await supabase
            .from('subcampaigns')
            .select('*')
            .eq('id', id)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async createSubcampaign(subcampaignData) {
        const { data, error } = await supabase
            .from('subcampaigns')
            .insert(subcampaignData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateSubcampaign(uuid, updateData) {
        const { data, error } = await supabase
            .from('subcampaigns')
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq('uuid', uuid)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteSubcampaign(uuid) {
        const { error } = await supabase
            .from('subcampaigns')
            .delete()
            .eq('uuid', uuid);
        if (error) throw error;
    },

    // Restaurar status e checking dos leads ao excluir subcampanha
    async restoreLeadsFromSubcampaign(subcampaignId) {
        console.log(`🔄 Restaurando leads da subcampanha ${subcampaignId}`);
        // Buscar todos os leads com esta subcampanha
        const { data: leads, error: fetchError } = await supabase
            .from('leads')
            .select('id, previous_status_id, previous_checking')
            .eq('subcampaign_id', subcampaignId);

        if (fetchError) throw fetchError;
        if (!leads || leads.length === 0) {
            console.log('   ↳ Nenhum lead para restaurar');
            return;
        }

        console.log(`   ↳ Restaurando ${leads.length} leads`);

        // Para cada lead, restaurar os valores antigos
        for (const lead of leads) {
            console.log(`   ↳ Lead ${lead.id}: prev_status=${lead.previous_status_id}, prev_checking=${lead.previous_checking}`);
            await supabase
                .from('leads')
                .update({
                    status_id: lead.previous_status_id,
                    checking: lead.previous_checking ?? false,
                    subcampaign_id: null,
                    previous_status_id: null,
                    previous_checking: null
                })
                .eq('id', lead.id);
        }
        console.log('   ↳ Restauração concluída');
    },

    // ==================== SCHEDULES ====================
    async getSchedules({ lead_id, seller_id, upcoming_only, limit = 50 }) {
        let query = supabase
            .from('schedules')
            .select(`
                *,
                leads!lead_id(id, uuid, first_name, phone, product_name),
                users!created_by(id, name)
            `)
            .order('scheduled_at', { ascending: true });

        if (lead_id) query = query.eq('lead_id', lead_id);
        if (seller_id) {
            // Buscar leads do seller e filtrar por eles
            const { data: sellerLeads } = await supabase
                .from('leads')
                .select('id')
                .eq('seller_id', seller_id);
            const leadIds = (sellerLeads || []).map(l => l.id);
            if (leadIds.length > 0) {
                query = query.in('lead_id', leadIds);
            } else {
                return [];
            }
        }
        if (upcoming_only) {
            query = query.gte('scheduled_at', new Date().toISOString()).eq('completed', false);
        }
        if (limit) query = query.limit(limit);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async getSchedulesByLead(leadId) {
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .eq('lead_id', leadId)
            .order('scheduled_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async createSchedule(scheduleData) {
        const { data, error } = await supabase
            .from('schedules')
            .insert(scheduleData)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async updateSchedule(uuid, scheduleData) {
        const { data, error } = await supabase
            .from('schedules')
            .update({ ...scheduleData, updated_at: new Date().toISOString() })
            .eq('uuid', uuid)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteSchedule(uuid) {
        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('uuid', uuid);
        if (error) throw error;
    },

    async hasScheduleOrObservation(leadId) {
        // Verificar se lead tem agendamento ou observação
        const { count: scheduleCount } = await supabase
            .from('schedules')
            .select('*', { count: 'exact', head: true })
            .eq('lead_id', leadId);

        const { data: lead } = await supabase
            .from('leads')
            .select('observations')
            .eq('id', leadId)
            .single();

        const hasObservation = lead?.observations && lead.observations.length > 0;
        return (scheduleCount || 0) > 0 || hasObservation;
    },

    // ==================== LEAD CAMPAIGN GROUPS (IN_GROUP POR CAMPANHA) ====================

    async getLeadCampaignGroup(leadId, campaignId) {
        const { data, error } = await supabase
            .from('lead_campaign_groups')
            .select('*')
            .eq('lead_id', leadId)
            .eq('campaign_id', campaignId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async setLeadCampaignGroup(leadId, campaignId, inGroup) {
        const { data, error } = await supabase
            .from('lead_campaign_groups')
            .upsert({
                lead_id: leadId,
                campaign_id: campaignId,
                in_group: inGroup,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'lead_id,campaign_id'
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async getLeadGroupsByCampaign(campaignId, inGroup = true) {
        const { data, error } = await supabase
            .from('lead_campaign_groups')
            .select('lead_id')
            .eq('campaign_id', campaignId)
            .eq('in_group', inGroup);
        if (error) throw error;
        return data || [];
    }
};

export function initializeDatabase() {
    console.log('✅ Supabase client initialized');
    console.log(`📌 Connected to: ${supabaseUrl}`);
}

export default db;
