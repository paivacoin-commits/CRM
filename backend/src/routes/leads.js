/**
 * Leads Routes - Supabase Version
 */

import { Router } from 'express';
import { db } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/leads
 */
router.get('/', async (req, res) => {
    try {
        const { status, search, campaign_id, in_group, show_inactive, seller_id, page = 1, limit = 50 } = req.query;

        // Para vendedores, força o seller_id para o próprio ID
        // Para admins, usa o seller_id do query param (se fornecido)
        let effectiveSellerId = null;
        if (req.user.role === 'seller') {
            effectiveSellerId = req.user.id;
        } else if (seller_id) {
            effectiveSellerId = parseInt(seller_id);
        }

        const filters = {
            status,
            search,
            campaign_id,
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
router.get('/all-uuids', authorize('admin'), async (req, res) => {
    try {
        const { status, search, campaign_id, in_group, show_inactive } = req.query;
        const uuids = await db.getAllLeadUuids({ status, search, campaign_id, in_group, show_inactive });
        res.json({ uuids, total: uuids.length });
    } catch (error) {
        console.error('Error fetching all uuids:', error);
        res.status(500).json({ error: 'Erro ao buscar UUIDs' });
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

        if (!status_id) {
            return res.status(400).json({ error: 'Status é obrigatório' });
        }

        const lead = await db.getLeadByUuid(uuid);
        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        if (req.user.role === 'seller' && lead.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para atualizar este lead' });
        }

        await db.updateLead(uuid, { status_id });
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Error updating lead status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
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

        await db.updateLead(uuid, { in_group });
        res.json({ message: 'Marcação atualizada' });
    } catch (error) {
        console.error('Error updating in_group:', error);
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
