/**
 * WhatsApp Templates Routes - Supabase Version
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../database/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/whatsapp-templates
 */
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ templates: data || [] });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

/**
 * POST /api/whatsapp-templates
 */
router.post('/', async (req, res) => {
    try {
        const { name, message } = req.body;

        if (!name || !message) {
            return res.status(400).json({ error: 'Nome e mensagem são obrigatórios' });
        }

        const { data, error } = await supabase
            .from('whatsapp_templates')
            .insert({
                uuid: uuidv4(),
                name,
                message
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Template criado', template: data });
    } catch (error) {
        console.error('Error creating template:', error);
        res.status(500).json({ error: 'Erro ao criar template' });
    }
});

/**
 * PATCH /api/whatsapp-templates/:uuid
 */
router.patch('/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        const { name, message } = req.body;

        const updateData = { updated_at: new Date().toISOString() };
        if (name !== undefined) updateData.name = name;
        if (message !== undefined) updateData.message = message;

        const { error } = await supabase
            .from('whatsapp_templates')
            .update(updateData)
            .eq('uuid', uuid);

        if (error) throw error;
        res.json({ message: 'Template atualizado' });
    } catch (error) {
        console.error('Error updating template:', error);
        res.status(500).json({ error: 'Erro ao atualizar template' });
    }
});

/**
 * DELETE /api/whatsapp-templates/:uuid
 */
router.delete('/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;

        const { error } = await supabase
            .from('whatsapp_templates')
            .delete()
            .eq('uuid', uuid);

        if (error) throw error;
        res.json({ message: 'Template excluído' });
    } catch (error) {
        console.error('Error deleting template:', error);
        res.status(500).json({ error: 'Erro ao excluir template' });
    }
});

export default router;
