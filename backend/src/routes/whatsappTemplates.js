/**
 * WhatsApp Templates Routes - Com suporte a templates por vendedor
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

/**
 * GET /api/whatsapp-templates
 * - Vendedor: vê apenas seus próprios templates
 * - Admin: vê todos os templates (pode filtrar por seller_id)
 */
router.get('/', async (req, res) => {
    try {
        const { seller_id } = req.query;
        const isAdmin = req.user.role === 'admin';

        let query = supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (isAdmin) {
            // Admin pode filtrar por vendedor específico
            if (seller_id) {
                query = query.eq('seller_id', parseInt(seller_id));
            }
        } else {
            // Vendedor só vê seus próprios templates
            query = query.eq('seller_id', req.user.id);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.json({ templates: data || [] });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Erro ao buscar templates' });
    }
});

/**
 * GET /api/whatsapp-templates/by-seller
 * Admin: Lista templates agrupados por vendedor
 */
router.get('/by-seller', authorize('admin'), async (req, res) => {
    try {
        // Buscar vendedores ativos
        const { data: sellers, error: sellersError } = await supabase
            .from('users')
            .select('id, name')
            .eq('role', 'seller')
            .eq('is_active', true)
            .order('name');

        if (sellersError) throw sellersError;

        // Buscar todos os templates ativos
        const { data: templates, error: templatesError } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (templatesError) throw templatesError;

        // Agrupar templates por vendedor
        const templatesBySeller = (sellers || []).map(seller => ({
            seller_id: seller.id,
            seller_name: seller.name,
            templates: (templates || [])
                .filter(t => t.seller_id === seller.id)
                .map(t => ({
                    uuid: t.uuid,
                    name: t.name,
                    message: t.message,
                    created_at: t.created_at
                }))
        }));

        res.json({ sellers: templatesBySeller });
    } catch (error) {
        console.error('Error fetching templates by seller:', error);
        res.status(500).json({ error: 'Erro ao buscar templates por vendedor' });
    }
});

/**
 * POST /api/whatsapp-templates
 * Cria template para o próprio vendedor (ou para um vendedor específico se admin)
 */
router.post('/', async (req, res) => {
    try {
        const { name, message, seller_id } = req.body;
        const isAdmin = req.user.role === 'admin';

        if (!name || !message) {
            return res.status(400).json({ error: 'Nome e mensagem são obrigatórios' });
        }

        // Determinar seller_id do template
        let targetSellerId = req.user.id;

        if (isAdmin && seller_id) {
            // Admin pode criar para qualquer vendedor
            targetSellerId = parseInt(seller_id);
        } else if (!isAdmin) {
            // Vendedor só pode criar para si mesmo
            targetSellerId = req.user.id;
        }

        const { data, error } = await supabase
            .from('whatsapp_templates')
            .insert({
                uuid: uuidv4(),
                name,
                message,
                seller_id: targetSellerId,
                created_by: req.user.id
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
        const isAdmin = req.user.role === 'admin';

        // Verificar se o template pertence ao usuário (ou se é admin)
        const { data: template, error: fetchError } = await supabase
            .from('whatsapp_templates')
            .select('seller_id')
            .eq('uuid', uuid)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({ error: 'Template não encontrado' });
        }

        if (!isAdmin && template.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para editar este template' });
        }

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
        const isAdmin = req.user.role === 'admin';

        // Verificar se o template pertence ao usuário (ou se é admin)
        const { data: template, error: fetchError } = await supabase
            .from('whatsapp_templates')
            .select('seller_id')
            .eq('uuid', uuid)
            .single();

        if (fetchError || !template) {
            return res.status(404).json({ error: 'Template não encontrado' });
        }

        if (!isAdmin && template.seller_id !== req.user.id) {
            return res.status(403).json({ error: 'Sem permissão para excluir este template' });
        }

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
