/**
 * Leads Routes - Supabase Version
 */

import { Router } from 'express';
import { db, supabase } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/leads
 */
router.get('/', async (req, res) => {
    try {
        const { status, search, search_observation, campaign_id, subcampaign_id, in_group, show_inactive, seller_id, page = 1, limit = 50 } = req.query;

        // Lógica de filtro de vendedor:
        // - Admin: vê todos, pode filtrar por seller_id
        // - Vendedora: vê só seus leads por padrão
        // - Vendedora com pesquisa: vê todos (pesquisa geral)
        let effectiveSellerId = null;

        if (req.user.role === 'seller') {
            // Se está pesquisando, mostra todos os leads (pesquisa geral)
            // Caso contrário, mostra apenas os leads da vendedora
            if (!search && !search_observation) {
                effectiveSellerId = req.user.id;
            }
            // Se pesquisar, effectiveSellerId fica null = mostra todos
        } else if (seller_id) {
            // Admin pode filtrar por vendedor
            // Preservar 'null' como string para filtrar leads sem vendedora
            effectiveSellerId = seller_id === 'null' ? 'null' : parseInt(seller_id);
        }

        const filters = {
            status,
            search,
            search_observation,
            campaign_id,
            subcampaign_id,
            in_group,
            show_inactive: show_inactive === 'true',
            seller_id: effectiveSellerId,
            page: parseInt(page),
            limit: parseInt(limit)
        };

        const { leads, total } = await db.getLeads(filters);

        res.json({
            leads,
            pagination: {
                page: filters.page,
                limit: filters.limit,
                total,
                pages: Math.ceil(total / filters.limit)
            }
        });
    } catch (error) {
        console.error('Error fetching leads:', error);
        res.status(500).json({ error: 'Erro ao buscar leads' });
    }
});

/**
 * GET /api/leads/all-uuids
 */
router.get('/all-uuids', authenticate, async (req, res) => {
    try {
        const { status, search, campaign_id, in_group, show_inactive, seller_id } = req.query;

        let effectiveSellerId = null;

        if (req.user.role === 'seller') {
            // Se está pesquisando, mostra todos (igual ao getLeads)
            // Caso contrário, confina ao usuário
            if (!search) {
                effectiveSellerId = req.user.id;
            }
        } else if (seller_id) {
            effectiveSellerId = seller_id === 'null' ? 'null' : parseInt(seller_id);
        }

        const uuids = await db.getAllLeadUuids({
            status,
            search,
            campaign_id,
            in_group,
            show_inactive,
            seller_id: effectiveSellerId
        });
        res.json({ uuids, total: uuids.length });
    } catch (error) {
        console.error('Error fetching all uuids:', error);
        res.status(500).json({ error: 'Erro ao buscar UUIDs' });
    }
});

/**
 * POST /api/leads/by-uuids
 * Busca múltiplos leads pelos UUIDs (para exportação)
 */
router.post('/by-uuids', async (req, res) => {
    try {
        const { uuids } = req.body;

        if (!Array.isArray(uuids) || uuids.length === 0) {
            return res.status(400).json({ error: 'uuids deve ser um array não vazio' });
        }

        // Buscar leads do Supabase em lotes para evitar erro de URL muito longa
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < uuids.length; i += CHUNK_SIZE) {
            chunks.push(uuids.slice(i, i + CHUNK_SIZE));
        }

        let allLeads = [];

        // Processar lotes em paralelo (ou serial, mas Promise.all é mais rápido)
        const responses = await Promise.all(chunks.map(chunk =>
            supabase
                .from('leads')
                .select(`
                    *,
                    seller:users!seller_id(id, name),
                    campaign:campaigns(id, name),
                    subcampaign:subcampaigns(id, name, color),
                    status:lead_statuses!status_id(id, name, color)
                `)
                .in('uuid', chunk)
        ));

        // Verificar erros e combinar resultados
        for (const response of responses) {
            if (response.error) throw response.error;
            if (response.data) {
                allLeads = allLeads.concat(response.data);
            }
        }

        const data = allLeads;

        // Formatar dados
        const leads = data.map(lead => ({
            ...lead,
            seller_name: lead.seller?.name || null,
            campaign_name: lead.campaign?.name || null,
            subcampaign_name: lead.subcampaign?.name || null,
            subcampaign_color: lead.subcampaign?.color || null,
            status_name: lead.status?.name || null,
            status_color: lead.status?.color || null
        }));

        // Verificar permissões (vendedoras só veem seus próprios leads)
        const filteredLeads = req.user.role === 'seller'
            ? leads.filter(l => l.seller_id === req.user.id)
            : leads;

        res.json({ leads: filteredLeads });
    } catch (error) {
        console.error('Error fetching leads by UUIDs:', error);
        res.status(500).json({ error: 'Erro ao buscar leads' });
    }
});

