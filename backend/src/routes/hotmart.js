/**
 * Hotmart Webhook Integration Routes - Supabase Version
 * Handles automatic lead import from Hotmart purchases
 */

import { Router } from 'express';
import crypto from 'crypto';
import { supabase } from '../database/supabase.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * Helper - Normaliza telefone para padrão brasileiro (13 dígitos)
 * Formato: 55 + DDD + 9 + 8 dígitos
 */
function normalizePhone(phone) {
    if (!phone) return null;
    let n = phone.replace(/\D/g, '');

    // Se já tem 13 dígitos (DDI 55 + DDD + 9 + 8 dígitos), está correto
    if (n.length === 13) {
        return n; // Ex: 5562999981718
    }

    // Se tem 14 ou mais dígitos, pode ter um 9 duplicado - remover
    if (n.length >= 14 && n.startsWith('55')) {
        const ddd = n.substring(2, 4);
        const rest = n.substring(4);

        // Se tem dois 9s seguidos, remover um
        if (rest.startsWith('99')) {
            return '55' + ddd + rest.substring(1, 10); // Remove um 9 e pega só 9 dígitos
        }

        // Se não, pegar apenas os primeiros 13 dígitos
        return n.substring(0, 13);
    }

    // Se tem 12 dígitos (DDI 55 + 10 dígitos sem o 9)
    if (n.length === 12 && n.startsWith('55')) {
        const ddd = n.substring(2, 4);
        const firstDigit = n.charAt(4);

        // Se o primeiro dígito é 6, 7, 8 ou 9, é celular sem o 9
        if (firstDigit === '6' || firstDigit === '7' || firstDigit === '8' || firstDigit === '9') {
            return '55' + ddd + '9' + n.substring(4); // Adiciona o 9
        }
        // Se começa com 2, 3, 4 ou 5, é telefone fixo
        return n;
    }

    // Se tem 11 dígitos (número brasileiro sem DDI), adicionar 55
    if (n.length === 11) {
        return '55' + n;
    }

    // Se tem 10 dígitos, verificar se é celular ou fixo
    if (n.length === 10) {
        const ddd = n.substring(0, 2);
        const firstDigit = n.charAt(2);

        // Se o primeiro dígito do número é 9, 8 ou 7, é celular antigo
        if (firstDigit === '9' || firstDigit === '8' || firstDigit === '7') {
            // É celular antigo sem o 9 - adicionar 9 e DDI 55
            return '55' + ddd + '9' + n.substring(2);
        }
        // Se começa com 2, 3, 4, 5 ou 6, é telefone FIXO - adicionar DDI 55
        return '55' + n;
    }

    // Para números com menos de 10 dígitos, retornar null (inválido)
    if (n.length < 10) {
        return null;
    }

    return n;
}

/**
 * POST /api/hotmart/webhook/:number
 * Receive Hotmart purchase notifications (public endpoint with webhook number)
 */
router.post('/webhook:number(\\d+)?', async (req, res) => {
    try {
        const payload = req.body;
        const webhookNumber = parseInt(req.params.number) || 1; // Default to webhook1 if no number
        console.log(`📥 Hotmart webhook${webhookNumber} received:`, JSON.stringify(payload, null, 2));

        // Get webhook configuration
        const { data: config } = await supabase
            .from('hotmart_webhook_configs')
            .select('*')
            .eq('webhook_number', webhookNumber)
            .single();

        if (!config) {
            console.log(`❌ Webhook configuration ${webhookNumber} not found`);
            return res.status(404).json({ error: 'Webhook configuration not found' });
        }

        if (!config.is_enabled) {
            console.log(`⚠️ Webhook ${webhookNumber} is disabled, ignoring`);
            return res.status(200).json({ message: 'Webhook disabled' });
        }

        // Extract lead data from payload
        const leadData = extractLeadData(payload);

        if (!leadData) {
            console.log('❌ Could not extract lead data from payload');
            await logWebhook(payload, 'error', 'Invalid payload structure', null, null, null, null);
            return res.status(400).json({ error: 'Invalid payload' });
        }

        // Check for duplicate lead in the SAME CAMPAIGN
        // This allows the same email/phone to exist in different campaigns
        const { data: existingLead } = await supabase
            .from('leads')
            .select('uuid')
            .eq('campaign_id', config.campaign_id)
            .or(`email.eq.${leadData.email},phone.eq.${leadData.phone}`)
            .limit(1)
            .single();

        let leadUuid;
        let status = 'success';

        if (existingLead) {
            // Update existing lead
            leadUuid = existingLead.uuid;
            await supabase
                .from('leads')
                .update({
                    first_name: leadData.name,
                    email: leadData.email,
                    phone: normalizePhone(leadData.phone),
                    // NÃO atualiza product - mantém o original
                    // NÃO atualiza status - mantém o original
                    // NÃO atualiza seller_id - mantém o original
                    updated_at: new Date().toISOString()
                })
                .eq('uuid', leadUuid);

            status = 'duplicate';
            console.log(`♻️ Updated existing lead: ${leadUuid} (manteve produto e vendedora originais)`);
        } else {
            // Create new lead
            const uuid = crypto.randomUUID();
            leadUuid = uuid;

            // Determine seller_id if distribution is enabled for this webhook
            let sellerId = null;
            if (config.enable_round_robin) {
                sellerId = await getNextSeller();
            }

            // NÃO define status - fica null (mostra "-selecione-" no CRM)
            const { data: insertedLead, error: insertError } = await supabase
                .from('leads')
                .insert({
                    uuid,
                    first_name: leadData.name,
                    email: leadData.email,
                    phone: normalizePhone(leadData.phone),
                    product: leadData.product,
                    campaign_id: config.campaign_id, // Use campaign from webhook config
                    seller_id: sellerId,
                    status_id: null, // Explicitamente null para mostrar "-selecione-"
                    in_group: false
                })
                .select()
                .single();

            if (insertError) {
                console.error('❌ Erro ao inserir lead:', insertError);
                throw new Error(`Erro ao criar lead: ${insertError.message}`);
            }

            console.log(`✅ Created new lead: ${uuid} ${sellerId ? `(assigned to seller ${sellerId})` : ''}`);
        }

        // Log webhook activity
        await logWebhook(
            payload,
            status,
            null,
            leadUuid,
            leadData.email,
            leadData.name,
            leadData.product,
            config.id // Add webhook config ID to log
        );

        res.status(200).json({
            message: 'Webhook processed successfully',
            lead_uuid: leadUuid,
            status
        });

    } catch (error) {
        console.error('❌ Error processing Hotmart webhook:', error);
        await logWebhook(req.body, 'error', error.message, null, null, null, null, null);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/hotmart/configs
 * Get all webhook configurations
 */
router.get('/configs', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { data: configs } = await supabase
            .from('hotmart_webhook_configs')
            .select('*')
            .order('webhook_number');

        res.json({ configs: configs || [] });
    } catch (error) {
        console.error('Error fetching webhook configs:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações de webhook' });
    }
});

