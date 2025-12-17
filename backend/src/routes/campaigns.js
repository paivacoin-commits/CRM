/**
 * Campaigns Routes - Supabase Version
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/campaigns - Disponível para todos usuários autenticados
 */
router.get('/', async (req, res) => {
    try {
        const { active_only } = req.query;
        const campaigns = await db.getCampaigns({ active_only: active_only === 'true' });
        res.json({ campaigns });
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ error: 'Erro ao buscar campanhas' });
    }
});

/**
 * POST /api/campaigns - Apenas admin
 */
router.post('/', authorize('admin'), async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome é obrigatório' });
        }

        const campaign = await db.createCampaign({
            uuid: uuidv4(),
            name,
            description: description || null,
            is_active: true
        });

        res.json({ message: 'Campanha criada', campaign });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ error: 'Erro ao criar campanha' });
    }
});

/**
 * PATCH /api/campaigns/:uuid - Apenas admin
 */
router.patch('/:uuid', authorize('admin'), async (req, res) => {
    try {
        const { uuid } = req.params;
        const { name, description, is_active } = req.body;

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (typeof is_active === 'boolean') updateData.is_active = is_active;

        await db.updateCampaign(uuid, updateData);
        res.json({ message: 'Campanha atualizada' });
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ error: 'Erro ao atualizar campanha' });
    }
});

/**
 * POST /api/campaigns/:uuid/activate - Apenas admin
 */
router.post('/:uuid/activate', authorize('admin'), async (req, res) => {
    try {
        const { uuid } = req.params;

        // Desativar todas as outras campanhas
        await db.deactivateAllCampaigns();

        // Ativar a campanha selecionada
        await db.updateCampaign(uuid, { is_active: true });

        res.json({ message: 'Campanha ativada' });
    } catch (error) {
        console.error('Error activating campaign:', error);
        res.status(500).json({ error: 'Erro ao ativar campanha' });
    }
});

/**
 * DELETE /api/campaigns/:uuid - Apenas admin
 */
router.delete('/:uuid', authorize('admin'), async (req, res) => {
    try {
        await db.deleteCampaign(req.params.uuid);
        res.json({ message: 'Campanha deletada' });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ error: 'Erro ao deletar campanha' });
    }
});

export default router;