/**
 * PATCH /api/leads/bulk/reassign (Admin only)
 */
router.patch('/bulk/reassign', authorize('admin'), async (req, res) => {
    try {
        const { lead_uuids, seller_id } = req.body;

        if (!Array.isArray(lead_uuids) || lead_uuids.length === 0) {
            return res.status(400).json({ error: 'lead_uuids deve ser um array' });
        }

        if (seller_id) {
            const seller = await db.getUserById(seller_id);
            if (!seller || seller.role !== 'seller' || !seller.is_active) {
                return res.status(400).json({ error: 'Vendedora não encontrada ou inativa' });
            }
        }

        for (const uuid of lead_uuids) {
            await db.updateLead(uuid, { seller_id: seller_id || null });
        }

        res.json({ message: `${lead_uuids.length} leads reatribuídos` });
    } catch (error) {
        console.error('Error bulk reassigning:', error);
        res.status(500).json({ error: 'Erro ao reatribuir' });
    }
});

/**
 * GET /api/leads/statuses
 */
router.get('/statuses', async (req, res) => {
    try {
        const statuses = await db.getStatuses();
        res.json({ statuses });
    } catch (error) {
        console.error('Error fetching statuses:', error);
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

/**
 * GET /api/leads/checking-logs (Admin only)
 * Retorna os últimos 10 leads que foram marcados como checking
 */
router.get('/checking-logs', authorize('admin'), async (req, res) => {
    try {
        const logs = await db.getRecentCheckings(10);
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching checking logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs de checking' });
    }
});

/**
 * GET /api/leads/greatpages-logs (Admin only)
 * Retorna os últimos 10 leads recebidos do GreatPages
 */
router.get('/greatpages-logs', authorize('admin'), async (req, res) => {
    try {
        const logs = await db.getRecentGreatPages(10);
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching GreatPages logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs do GreatPages' });
    }
});

/**
 * GET /api/leads/:uuid
 */
router.get('/:uuid', async (req, res) => {
    try {
        const lead = await db.getLeadByUuid(req.params.uuid);

        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para ver este lead' });
        }

        res.json({ lead });
    } catch (error) {
        console.error('Error fetching lead:', error);
        res.status(500).json({ error: 'Erro ao buscar lead' });
    }
});

/**
 * PATCH /api/leads/:uuid/status
 */
router.patch('/:uuid/status', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { status_id } = req.body;

        // status_id pode ser null para limpar o status

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para atualizar este lead' });
        }

        await db.updateLead(uuid, { status_id: status_id || null });
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Error updating lead status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});


/**
 * PATCH /api/leads/:uuid/details
 * Update lead contact details (name, email, phone)
 */
router.patch('/:uuid/details', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { first_name, email, phone } = req.body;

        // Validate at least one field is provided
        if (!first_name && !email && !phone) {
            return res.status(400).json({ error: 'Pelo menos um campo deve ser fornecido' });
        }

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        // Permission check: sellers can only edit their own leads
        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para atualizar este lead' });
        }

        // Validate email format if provided
        if (email !== undefined && email !== null && email.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                return res.status(400).json({ error: 'Formato de email inválido' });
            }
        }

        // Build update object with only provided fields
        const updateData = {};
        if (first_name !== undefined) updateData.first_name = first_name?.trim() || null;
        if (email !== undefined) updateData.email = email?.trim()?.toLowerCase() || null;
        if (phone !== undefined) updateData.phone = phone?.trim() || null;

        await db.updateLead(uuid, updateData);

        // Return updated lead
        const updatedLead = await db.getLeadByUuid(uuid);
        res.json({
            message: 'Lead atualizado com sucesso',
            lead: updatedLead
        });
    } catch (error) {
        console.error('Error updating lead details:', error);
        res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
});

/**
 * PATCH /api/leads/:uuid/observation
 */
