/**
 * Imports Routes - Supabase Version
 */

import { Router } from 'express';
import { db } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

/**
 * GET /api/imports
 */
router.get('/', async (req, res) => {
    try {
        const imports = await db.getImportBatches();

        // Adicionar contagem atual de leads para cada batch
        const importsWithCounts = await Promise.all(
            imports.map(async (imp) => {
                const currentLeads = await db.countLeadsByBatchId(imp.id);
                return { ...imp, current_leads: currentLeads };
            })
        );

        res.json({ imports: importsWithCounts });
    } catch (error) {
        console.error('Error fetching imports:', error);
        res.status(500).json({ error: 'Erro ao buscar importações' });
    }
});

/**
 * POST /api/imports/:uuid/revert
 */
router.post('/:uuid/revert', async (req, res) => {
    try {
        const { uuid } = req.params;

        const batch = await db.getImportBatchByUuid(uuid);
        if (!batch) {
            return res.status(404).json({ error: 'Importação não encontrada' });
        }

        if (batch.is_reverted) {
            return res.status(400).json({ error: 'Esta importação já foi revertida' });
        }

        // Deletar todos os leads desta importação
        const deletedCount = await db.deleteLeadsByBatchId(batch.id);

        // Marcar como revertida
        await db.updateImportBatch(batch.id, { is_reverted: true });

        res.json({ message: `Importação revertida. ${deletedCount} leads deletados.` });
    } catch (error) {
        console.error('Error reverting import:', error);
        res.status(500).json({ error: 'Erro ao reverter importação' });
    }
});

/**
 * DELETE /api/imports/:uuid
 */
router.delete('/:uuid', async (req, res) => {
    try {
        await db.deleteImportBatch(req.params.uuid);
        res.json({ message: 'Registro de importação deletado' });
    } catch (error) {
        console.error('Error deleting import record:', error);
        res.status(500).json({ error: 'Erro ao deletar registro' });
    }
});

export default router;
