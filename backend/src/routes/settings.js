/**
 * Settings Routes - Supabase Version
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/supabase.js';
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
                require_token: false
            });
        }

        res.json({
            webhook_url: `/api/webhook/hotmart`,
            webhook_token: settings.webhook_token,
            webhook_enabled: settings.webhook_enabled,
            require_token: settings.require_token
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
        const { webhook_enabled, require_token, regenerate_token } = req.body;

        const updateData = {};
        if (typeof webhook_enabled === 'boolean') updateData.webhook_enabled = webhook_enabled;
        if (typeof require_token === 'boolean') updateData.require_token = require_token;
        if (regenerate_token) updateData.webhook_token = uuidv4();

        if (Object.keys(updateData).length > 0) {
            await db.upsertApiSettings(updateData);
        }

        res.json({ message: 'Configurações atualizadas' });
    } catch (error) {
        console.error('Error updating API settings:', error);
        res.status(500).json({ error: 'Erro ao atualizar configurações' });
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

        const filters = {
            seller_id: seller_id || null,
            campaign_id: campaign_id || null,
            show_inactive: true,
            page: 1,
            limit: 10000
        };

        const { leads } = await db.getLeads(filters);

        const exportData = leads.map(l => ({
            nome: l.first_name,
            email: l.email,
            telefone: l.phone,
            produto: l.product_name,
            campanha: l.campaign_name,
            data_entrada: l.created_at,
            status: l.status_name,
            vendedora: l.seller_name,
            observacoes: l.observations
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
            in_group = true,
            preserve_in_group = false,
            update_existing = true,
            batch_name = null
        } = req.body;

        console.log('📥 Import data:', { hasLeads: !!leads, hasCSV: !!csv, distribute, campaign_id, subcampaign_id });

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

        for (const lead of leadsToImport) {
            try {
                const leadEmail = (lead.email || lead.Email || '').trim().toLowerCase();
                const leadPhone = (lead.telefone || lead.phone || lead.phone_number || lead.Telefone || lead.WhatsApp || lead.whatsapp || '').replace(/\D/g, '');
                const leadNome = lead.nome || lead.first_name || lead.name || lead.Nome || '';
                const leadProduto = lead.produto || lead.product_name || lead.product || lead.Produto || '';

                console.log(`📋 Processando lead: nome="${leadNome}", email="${leadEmail}", phone="${leadPhone}"`);

                // Verificar se já existe - SIMPLIFICADO
                let existing = null;

                if (leadEmail && leadEmail.length > 5 && leadEmail.includes('@')) {
                    existing = await db.getLeadByEmail(leadEmail);
                    if (existing) console.log(`   ↳ Encontrado por email: id=${existing.id}`);
                }

                if (!existing && leadPhone && leadPhone.length >= 10) {
                    const phoneEnd = leadPhone.slice(-8);
                    existing = await db.getLeadByPhone(phoneEnd);
                    if (existing) console.log(`   ↳ Encontrado por phone: id=${existing.id}`);
                }

                if (existing) {
                    console.log(`⚠️ Lead existe - Email: ${leadEmail}, Phone: ${leadPhone}, ExistingID: ${existing.id}`);
                    if (update_existing) {
                        // Determinar vendedora para atualização
                        let updateSellerId = seller_id || null;
                        if (distribute && sellers.length > 0) {
                            updateSellerId = sellers[sellerIndex % sellers.length].id;
                            sellerIndex++;
                        }



                        // Se está adicionando subcampanha, salvar status e checking antigos e limpar
                        // Só atualiza campos se vieram preenchidos na importação
                        const updateData = {
                            first_name: leadNome ? leadNome : existing.first_name || 'Sem nome',
                            email: leadEmail ? leadEmail : existing.email || '',
                            phone: leadPhone ? leadPhone : existing.phone || '',
                            product_name: leadProduto ? leadProduto : existing.product_name || '',
                            in_group: preserve_in_group ? existing.in_group : in_group,
                            campaign_id: campaign_id || existing.campaign_id,
                            subcampaign_id: subcampaign_id || existing.subcampaign_id,
                            seller_id: updateSellerId || existing.seller_id
                        };

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

                        await db.updateLeadById(existing.id, updateData);
                        updated++;
                    } else {
                        skipped++;
                    }
                    continue;
                }

                // Determinar vendedora
                let assignedSellerId = seller_id || null;

                if (distribute && sellers.length > 0) {
                    assignedSellerId = sellers[sellerIndex % sellers.length].id;
                    sellerIndex++;
                }

                console.log(`✅ Criando lead: ${leadNome} - ${leadEmail} - ${leadPhone}`);
                const newLead = await db.createLead({
                    uuid: uuidv4(),
                    first_name: leadNome || 'Sem nome',
                    email: leadEmail,
                    phone: leadPhone,
                    product_name: leadProduto,
                    seller_id: assignedSellerId,
                    status_id: null,
                    source: 'import',
                    campaign_id,
                    subcampaign_id,
                    in_group,
                    import_batch_id: batch.id
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

export default router;