router.patch('/:uuid/observation', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { observation } = req.body;

        if (!observation || !observation.trim()) {
            return res.status(400).json({ error: 'Observação é obrigatória' });
        }

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para atualizar este lead' });
        }

        const timestamp = new Date().toLocaleString('pt-BR');
        const newObservation = `[${timestamp} - ${req.user.name}]: ${observation.trim()}`;
        const updatedObservations = lead.observations
            ? `${lead.observations}\n\n${newObservation}`
            : newObservation;

        await db.updateLead(uuid, { observations: updatedObservations });
        res.json({ message: 'Observação adicionada com sucesso', observations: updatedObservations });
    } catch (error) {
        console.error('Error adding observation:', error);
        res.status(500).json({ error: 'Erro ao adicionar observação' });
    }
});

/**
 * PATCH /api/leads/:uuid/reassign (Admin only)
 */
router.patch('/:uuid/reassign', authorize('admin'), async (req, res) => {
    try {
        const { uuid } = req.params;
        const { seller_id } = req.body;

        if (seller_id) {
            const seller = await db.getUserById(seller_id);
            if (!seller || seller.role !== 'seller' || !seller.is_active) {
                return res.status(400).json({ error: 'Vendedora não encontrada ou inativa' });
            }
        }

        await db.updateLead(uuid, { seller_id: seller_id || null });
        res.json({ message: 'Lead reatribuído com sucesso' });
    } catch (error) {
        console.error('Error reassigning lead:', error);
        res.status(500).json({ error: 'Erro ao reatribuir lead' });
    }
});

/**
 * PATCH /api/leads/:uuid/self-assign
 * Allows sellers to assign unassigned leads to themselves
 */
router.patch('/:uuid/self-assign', async (req, res) => {
    try {
        const { uuid } = req.params;

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        // Only allow if lead is currently unassigned
        if (lead.seller_id !== null) {
            return res.status(400).json({ error: 'Lead já está atribuído' });
        }

        // Assign to current user (seller)
        await db.updateLead(uuid, { seller_id: req.user.id });
        res.json({ message: 'Lead atribuído com sucesso' });
    } catch (error) {
        console.error('Error self-assigning lead:', error);
        res.status(500).json({ error: 'Erro ao atribuir lead' });
    }
});

/**
 * PATCH /api/leads/:uuid/in-group
 */