/**
 * POST /api/hotmart/configs
 * Create new webhook configuration
 */
router.post('/configs', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { campaign_id, webhook_secret, enable_round_robin } = req.body;

        // Find next available webhook number
        const { data: existingConfigs } = await supabase
            .from('hotmart_webhook_configs')
            .select('webhook_number')
            .order('webhook_number', { ascending: false })
            .limit(1);

        const nextNumber = existingConfigs && existingConfigs.length > 0
            ? existingConfigs[0].webhook_number + 1
            : 1;

        const { data: config } = await supabase
            .from('hotmart_webhook_configs')
            .insert({
                webhook_number: nextNumber,
                campaign_id,
                webhook_secret,
                enable_round_robin: enable_round_robin || false,
                is_enabled: true
            })
            .select()
            .single();

        res.json({ message: 'Webhook criado com sucesso', config });
    } catch (error) {
        console.error('Error creating webhook config:', error);
        res.status(500).json({ error: 'Erro ao criar webhook' });
    }
});

/**
 * PUT /api/hotmart/configs/:id
 * Update webhook configuration
 */
router.put('/configs/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { campaign_id, webhook_secret, is_enabled, enable_round_robin } = req.body;

        const { data: config } = await supabase
            .from('hotmart_webhook_configs')
            .update({
                campaign_id,
                webhook_secret,
                is_enabled,
                enable_round_robin,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        res.json({ message: 'Webhook atualizado com sucesso', config });
    } catch (error) {
        console.error('Error updating webhook config:', error);
        res.status(500).json({ error: 'Erro ao atualizar webhook' });
    }
});

/**
 * DELETE /api/hotmart/configs/:id
 * Delete webhook configuration
 */
router.delete('/configs/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { id } = req.params;

        await supabase
            .from('hotmart_webhook_configs')
            .delete()
            .eq('id', id);

        res.json({ message: 'Webhook deletado com sucesso' });
    } catch (error) {
        console.error('Error deleting webhook config:', error);
        res.status(500).json({ error: 'Erro ao deletar webhook' });
    }
});

/**
 * GET /api/hotmart/settings
 * Get Hotmart configuration
 */
