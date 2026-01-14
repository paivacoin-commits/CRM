/**
 * Settings Routes - Supabase Version
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, supabase } from '../database/supabase.js';
import { wappiService } from '../services/wappiService.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

// ============================================
// CONFIGURAÇÕES DE API
// ============================================

/**
 * GET /api/settings/api
 */
router.get('/api', async (req, res) => {
    try {
        let settings = await db.getApiSettings();

        if (!settings) {
            const webhookToken = uuidv4();
            settings = await db.upsertApiSettings({
                webhook_token: webhookToken,
                webhook_enabled: true,
                require_token: false,
                round_robin_enabled: true
            });
        }

        res.json({
            webhook_url: `/api/webhook/hotmart`,
            webhook_token: settings.webhook_token,
            webhook_enabled: settings.webhook_enabled,
            require_token: settings.require_token,
            round_robin_enabled: settings.round_robin_enabled,
            greatpages_ngrok_url: settings.greatpages_ngrok_url,
            greatpages_default_campaign_id: settings.greatpages_default_campaign_id,
            exclusion_enabled: settings.exclusion_enabled,
            exclusion_token: settings.exclusion_token,
            exclusion_group_ids: settings.exclusion_group_ids || []
        });
    } catch (error) {
        console.error('Error fetching API settings:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

/**
 * PATCH /api/settings/api
 */
router.patch('/api', async (req, res) => {
    try {
        const {
            webhook_enabled,
            require_token,
            regenerate_token,
            round_robin_enabled,
            greatpages_ngrok_url,
            greatpages_default_campaign_id,
            exclusion_enabled,
            exclusion_token,
            exclusion_group_ids
        } = req.body;

        console.log('📝 Updating API settings:', req.body);

        const updateData = {};
        if (typeof webhook_enabled === 'boolean') updateData.webhook_enabled = webhook_enabled;
        if (typeof require_token === 'boolean') updateData.require_token = require_token;
        if (typeof round_robin_enabled === 'boolean') updateData.round_robin_enabled = round_robin_enabled;
        if (greatpages_ngrok_url !== undefined) updateData.greatpages_ngrok_url = greatpages_ngrok_url;
        if (greatpages_default_campaign_id !== undefined) updateData.greatpages_default_campaign_id = greatpages_default_campaign_id;

        // Exclusion API updates
        if (typeof exclusion_enabled === 'boolean') updateData.exclusion_enabled = exclusion_enabled;
        if (exclusion_token !== undefined) updateData.exclusion_token = exclusion_token;
        if (exclusion_group_ids !== undefined) updateData.exclusion_group_ids = exclusion_group_ids;

        if (regenerate_token) updateData.webhook_token = uuidv4();

        console.log('📝 Update data:', updateData);

        if (Object.keys(updateData).length > 0) {
            const result = await db.upsertApiSettings(updateData);
            console.log('✅ Settings updated:', result);
        }

        res.json({ message: 'Configurações atualizadas' });
    } catch (error) {
        console.error('❌ Error updating API settings:', error);
        console.error('Error details:', error.message, error.code, error.details);
        res.status(500).json({ error: 'Erro ao atualizar configurações', details: error.message });
    }
});

// ============================================
// ORDEM DE DISTRIBUIÇÃO
// ============================================

/**
 * GET /api/settings/distribution-order
 */
router.get('/distribution-order', async (req, res) => {
    try {
        const sellers = await db.getActiveSellersInDistribution();
        res.json({
            sellers: sellers.map(s => ({
                id: s.id,
                uuid: s.uuid,
                name: s.name,
                email: s.email,
                is_active: s.is_active,
                is_in_distribution: s.is_in_distribution,
                distribution_order: s.distribution_order
            }))
        });
    } catch (error) {
        console.error('Error fetching distribution order:', error);
        res.status(500).json({ error: 'Erro ao buscar ordem' });
    }
});

/**
 * PUT /api/settings/distribution-order
 */
router.put('/distribution-order', async (req, res) => {
    try {
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Ordem deve ser um array de IDs' });
        }

        for (let i = 0; i < order.length; i++) {
            const user = await db.getUserById(order[i]);
            if (user) {
                await db.updateUser(user.uuid, { distribution_order: i + 1 });
            }
        }

        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (error) {
        console.error('Error updating distribution order:', error);
        res.status(500).json({ error: 'Erro ao atualizar ordem' });
    }
});

// ============================================
// EXPORTAR CONTATOS
// ============================================

/**
 * GET /api/settings/export/leads
 */
router.get('/export/leads', async (req, res) => {
    try {
        const { seller_id, campaign_id, format = 'json' } = req.query;

        // Paginação para buscar TODOS os leads (bypass limit 1000)
        let allLeads = [];
        let page = 1;
        let hasMore = true;
        const LIMIT = 1000;

        while (hasMore) {
            const filters = {
                seller_id: seller_id || null,
                campaign_id: campaign_id || null,
                show_inactive: true,
                page: page,
                limit: LIMIT
            };

            const { leads } = await db.getLeads(filters);
            allLeads = allLeads.concat(leads);

            if (leads.length < LIMIT) {
                hasMore = false;
            } else {
                page++;
            }
        }

        const leads = allLeads;

        // Inverter ordem para exportar de cima pra baixo (mais antigo primeiro)
        const leadsOrdered = [...leads].reverse();

        // Buscar todos os agendamentos
        const allSchedules = await db.getSchedules({ limit: 10000 });
        const schedulesByLead = {};
        allSchedules.forEach(s => {
            if (!schedulesByLead[s.lead_id]) schedulesByLead[s.lead_id] = [];
            schedulesByLead[s.lead_id].push({
                scheduled_at: s.scheduled_at,
                observation: s.observation,
                completed: s.completed
            });
        });

        const exportData = leadsOrdered.map(l => ({
            // Dados básicos
            nome: l.first_name,
            email: l.email,
            telefone: l.phone,
            produto: l.product_name,
            // Relacionamentos
            vendedora: l.seller_name,
            seller_id: l.seller_id,
            campanha: l.campaign_name,
            campaign_id: l.campaign_id,
            subcampaign_id: l.subcampaign_id,
            // Status e controles
            status: l.status_name,
            status_id: l.status_id,
            in_group: l.in_group,
            checking: l.checking,
            sale_completed: l.sale_completed,
            // Observações e datas
            observacoes: l.observations,
            notes: l.notes,
            data_entrada: l.created_at,
            updated_at: l.updated_at,
            // IDs para referência
            uuid: l.uuid,
            id: l.id,
            // Agendamentos (ações)
            agendamentos: schedulesByLead[l.id] || []
        }));

        if (format === 'csv') {
            const headers = ['Nome', 'Email', 'Telefone', 'Produto', 'Data Entrada', 'Status', 'Vendedora', 'Observações'];
            const csvRows = [headers.join(';')];

            exportData.forEach(lead => {
                const row = [
                    lead.nome || '',
                    lead.email || '',
                    lead.telefone || '',
                    lead.produto || '',
                    lead.data_entrada || '',
                    lead.status || '',
                    lead.vendedora || '',
                    (lead.observacoes || '').replace(/\n/g, ' | ')
                ].map(v => `"${v}"`);
                csvRows.push(row.join(';'));
            });

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
            return res.send('\uFEFF' + csvRows.join('\n'));
        }

        res.json({ leads: exportData, total: exportData.length });
    } catch (error) {
        console.error('Error exporting leads:', error);
        res.status(500).json({ error: 'Erro ao exportar leads' });
    }
});

// ============================================
// BACKUP NO SUPABASE
// ============================================

/**
 * POST /api/settings/backup-to-supabase
 * Salva o backup diretamente no Supabase
 */
router.post('/backup-to-supabase', async (req, res) => {
    console.log('💾 Salvando backup no Supabase...');
    try {
        // Paginação para buscar TODOS os leads
        let allLeads = [];
        let page = 1;
        let hasMore = true;
        const LIMIT = 1000;

        while (hasMore) {
            const filters = {
                show_inactive: true,
                page: page,
                limit: LIMIT
            };

            const { leads } = await db.getLeads(filters);
            allLeads = allLeads.concat(leads);

            if (leads.length < LIMIT) {
                hasMore = false;
            } else {
                page++;
            }
        }

        const leads = allLeads;
        const leadsOrdered = [...leads].reverse();

        // Buscar agendamentos
        const allSchedules = await db.getSchedules({ limit: 10000 });
        const schedulesByLead = {};
        allSchedules.forEach(s => {
            if (!schedulesByLead[s.lead_id]) schedulesByLead[s.lead_id] = [];
            schedulesByLead[s.lead_id].push({
                scheduled_at: s.scheduled_at,
                observation: s.observation,
                completed: s.completed
            });
        });

        const exportData = leadsOrdered.map(l => ({
            nome: l.first_name,
            email: l.email,
            telefone: l.phone,
            produto: l.product_name,
            vendedora: l.seller_name,
            seller_id: l.seller_id,
            campanha: l.campaign_name,
            campaign_id: l.campaign_id,
            subcampaign_id: l.subcampaign_id,
            status: l.status_name,
            status_id: l.status_id,
            in_group: l.in_group,
            checking: l.checking,
            sale_completed: l.sale_completed,
            observacoes: l.observations,
            uuid: l.uuid,
            id: l.id,
            agendamentos: schedulesByLead[l.id] || []
        }));

        const backupData = {
            version: '1.0',
            created_at: new Date().toISOString(),
            total_leads: exportData.length,
            total_schedules: allSchedules.length,
            leads: exportData
        };

        // Salvar no Supabase
        const { data, error } = await supabase
            .from('backups')
            .insert({
                name: `Backup ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
                total_leads: exportData.length,
                total_schedules: allSchedules.length,
                data: backupData,
                created_by: req.user?.id || 1
            })
            .select()
            .single();

        if (error) throw error;

        console.log(`✅ Backup salvo no Supabase: ${data.id}`);
        res.json({
            success: true,
            message: 'Backup salvo no Supabase',
            backup_id: data.id,
            total_leads: exportData.length,
            total_schedules: allSchedules.length
        });
    } catch (error) {
        console.error('Error saving backup to Supabase:', error);
        res.status(500).json({ error: 'Erro ao salvar backup no Supabase' });
    }
});

/**
 * GET /api/settings/backups
 * Lista os backups salvos no Supabase
 */
router.get('/backups', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('backups')
            .select('id, uuid, name, total_leads, total_schedules, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        res.json({ backups: data || [] });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({ error: 'Erro ao listar backups' });
    }
});

/**
 * GET /api/settings/backups/:id
 * Busca um backup específico do Supabase
 */
router.get('/backups/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('backups')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        res.json({ backup: data });
    } catch (error) {
        console.error('Error getting backup:', error);
        res.status(500).json({ error: 'Erro ao buscar backup' });
    }
});

/**
 * DELETE /api/settings/backups/:id
 * Deleta um backup do Supabase
 */
router.delete('/backups/:id', async (req, res) => {
    try {
        const { error } = await supabase
            .from('backups')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true, message: 'Backup deletado' });
    } catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).json({ error: 'Erro ao deletar backup' });
    }
});

// ============================================
// RESTAURAR BACKUP
// ============================================

// Endpoint de teste para debug
router.get('/test-create-lead', async (req, res) => {
    console.log('🧪 Test create lead');
    try {
        const testLead = {
            uuid: uuidv4(),
            first_name: 'Teste Restauração',
            email: 'teste' + Date.now() + '@teste.com',
            phone: '11999999999',
            source: 'test'
        };
        console.log('📝 Criando lead de teste:', testLead);
        const result = await db.createLead(testLead);
        console.log('✅ Lead criado:', result);
        res.json({ success: true, lead: result });
    } catch (err) {
        console.error('❌ Erro ao criar lead de teste:', err);
        res.status(500).json({ success: false, error: err.message, details: err });
    }
});

/**
 * POST /api/settings/restore-backup
 * Restaura leads a partir de um arquivo de backup
 */
router.post('/restore-backup', async (req, res) => {
    console.log('🔄 Restore backup request received');
    try {
        const { leads } = req.body;

        if (!Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: 'Nenhum lead para restaurar' });
        }

        // PRIMEIRO: Deletar TODOS os leads e agendamentos existentes
        console.log('🗑️ Deletando todos os leads e agendamentos existentes...');

        // Deletar todos os agendamentos
        const { error: schedError } = await supabase.from('schedules').delete().neq('id', 0);
        if (schedError) console.error('Erro ao deletar agendamentos:', schedError.message);
        else console.log('   ✅ Agendamentos deletados');

        // Deletar todos os leads
        const { error: leadsError } = await supabase.from('leads').delete().neq('id', 0);
        if (leadsError) console.error('Erro ao deletar leads:', leadsError.message);
        else console.log('   ✅ Leads deletados');

        let restored = 0;
        let created = 0;
        let skipped = 0;

        for (const lead of leads) {
            try {
                const leadEmail = (lead.email || '').trim().toLowerCase();
                const leadPhone = (lead.telefone || lead.phone || '').replace(/\D/g, '');
                const leadNome = lead.nome || lead.first_name || 'Sem nome';
                const leadProduto = lead.produto || lead.product_name || '';

                // Usar seller_id diretamente do backup
                const sellerId = lead.seller_id || null;

                // SEMPRE criar lead (não buscar existente para evitar conflitos)
                const createData = {
                    uuid: uuidv4(),
                    first_name: leadNome,
                    email: leadEmail || null,
                    phone: leadPhone || null,
                    product_name: leadProduto || null,
                    seller_id: sellerId,
                    status_id: lead.status_id || null,
                    in_group: lead.in_group !== undefined ? lead.in_group : true,
                    checking: lead.checking === true,
                    sale_completed: lead.sale_completed === true,
                    campaign_id: lead.campaign_id || null,
                    subcampaign_id: lead.subcampaign_id || null,
                    observations: lead.observacoes || null,
                    source: 'restore'
                };

                console.log('📝 Criando lead:', leadNome);
                const newLead = await db.createLead(createData);
                created++;

                // Restaurar agendamentos do lead
                if (lead.agendamentos && Array.isArray(lead.agendamentos) && lead.agendamentos.length > 0) {
                    for (const agend of lead.agendamentos) {
                        try {
                            await db.createSchedule({
                                lead_id: newLead.id,
                                scheduled_at: agend.scheduled_at,
                                observation: agend.observation || agend.notes || null,
                                completed: agend.completed || false,
                                created_by: sellerId || 1
                            });
                            console.log(`   📅 Agendamento restaurado`);
                        } catch (schedErr) {
                            console.error('   ❌ Erro agendamento:', schedErr.message);
                        }
                    }
                }
            } catch (err) {
                console.error('❌ Erro ao restaurar lead:', err.message);
                skipped++;
            }
        }

        console.log(`🔄 Restauração concluída: ${restored} atualizados, ${created} criados, ${skipped} ignorados`);
        res.json({
            message: 'Restauração concluída',
            restored,
            created,
            skipped,
            total: leads.length
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).json({ error: 'Erro ao restaurar backup' });
    }
});

// ============================================
// IMPORTAR CONTATOS
// ============================================

/**
 * POST /api/settings/import/leads
 */
router.post('/import/leads', async (req, res) => {
    console.log('📥 Import request received');
    try {
        const {
            leads,
            csv,
            seller_id,
            distribute = false,
            campaign_id = null,
            subcampaign_id = null,
            status_id = null,
            in_group = false,
            preserve_in_group = false,
            update_existing = true,
            batch_name = null
        } = req.body;

        console.log('📥 Import data:', {
            hasLeads: !!leads,
            hasCSV: !!csv,
            distribute,
            campaign_id,
            subcampaign_id,
            status_id,
            seller_id,
            update_existing
        });

        let leadsToImport = [];

        if (csv && typeof csv === 'string') {
            leadsToImport = parseCSV(csv);
        } else if (Array.isArray(leads) && leads.length > 0) {
            leadsToImport = leads;
        } else {
            return res.status(400).json({ error: 'Envie leads (JSON) ou csv (string CSV)' });
        }

        if (leadsToImport.length === 0) {
            return res.status(400).json({ error: 'Nenhum lead encontrado para importar' });
        }

        // Criar batch de importação
        const batch = await db.createImportBatch({
            uuid: uuidv4(),
            name: batch_name || `Importação ${new Date().toLocaleString('pt-BR')}`,
            source: 'manual',
            campaign_id,
            seller_id: distribute ? null : seller_id,
            in_group,
            created_by: req.user.id
        });

        let imported = 0;
        let updated = 0;
        let skipped = 0;

        // Buscar vendedoras para distribuição
        let sellers = [];
        let sellerIndex = 0;

        if (distribute) {
            sellers = await db.getActiveSellersInDistribution();
        }

        // Buscar o primeiro status disponível (para novos leads)
        const defaultStatus = await db.getDefaultStatus();
        const defaultStatusId = defaultStatus?.id || 1;
        console.log(`📌 Status padrão para novos leads: id=${defaultStatusId}`);

        // Buscar todos os status para mapear por nome
        const allStatuses = await db.getStatuses();
        const statusMap = {};
        allStatuses.forEach(s => {
            statusMap[s.name.toLowerCase().trim()] = s.id;
        });
        console.log(`📌 Status disponíveis: ${Object.keys(statusMap).join(', ')}`);

        for (const lead of leadsToImport) {
            try {
                const leadEmail = (lead.email || lead.Email || '').trim().toLowerCase();
                const leadPhone = (lead.telefone || lead.phone || lead.phone_number || lead.Telefone || lead.WhatsApp || lead.whatsapp || '').replace(/\D/g, '');
                const leadNome = lead.nome || lead.first_name || lead.name || lead.Nome || '';
                const leadProduto = lead.produto || lead.product_name || lead.product || lead.Produto || '';
                const leadStatusName = (lead.status_name || lead.status || lead.Status || '').trim().toLowerCase();

                // Buscar status_id pelo nome
                let leadStatusId = status_id || null;
                if (leadStatusName && statusMap[leadStatusName]) {
                    leadStatusId = statusMap[leadStatusName];
                    console.log(`   ↳ Status do CSV: "${leadStatusName}" -> id=${leadStatusId}`);
                }

                console.log(`📋 Processando lead: nome="${leadNome}", email="${leadEmail}", phone="${leadPhone}", status="${leadStatusName}"`);

                // Verificar se já existe NA MESMA CAMPANHA
                let existing = null;

                // Se campaign_id foi fornecido, buscar apenas nessa campanha
                if (campaign_id) {
                    if (leadEmail && leadEmail.length > 5 && leadEmail.includes('@')) {
                        existing = await db.getLeadByEmailAndCampaign(leadEmail, campaign_id);
                        if (existing) console.log(`   ↳ Encontrado por email na campanha ${campaign_id}: id=${existing.id}`);
                    }

                    if (!existing && leadPhone && leadPhone.length >= 10) {
                        // Tentar buscar pelo telefone completo primeiro
                        console.log(`   🔍 Buscando por telefone COMPLETO na campanha ${campaign_id}: ${leadPhone}`);
                        existing = await db.getLeadByPhoneAndCampaign(leadPhone, campaign_id);

                        if (existing) {
                            console.log(`   ↳ Encontrado por telefone COMPLETO na campanha ${campaign_id}: id=${existing.id}, phone=${existing.phone}`);
                        } else {
                            // Se não encontrou, tentar pelos últimos 8 dígitos
                            const phoneEnd = leadPhone.slice(-8);
                            console.log(`   🔍 Buscando por últimos 8 dígitos na campanha ${campaign_id}: ${phoneEnd}`);
                            existing = await db.getLeadByPhoneAndCampaign(phoneEnd, campaign_id);

                            if (existing) {
                                console.log(`   ↳ Encontrado por últimos 8 dígitos na campanha ${campaign_id}: id=${existing.id}, phone=${existing.phone}`);
                            } else {
                                console.log(`   ↳ NÃO encontrado por telefone na campanha ${campaign_id}`);
                            }
                        }
                    }
                } else {
                    // Sem campaign_id: buscar globalmente (comportamento antigo)
                    if (leadEmail && leadEmail.length > 5 && leadEmail.includes('@')) {
                        existing = await db.getLeadByEmail(leadEmail);
                        if (existing) console.log(`   ↳ Encontrado por email: id=${existing.id}`);
                    }

                    if (!existing && leadPhone && leadPhone.length >= 10) {
                        const phoneEnd = leadPhone.slice(-8);
                        existing = await db.getLeadByPhone(phoneEnd);
                        if (existing) console.log(`   ↳ Encontrado por phone: id=${existing.id}`);
                    }
                }


                if (existing) {
                    console.log(`⚠️ Lead existe - Email: ${leadEmail}, Phone: ${leadPhone}, ExistingID: ${existing.id}, Campaign: ${existing.campaign_id}`);

                    if (update_existing) {
                        // Atualizar lead existente
                        console.log(`📝 Atualizando lead existente na campanha ${existing.campaign_id}`);

                        let updateSellerId = existing.seller_id;

                        // Verificar espelhamento antes de sobrescrever
                        let isMirrored = false;
                        let mirroredSellerId = null;
                        let mirrorCampaignId = null;

                        if (campaign_id) {
                            try {
                                console.log(`🔍 Debug Mirror Update: Buscando campanha destino ID=${campaign_id}`);
                                const targetCampaign = await db.getCampaignById(campaign_id);

                                if (targetCampaign && targetCampaign.mirror_campaign_id) {
                                    mirrorCampaignId = targetCampaign.mirror_campaign_id;
                                    console.log(`🔍 Debug Mirror Update: Campanha encontrada. MirrorID=${mirrorCampaignId}`);
                                    console.log(`🔍 Debug Mirror Update: Comparando existing.campaign_id (${existing.campaign_id}) com mirror (${mirrorCampaignId})`);

                                    // Converter para string para garantir comparação
                                    if (String(existing.campaign_id) === String(mirrorCampaignId)) {
                                        isMirrored = true;
                                        console.log(`   🪞 Espelhamento detectado (Update): Buscando vendedora na campanha ${mirrorCampaignId}...`);

                                        // BUSCAR vendedora na campanha de origem (igual ao CREATE path)
                                        let sourceLead = null;

                                        // Tentar por telefone primeiro
                                        if (leadPhone && leadPhone.length >= 8) {
                                            const phoneEnd = leadPhone.slice(-8);
                                            const { data: leads } = await supabase
                                                .from('leads')
                                                .select('seller_id')
                                                .eq('campaign_id', mirrorCampaignId)
                                                .ilike('phone', `%${phoneEnd}`)
                                                .limit(1);
                                            if (leads && leads.length > 0) {
                                                sourceLead = leads[0];
                                                console.log(`   📞 Encontrado por telefone (${phoneEnd}): seller_id=${sourceLead.seller_id}`);
                                            }
                                        }

                                        // Se não encontrou por telefone, tentar por email
                                        if (!sourceLead && leadEmail && leadEmail.includes('@')) {
                                            const { data: leads } = await supabase
                                                .from('leads')
                                                .select('seller_id')
                                                .eq('campaign_id', mirrorCampaignId)
                                                .eq('email', leadEmail)
                                                .limit(1);
                                            if (leads && leads.length > 0) {
                                                sourceLead = leads[0];
                                                console.log(`   📧 Encontrado por email: seller_id=${sourceLead.seller_id}`);
                                            }
                                        }

                                        // Se encontrou vendedora, usar ela
                                        if (sourceLead && sourceLead.seller_id) {
                                            mirroredSellerId = sourceLead.seller_id;
                                            console.log(`   ✅ Vendedora espelhada: ID ${mirroredSellerId}`);
                                        } else {
                                            console.log(`   ⚠️ Lead não encontrado na campanha de origem ou sem vendedora`);
                                        }
                                    } else {
                                        console.log(`   ❌ Falha na comparação de IDs de campanha`);
                                    }
                                } else {
                                    console.log(`❌ Debug Mirror Update: Campanha destino não encontrada ou sem espelhamento configurado`);
                                }
                            } catch (e) {
                                console.error('Erro check espelhamento update:', e);
                            }
                        }

                        // Prioridade de atribuição de vendedora:
                        // 1. Espelhamento (prioridade máxima - mantém consistência entre campanhas)
                        // 2. Vendedor explicitamente selecionado (permite reatribuição manual)
                        // 3. Vendedor existente (fallback)
                        if (mirroredSellerId) {
                            // Espelhamento tem prioridade: usar vendedora encontrada na campanha de origem
                            updateSellerId = mirroredSellerId;
                            console.log(`   🪞 Usando vendedora espelhada: ID ${mirroredSellerId}`);
                        } else if (seller_id && !distribute) {
                            // Se vendedor foi especificado explicitamente, usar ele (permite reatribuição)
                            updateSellerId = seller_id;
                            console.log(`   👤 Reatribuindo para vendedor selecionado: ID ${seller_id}`);
                        }
                        // Caso contrário, mantém existing.seller_id

                        // Ao reatribuir: atualizar APENAS o vendedor, manter todos os outros dados
                        const updateData = {
                            seller_id: updateSellerId
                        };

                        // Só atualizar campaign_id e subcampaign_id se foram explicitamente fornecidos
                        if (campaign_id && campaign_id !== existing.campaign_id) {
                            updateData.campaign_id = campaign_id;
                        }
                        if (subcampaign_id) {
                            updateData.subcampaign_id = subcampaign_id;
                        }

                        // Preservar in_group conforme configuração
                        if (!preserve_in_group) {
                            updateData.in_group = in_group;
                        }

                        // Se selecionou subcampanha, salvar valores antigos (se existem) e limpar
                        if (subcampaign_id) {
                            // Só salva previous se tem valor atual e não tinha previous ainda
                            if (existing.status_id && !existing.previous_status_id) {
                                updateData.previous_status_id = existing.status_id;
                            }
                            if (existing.checking && !existing.previous_checking) {
                                updateData.previous_checking = existing.checking;
                            }
                            // Sempre limpa status e checking
                            updateData.status_id = null;
                            updateData.checking = false;
                            console.log(`   ↳ Salvando previous: status=${existing.status_id}, checking=${existing.checking}`);
                        }

                        // LOG DE ESPELHAMENTO NA OBSERVAÇÃO
                        if (isMirrored && mirroredSellerId) {
                            const dateStr = new Date().toLocaleString('pt-BR');
                            const oldObs = existing.observations || existing.notes || '';
                            updateData.observations = `${oldObs}\n[${dateStr}] 🪞 Espelhamento: Vendedora copiada da campanha ${mirrorCampaignId} (ID: ${mirroredSellerId}).`;
                        }

                        console.log(`📝 Dados que serão atualizados:`, JSON.stringify(updateData, null, 2));
                        console.log(`📝 Lead ID: ${existing.id}, Vendedor atual: ${existing.seller_id}, Novo vendedor: ${updateData.seller_id}`);

                        await db.updateLeadById(existing.id, updateData);
                        console.log(`✅ Lead ${existing.id} atualizado com sucesso!`);
                        updated++;
                        continue; // Importante: pular para o próximo lead
                    } else {
                        // update_existing = false: não atualizar, pular este lead
                        console.log(`⏭️ Pulando lead existente (update_existing=false): ${leadNome}`);
                        skipped++;
                        continue;
                    }
                }

                // Determinar vendedora
                let assignedSellerId = seller_id || null;
                let mirroredLog = null;

                // --- LÓGICA DE ESPELHAMENTO DE VENDEDORA ---
                // Verifica mesmo se já tiver seller definido, pois o espelhamento tem prioridade
                if (campaign_id) {
                    try {
                        // 1. Verificar se a campanha tem espelhamento configurado
                        const campaign = await db.getCampaignById(campaign_id);
                        if (campaign && campaign.mirror_campaign_id) {
                            console.log(`   🪞 Campanha ${campaign.id} espelha ${campaign.mirror_campaign_id}. Verificando lead...`);

                            // 2. Buscar lead na campanha espelhada (pelo telefone ou email)
                            let sourceLead = null;
                            if (leadPhone) {
                                // Tentar buscar pelo final do telefone para garantir match
                                const phoneEnd = leadPhone.slice(-8);
                                const { data: leads } = await supabase
                                    .from('leads')
                                    .select('seller_id')
                                    .eq('campaign_id', campaign.mirror_campaign_id)
                                    .ilike('phone', `%${phoneEnd}`)
                                    .limit(1);
                                if (leads && leads.length > 0) sourceLead = leads[0];
                            }

                            if (!sourceLead && leadEmail) {
                                const { data: leads } = await supabase
                                    .from('leads')
                                    .select('seller_id')
                                    .eq('campaign_id', campaign.mirror_campaign_id)
                                    .eq('email', leadEmail)
                                    .limit(1);
                                if (leads && leads.length > 0) sourceLead = leads[0];
                            }

                            // 3. Se encontrou e tem vendedora, usar a mesma
                            if (sourceLead && sourceLead.seller_id) {
                                assignedSellerId = sourceLead.seller_id;
                                mirroredLog = `[${new Date().toLocaleString('pt-BR')}] 🪞 Espelhamento: Vendedora copiada da campanha anterior.`;
                                console.log(`   ✅ Vendedora espelhada encontrada: ID ${assignedSellerId}`);
                            } else {
                                console.log(`   ⚠️ Lead não encontrado na campanha de origem ou sem vendedora.`);
                            }
                        }
                    } catch (mirrorErr) {
                        console.error('   ❌ Erro na lógica de espelhamento:', mirrorErr);
                    }
                }
                // -------------------------------------------

                if (!assignedSellerId && distribute && sellers.length > 0) {
                    assignedSellerId = sellers[sellerIndex % sellers.length].id;
                    sellerIndex++;
                }

                console.log(`✅ Criando lead: ${leadNome} - ${leadEmail} - ${leadPhone}`);

                // Montar observações
                let obs = lead.observacoes || lead.observations || null;
                if (mirroredLog) {
                    obs = obs ? `${obs}\n${mirroredLog}` : mirroredLog;
                }

                const newLead = await db.createLead({
                    uuid: uuidv4(),
                    first_name: leadNome || 'Sem nome',
                    email: leadEmail,
                    phone: leadPhone,
                    product_name: leadProduto,
                    seller_id: assignedSellerId,
                    status_id: leadStatusId || null,
                    source: 'import',
                    campaign_id,
                    subcampaign_id,
                    in_group,
                    import_batch_id: batch.id,
                    observations: obs
                });
                console.log(`   ↳ Lead criado: id=${newLead?.id || 'N/A'}`);
                imported++;
            } catch (err) {
                console.error('❌ Error importing lead:', err.message || err);
                skipped++;
            }
        }

        // Atualizar estatísticas do batch
        await db.updateImportBatch(batch.id, {
            total_imported: imported,
            total_skipped: skipped,
            total_updated: updated
        });

        res.json({
            message: 'Importação concluída',
            imported,
            updated,
            skipped,
            total: leadsToImport.length,
            batch_uuid: batch.uuid
        });
    } catch (error) {
        console.error('Error importing leads:', error);
        res.status(500).json({ error: 'Erro ao importar leads' });
    }
});

/**
 * Parser CSV
 */
function parseCSV(csvString) {
    const lines = csvString.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    const delimiter = lines[0].includes(';') ? ';' : ',';
    const headers = parseCSVLine(lines[0], delimiter).map(h => h.trim().toLowerCase());

    const headerMap = {
        'nome': 'nome', 'name': 'nome', 'first_name': 'nome',
        'email': 'email', 'e-mail': 'email',
        'telefone': 'telefone', 'phone': 'telefone', 'phone_number': 'telefone', 'whatsapp': 'telefone', 'celular': 'telefone',
        'produto': 'produto', 'product': 'produto', 'product_name': 'produto'
    };

    const leads = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i], delimiter);
        if (values.length === 0) continue;

        const lead = {};
        headers.forEach((header, index) => {
            const mappedHeader = headerMap[header] || header;
            lead[mappedHeader] = values[index] || '';
        });

        if (lead.nome || lead.email) {
            leads.push(lead);
        }
    }

    return leads;
}

function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());

    return result;
}

// ==========================================
// WAPPI SETTINGS ENDPOINTS
// ==========================================

// Get Wappi Settings
router.get('/wappi', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('wappi_settings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Se der erro de não encontrar (PGRST116), retornar vazio
        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json(data || {});
    } catch (error) {
        console.error('Erro ao buscar wappi settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Save Wappi Settings
router.post('/wappi', async (req, res) => {
    const { api_token, profile_id } = req.body;

    if (!api_token || !profile_id) {
        return res.status(400).json({ error: 'API Token and Profile ID are required' });
    }

    try {
        // Clear old settings to keep only one active
        // Usar um ID fixo ou deletar tudo antes de inserir seria mais limpo para config única
        await supabase.from('wappi_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const { data, error } = await supabase
            .from('wappi_settings')
            .insert({ api_token, profile_id })
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Erro ao salvar wappi settings:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