router.patch('/:uuid/in-group', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { in_group } = req.body;

        if (typeof in_group !== 'boolean') {
            return res.status(400).json({ error: 'in_group deve ser boolean' });
        }

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        // Atualizar in_group na tabela lead_campaign_groups (específico por campanha)
        if (lead.campaign_id) {
            await db.setLeadCampaignGroup(lead.id, lead.campaign_id, in_group);
            console.log(`✅ In-group atualizado: Lead ${lead.id}, Campanha ${lead.campaign_id}, in_group=${in_group}`);
        } else {
            // Fallback: se não tem campanha, atualizar o campo global (compatibilidade)
            await db.updateLead(uuid, { in_group });
            console.log(`⚠️ In-group atualizado (global): Lead ${lead.id}, in_group=${in_group}`);
        }

        res.json({ message: 'Marcação atualizada' });
    } catch (error) {
        console.error('Error updating in_group:', error);
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

/**
 * PATCH /api/leads/:uuid/checking
 */
router.patch('/:uuid/checking', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { checking } = req.body;

        if (typeof checking !== 'boolean') {
            return res.status(400).json({ error: 'checking deve ser boolean' });
        }

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        await db.updateLead(uuid, { checking });
        res.json({ message: 'Checking atualizado' });
    } catch (error) {
        console.error('Error updating checking:', error);
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

/**
 * PATCH /api/leads/:uuid/sale-completed
 */
router.patch('/:uuid/sale-completed', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { sale_completed } = req.body;

        if (typeof sale_completed !== 'boolean') {
            return res.status(400).json({ error: 'sale_completed deve ser boolean' });
        }

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        await db.updateLead(uuid, { sale_completed });
        res.json({ message: 'Venda atualizada' });
    } catch (error) {
        console.error('Error updating sale_completed:', error);
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

/**
 * PATCH /api/leads/bulk/in-group (Admin only)
 */
router.patch('/bulk/in-group', authorize('admin'), async (req, res) => {
    try {
        const { lead_uuids, in_group } = req.body;

        if (!Array.isArray(lead_uuids) || lead_uuids.length === 0) {
            return res.status(400).json({ error: 'lead_uuids deve ser um array' });
        }

        for (const uuid of lead_uuids) {
            await db.updateLead(uuid, { in_group: in_group ? true : false });
        }

        res.json({ message: `${lead_uuids.length} leads atualizados` });
    } catch (error) {
        console.error('Error bulk updating:', error);
        res.status(500).json({ error: 'Erro ao atualizar' });
    }
});

/**
 * POST /api/leads/import-checking (Admin only)
 * Importa CSV do Google Forms para atualizar checking
 */
router.post('/import-checking', authorize('admin'), async (req, res) => {
    try {
        const { csvData } = req.body; // Recebe o conteúdo do CSV como string

        if (!csvData) {
            return res.status(400).json({ error: 'Dados CSV não fornecidos' });
        }

        const rows = csvData.split('\n').map(row => row.split(',')); // Parser simples (pode precisar de algo mais robusto se tiver vírgulas nos campos)
        // OBS: Se o CSV vier do Excel/Google Sheets, pode separar por ponto e vírgula dependendo da locale, ou vírgula.
        // Vamos tentar detectar ou assumir vírgula por enquanto, o frontend pode tratar isso.

        let updatedCount = 0;
        let notFoundCount = 0;
        let errors = [];

        // Ignora cabeçalho (começa do índice 1 se tiver cabeçalho)
        // O user disse que é do Google Forms, então tem cabeçalho.
        // As colunas são fixas: 
        // Col 2 (Index 1): Email
        // Col 5 (Index 4): WhatsApp

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length < 5) continue; // Linha inválida ou vazia

            // Limpar aspas se houver
            const cleanCell = (cell) => cell ? cell.replace(/^"|"$/g, '').trim() : '';

            const email = cleanCell(row[1]).toLowerCase();
            const phoneRaw = cleanCell(row[4]);

            if (!email && !phoneRaw) continue;

            try {
                let lead = null;

                // 1. Tentar por Email
                if (email) {
                    lead = await db.getLeadByEmail(email);
                }

                // 2. Tentar por Telefone se não achou
                if (!lead && phoneRaw) {
                    const cleanPhone = phoneRaw.replace(/\D/g, '');
                    if (cleanPhone.length >= 8) {
                        const phoneEnd = cleanPhone.slice(-8);
                        lead = await db.getLeadByPhone(phoneEnd);
                    }
                }

                if (lead) {
                    const obs = `[AUTO] Checking importado via CSV em ${new Date().toLocaleString('pt-BR')}`;
                    const newObs = lead.observations ? `${lead.observations}\n${obs}` : obs;

                    await db.updateLeadById(lead.id, {
                        checking: true,
                        observations: newObs
                    });
                    updatedCount++;
                } else {
                    notFoundCount++;
                }
            } catch (err) {
                console.error(`Erro na linha ${i + 1}:`, err);
                errors.push(`Linha ${i + 1}: ${err.message}`);
            }
        }

        res.json({
            message: 'Importação concluída',
            stats: {
                updated: updatedCount,
                notFound: notFoundCount,
                total: rows.length - 1
            },
            errors
        });

    } catch (error) {
        console.error('Error importing checking CSV:', error);
        res.status(500).json({ error: 'Erro ao importar CSV' });
    }
});



/**
 * DELETE /api/leads/bulk (Admin only)
 */
router.delete('/bulk', authorize('admin'), async (req, res) => {
    try {
        const { lead_uuids } = req.body;

        if (!Array.isArray(lead_uuids) || lead_uuids.length === 0) {
            return res.status(400).json({ error: 'lead_uuids deve ser um array' });
        }

        for (const uuid of lead_uuids) {
            await db.deleteLead(uuid);
        }

        res.json({ message: `${lead_uuids.length} leads deletados`, deleted: lead_uuids.length });
    } catch (error) {
        console.error('Error bulk deleting:', error);
        res.status(500).json({ error: 'Erro ao deletar' });
    }
});

/**
 * DELETE /api/leads/:uuid (Admin only)
 */
router.delete('/:uuid', authorize('admin'), async (req, res) => {
    try {
        const result = await db.deleteLead(req.params.uuid);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }
        res.json({ message: 'Lead deletado' });
    } catch (error) {
        console.error('Error deleting lead:', error);
        res.status(500).json({ error: 'Erro ao deletar lead' });
    }
});

export default router;