router.get('/settings', authenticate, authorize('admin'), async (req, res) => {
    try {
        let { data: settings } = await supabase
            .from('hotmart_settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (!settings) {
            // Create default settings
            const { data: newSettings } = await supabase
                .from('hotmart_settings')
                .insert({
                    id: 1,
                    enable_auto_import: false,
                    enable_distribution: false
                })
                .select()
                .single();
            settings = newSettings;
        }

        res.json({ settings });
    } catch (error) {
        console.error('Error fetching Hotmart settings:', error);
        res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
});

/**
 * PUT /api/hotmart/settings
 * Update Hotmart configuration
 */
router.put('/settings', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { webhook_secret, default_campaign_id, enable_auto_import, enable_distribution } = req.body;

        // Upsert settings
        const { data: settings } = await supabase
            .from('hotmart_settings')
            .upsert({
                id: 1,
                webhook_secret,
                default_campaign_id,
                enable_auto_import,
                enable_distribution,
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        res.json({ message: 'Configurações salvas com sucesso', settings });
    } catch (error) {
        console.error('Error updating Hotmart settings:', error);
        res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
});

/**
 * POST /api/hotmart/generate-secret
 * Generate new webhook secret
 */
router.post('/generate-secret', authenticate, authorize('admin'), async (req, res) => {
    try {
        const secret = crypto.randomBytes(32).toString('hex');
        res.json({ secret });
    } catch (error) {
        console.error('Error generating secret:', error);
        res.status(500).json({ error: 'Erro ao gerar secret' });
    }
});

/**
 * GET /api/hotmart/logs
 * Get webhook activity logs
 */
router.get('/logs', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { status, limit = 50 } = req.query;

        let query = supabase
            .from('hotmart_webhook_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        if (status) {
            query = query.eq('status', status);
        }

        const { data: logs } = await query;
        res.json({ logs: logs || [] });
    } catch (error) {
        console.error('Error fetching webhook logs:', error);
        res.status(500).json({ error: 'Erro ao buscar logs' });
    }
});

/**
 * POST /api/hotmart/test
 * Test webhook with sample data
 */
router.post('/test', authenticate, authorize('admin'), async (req, res) => {
    try {
        const testPayload = {
            event: 'PURCHASE_COMPLETE',
            data: {
                buyer: {
                    name: 'Teste Hotmart',
                    email: `teste.${Date.now()}@hotmart.com`,
                    phone: '11999999999'
                },
                product: {
                    name: 'Produto Teste'
                }
            }
        };

        // Extract and create lead
        const leadData = extractLeadData(testPayload);
        const uuid = crypto.randomUUID();

        const { data: settings } = await supabase
            .from('hotmart_settings')
            .select('*')
            .eq('id', 1)
            .single();

        let sellerId = null;
        if (settings?.enable_distribution) {
            sellerId = await getNextSeller();
        }

        await supabase
            .from('leads')
            .insert({
                uuid,
                first_name: leadData.name,
                email: leadData.email,
                phone: leadData.phone,
                product: leadData.product,
                campaign_id: settings?.default_campaign_id,
                seller_id: sellerId,
                in_group: false
            });

        await logWebhook(testPayload, 'success', null, uuid, leadData.email, leadData.name, leadData.product);

        res.json({
            message: 'Webhook de teste processado com sucesso',
            lead_uuid: uuid
        });
    } catch (error) {
        console.error('Error testing webhook:', error);
        res.status(500).json({ error: 'Erro ao testar webhook: ' + error.message });
    }
});

// Helper functions

function extractLeadData(payload) {
    try {
        const { event, data } = payload;

        if (event !== 'PURCHASE_COMPLETE' && event !== 'PURCHASE_APPROVED') {
            return null;
        }

        const buyer = data?.buyer;
        const product = data?.product;

        if (!buyer || !product) {
            return null;
        }

        return {
            name: buyer.name || buyer.first_name || 'Lead Hotmart',
            email: buyer.email,
            phone: buyer.checkout_phone || buyer.phone || '',
            product: product.name || 'Produto Hotmart'
        };
    } catch (error) {
        console.error('Error extracting lead data:', error);
        return null;
    }
}

async function getNextSeller() {
    try {
        // Get distribution control
        const { data: control } = await supabase
            .from('distribution_control')
            .select('last_seller_id')
            .eq('id', 1)
            .single();

        // Get active sellers in distribution order
        const { data: sellers } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'seller')
            .eq('is_active', true)
            .eq('is_in_distribution', true)
            .order('distribution_order')
            .order('id');

        if (!sellers || sellers.length === 0) {
            return null;
        }

        // Find next seller
        let nextIndex = 0;
        if (control?.last_seller_id) {
            const currentIndex = sellers.findIndex(s => s.id === control.last_seller_id);
            nextIndex = (currentIndex + 1) % sellers.length;
        }

        const nextSeller = sellers[nextIndex];

        // Update distribution control
        await supabase
            .from('distribution_control')
            .upsert({
                id: 1,
                last_seller_id: nextSeller.id,
                updated_at: new Date().toISOString()
            });

        return nextSeller.id;
    } catch (error) {
        console.error('Error getting next seller:', error);
        return null;
    }
}

async function logWebhook(payload, status, errorMessage, leadUuid, buyerEmail, buyerName, productName, webhookConfigId = null) {
    try {
        const eventType = payload?.event || 'UNKNOWN';

        await supabase
            .from('hotmart_webhook_logs')
            .insert({
                event_type: eventType,
                payload: JSON.stringify(payload),
                status,
                error_message: errorMessage,
                lead_uuid: leadUuid,
                buyer_email: buyerEmail,
                buyer_name: buyerName,
                product_name: productName,
                webhook_config_id: webhookConfigId
            });
    } catch (error) {
        console.error('Error logging webhook:', error);
    }
}

export default router;
