/**
 * Webhook Routes - Supabase Version
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/supabase.js';

const router = Router();

/**
 * POST /api/webhook/hotmart
 */
router.post('/hotmart', async (req, res) => {
    try {
        // Verificar se webhook está habilitado
        const settings = await db.getApiSettings();

        if (!settings || !settings.webhook_enabled) {
            return res.status(403).json({ error: 'Webhook desabilitado' });
        }

        // Verificar token se necessário
        if (settings.require_token) {
            const authHeader = req.headers.authorization;
            const token = authHeader?.replace('Bearer ', '');

            if (!token || token !== settings.webhook_token) {
                return res.status(401).json({ error: 'Token inválido' });
            }
        }

        // Extrair dados do webhook da Hotmart
        const data = req.body.data || req.body;
        const buyer = data.buyer || data;

        const leadData = {
            uuid: uuidv4(),
            first_name: buyer.name || buyer.first_name || 'Sem nome',
            email: (buyer.email || '').toLowerCase(),
            phone: (buyer.phone_number || buyer.phone || buyer.checkout_phone || '').replace(/\D/g, ''),
            product_name: data.product?.name || data.product_name || '',
            transaction_id: data.purchase?.transaction || data.transaction || null,
            status_id: 1,
            source: 'hotmart',
            in_group: false
        };

        if (!leadData.email) {
            return res.status(400).json({ error: 'Email é obrigatório' });
        }

        // Verificar se lead já existe
        const existing = await db.getLeadByEmail(leadData.email);
        if (existing) {
            return res.json({ message: 'Lead já existe', lead_uuid: existing.uuid });
        }

        // Distribuir para vendedora (Round-Robin)
        const sellers = await db.getActiveSellersInDistribution();

        if (sellers.length > 0) {
            const control = await db.getDistributionControl();
            const lastSellerId = control?.last_seller_id;

            let nextIndex = 0;
            if (lastSellerId) {
                const currentIndex = sellers.findIndex(s => s.id === lastSellerId);
                nextIndex = (currentIndex + 1) % sellers.length;
            }

            leadData.seller_id = sellers[nextIndex].id;
            await db.updateDistributionControl(sellers[nextIndex].id);
        }

        // Criar lead
        const lead = await db.createLead(leadData);

        res.json({
            success: true,
            message: 'Lead criado com sucesso',
            lead_uuid: lead.uuid
        });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: 'Erro ao processar webhook' });
    }
});

export default router;
