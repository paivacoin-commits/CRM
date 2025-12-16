/**
 * Statuses Routes - Supabase Version
 */

import { Router } from 'express';
import { db } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/statuses
 */
router.get('/', async (req, res) => {
    try {
        const statuses = await db.getStatuses();
        res.json({ statuses });
    } catch (error) {
        console.error('Error fetching statuses:', error);
        res.status(500).json({ error: 'Erro ao buscar status' });
    }
});

/**
 * POST /api/statuses (Admin only)
 */
router.post('/', authorize('admin'), async (req, res) => {
    try {
        const { name, color, is_conversion = false } = req.body;

        if (!name || !color) {
            return res.status(400).json({ error: 'Nome e cor são obrigatórios' });
        }

        const existing = await db.getStatusByName(name);
        if (existing) {
            return res.status(400).json({ error: 'Já existe um status com este nome' });
        }

        const maxOrder = await db.getMaxStatusOrder();

        const status = await db.createStatus({
            name,
            color,
            is_conversion,
            is_system: false,
            display_order: maxOrder + 1
        });

        res.json({ message: 'Status criado com sucesso', status });
    } catch (error) {
        console.error('Error creating status:', error);
        res.status(500).json({ error: 'Erro ao criar status' });
    }
});

/**
 * PATCH /api/statuses/:id (Admin only)
 */
router.patch('/:id', authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color, is_conversion } = req.body;

        const status = await db.getStatusById(id);
        if (!status) {
            return res.status(404).json({ error: 'Status não encontrado' });
        }

        if (status.is_conversion && status.is_system && name && name !== status.name) {
            return res.status(400).json({ error: 'O nome do status de conversão do sistema não pode ser alterado' });
        }

        if (name && name !== status.name) {
            const existing = await db.getStatusByName(name);
            if (existing && existing.id !== parseInt(id)) {
                return res.status(400).json({ error: 'Já existe um status com este nome' });
            }
        }

        const updateData = {};
        if (name !== undefined) updateData.name = name;
        if (color !== undefined) updateData.color = color;
        if (is_conversion !== undefined) updateData.is_conversion = is_conversion;

        await db.updateStatus(id, updateData);
        res.json({ message: 'Status atualizado com sucesso' });
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Erro ao atualizar status' });
    }
});

/**
 * DELETE /api/statuses/:id (Admin only)
 */
router.delete('/:id', authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        const status = await db.getStatusById(id);
        if (!status) {
            return res.status(404).json({ error: 'Status não encontrado' });
        }

        if (status.is_system) {
            return res.status(400).json({ error: 'Status do sistema não podem ser deletados' });
        }

        const leadsCount = await db.countLeadsByStatus(id);
        if (leadsCount > 0) {
            return res.status(400).json({
                error: `Não é possível deletar: ${leadsCount} leads estão usando este status`
            });
        }

        await db.deleteStatus(id);
        res.json({ message: 'Status deletado com sucesso' });
    } catch (error) {
        console.error('Error deleting status:', error);
        res.status(500).json({ error: 'Erro ao deletar status' });
    }
});

/**
 * PUT /api/statuses/order (Admin only)
 */
router.put('/order', authorize('admin'), async (req, res) => {
    try {
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Ordem deve ser um array de IDs' });
        }

        for (let i = 0; i < order.length; i++) {
            await db.updateStatus(order[i], { display_order: i + 1 });
        }

        res.json({ message: 'Ordem atualizada com sucesso' });
    } catch (error) {
        console.error('Error updating status order:', error);
        res.status(500).json({ error: 'Erro ao atualizar ordem' });
    }
});

export default router;
