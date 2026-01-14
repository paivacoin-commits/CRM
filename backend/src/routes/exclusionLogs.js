/**
 * Exclusion Logs Routes
 */

import { Router } from 'express';
import { supabase } from '../database/supabase.js';

const router = Router();

/**
 * GET /api/exclusion-logs
 * Get recent exclusion logs
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const { data, error } = await supabase
            .from('exclusion_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json({ logs: data || [] });
    } catch (error) {
        console.error('Error fetching exclusion logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs de exclusão' });
    }
});

export default router;
