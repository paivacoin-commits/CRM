/**
 * Subcampaigns Routes
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/subcampaigns - Lista todas as subcampanhas (ou filtradas por campanha)
 */
router.get('/', async (req, res) => {
    try {
        const { campaign_id, active_only } = req.query;
        const subcampaigns = await db.getSubcampaigns({
            campaign_id: campaign_id ? parseInt(campaign_id) : null,
            active_only: active_only === 'true'
        });
        res.json({ subcampaigns });
    } catch (error) {
        console.error('Error fetching subcampaigns:', error);
        res.status(500).json({ error: 'Erro ao buscar subcampanhas' });
    }
});

/**
 * GET /api/subcampaigns/:uuid - Busca uma subcampanha
 */
router.get('/:uuid', async (req, res) => {
    try {
        const subcampaign = await db.getSubcampaignByUuid(req.params.uuid);
        if (!subcampaign) {
            return res.status(404).json({ error: 'Subcampanha não encontrada' });
        }
        res.json({ subcampaign });
    } catch (error) {
        console.error('Error fetching subcampaign:', error);
        res.status(500).json({ error: 'Erro ao buscar subcampanha' });
    }
});

/**
 * POST /api/subcampaigns - Cria subcampanha (apenas admin)
 */
router.post('/', authorize('admin'), async (req, res) => {
    try {
        const { campaign_id, name, color, description } = req.body;

        if (!campaign_id || !name) {
            return res.status(400).json({ error: 'Campanha e nome são obrigatórios' });
        }

        const subcampaign = await db.createSubcampaign({
            uuid: uuidv4(),
            campaign_id,
            name,
            color: color || '#6366f1',
            description: description || null,
            is_active: true
        });

        res.json({ message: 'Subcampanha criada', subcampaign });
    } catch (error) {
        console.error('Error creating subcampaign:', error);
        res.status(500).json({ error: 'Erro ao criar subcampanha' });
    }
});

/**
 * PATCH /api/subcampaigns/:uuid - Atualiza subcampanha (apenas admin)
 */
router.patch('/:uuid', authorize('admin'), async (req, res) => {
    try {
        const { uuid } = req.params;
        const { name, color, description, is_active } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (color !== undefined) updateData.color = color;
        if (description !== undefined) updateData.description = description;
        if (typeof is_active === 'boolean') updateData.is_active = is_active;

        await db.updateSubcampaign(uuid, updateData);
        res.json({ message: 'Subcampanha atualizada' });
    } catch (error) {
        console.error('Error updating subcampaign:', error);
        res.status(500).json({ error: 'Erro ao atualizar subcampanha' });
    }
});

/**
 * DELETE /api/subcampaigns/:uuid - Deleta subcampanha (apenas admin)
 * Restaura status_id e checking antigos dos leads
 */
router.delete('/:uuid', authorize('admin'), async (req, res) => {
    try {
        const subcampaign = await db.getSubcampaignByUuid(req.params.uuid);
        if (!subcampaign) {
            return res.status(404).json({ error: 'Subcampanha não encontrada' });
        }

        // Restaurar status e checking dos leads que pertencem a esta subcampanha
        await db.restoreLeadsFromSubcampaign(subcampaign.id);

        // Deletar a subcampanha
        await db.deleteSubcampaign(req.params.uuid);
        res.json({ message: 'Subcampanha deletada e leads restaurados' });
    } catch (error) {
        console.error('Error deleting subcampaign:', error);
        res.status(500).json({ error: 'Erro ao deletar subcampanha' });
    }
});

export default router;
