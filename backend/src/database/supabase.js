/**
 * Supabase Database Client
 * Cliente otimizado para operações com Supabase
 */

import { createClient } from '@supabase/supabase-js';
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
    async getLeads({ status, search, campaign_id, in_group, show_inactive, seller_id, page = 1, limit = 50 }) {
        let query = supabase
            .from('leads')
            .select(`
                *,
                lead_statuses!inner(id, name, color),
                users(id, name),
                campaigns(id, name)
            `, { count: 'exact' });

        if (!show_inactive) {
            query = query.or('is_active.eq.true,is_active.is.null');
        }
        if (seller_id) query = query.eq('seller_id', seller_id);
        if (status) query = query.eq('status_id', status);
        if (campaign_id) query = query.eq('campaign_id', campaign_id);
        if (in_group !== undefined) query = query.eq('in_group', in_group === 'true');
        if (search) {
            query = query.or(`first_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        const offset = (page - 1) * limit;
        query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

        const { data, error, count } = await query;
        if (error) throw error;

        // Mapear dados para formato esperado
        const leads = (data || []).map(l => ({
            ...l,
            status_id: l.lead_statuses?.id,
            status_name: l.lead_statuses?.name,
            status_color: l.lead_statuses?.color,
            seller_id: l.users?.id,
            seller_name: l.users?.name,
            campaign_name: l.campaigns?.name
        }));

        return { leads, total: count || 0 };
    },

    async getLeadByUuid(uuid) {
        const { data, error } = await supabase
            .from('leads')
            .select(`
                *,
                lead_statuses(id, name, color),
                users(id, name),
                campaigns(id, name)
            `)
            .eq('uuid', uuid)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (!data) return null;
        return {
            ...data,
            status_id: data.lead_statuses?.id,
            status_name: data.lead_statuses?.name,
            status_color: data.lead_statuses?.color,
            seller_name: data.users?.name
        };
    },

    async getLeadByEmail(email) {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .ilike('email', email)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getLeadByPhone(phoneEnd) {
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .ilike('phone', `%${phoneEnd}`);
        if (error) throw error;
        return data?.[0] || null;
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
        let query = supabase.from('leads').select('uuid');

        if (!filters.show_inactive) {
            query = query.or('is_active.eq.true,is_active.is.null');
        }
        if (filters.status) query = query.eq('status_id', filters.status);
        if (filters.campaign_id) query = query.eq('campaign_id', filters.campaign_id);
        if (filters.in_group !== undefined) query = query.eq('in_group', filters.in_group === 'true');
        if (filters.search) {
            query = query.or(`first_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(l => l.uuid);
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
        return data || [];
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
        const { data, error } = await supabase
            .from('api_settings')
            .upsert({ id: 1, ...settings, updated_at: new Date().toISOString() })
            .select()
            .single();
        if (error) throw error;
        return data;
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
    }
};

export function initializeDatabase() {
    console.log('✅ Supabase client initialized');
    console.log(`📌 Connected to: ${supabaseUrl}`);
}

export default db;
