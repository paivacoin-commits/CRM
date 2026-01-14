/**
 * Webhook Routes - Supabase Version
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, supabase } from '../database/supabase.js';
import { normalizePhone } from '../utils/phoneNormalizer.js';
import fs from 'fs';

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
            const token = authHeader?.replace('Bearer ', '') || req.query.token;

            if (!token || token !== settings.webhook_token) {
                return res.status(401).json({ error: 'Token inválido' });
            }
        }

        // Extrair dados do webhook da Hotmart
        const data = req.body.data || req.body;
        const buyer = data.buyer || data;

        // Normalizar telefone
        let phone = (buyer.phone_number || buyer.phone || buyer.checkout_phone || '').replace(/\D/g, '');
        if (phone) {
            // Adicionar DDI 55 se não tiver
            if (phone.length === 10 || phone.length === 11) {
                phone = '55' + phone;
            } else if (phone.length === 12 || phone.length === 13) {
                if (!phone.startsWith('55')) {
                    phone = '55' + phone;
                }
            }
        }

        const leadData = {
            uuid: uuidv4(),
            first_name: buyer.name || buyer.first_name || 'Sem nome',
            email: (buyer.email || '').toLowerCase(),
            phone: phone,
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

        // Distribuir para vendedora (Round-Robin) - SE HABILITADO
        if (settings.round_robin_enabled !== false) {
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
                console.log(`   👤 Lead distribuído para: ${sellers[nextIndex].name}`);
            }
        } else {
            console.log('   ⚠️ Round-Robin desabilitado - Lead criado sem vendedor');
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

/**
 * POST /api/webhook/checking
 * Atualiza o status "checking" de um lead via Google Forms
 */
router.post('/checking', async (req, res) => {
    try {
        // Verificar se webhook está habilitado
        const settings = await db.getApiSettings();

        if (!settings || !settings.webhook_enabled) {
            return res.status(403).json({ error: 'Webhook desabilitado' });
        }

        // Verificar token se necessário
        if (settings.require_token) {
            const authHeader = req.headers.authorization;
            const token = authHeader?.replace('Bearer ', '') || req.query.token;

            if (!token || token !== settings.webhook_token) {
                return res.status(401).json({ error: 'Token inválido' });
            }
        }

        const { email, phone, checking } = req.body;

        if (!email && !phone) {
            return res.status(400).json({ error: 'Email ou telefone é obrigatório' });
        }

        // Buscar lead
        let lead = null;
        if (email) lead = await db.getLeadByEmail(email);
        if (!lead && phone) {
            // Tentar normalizar telefone (remover não dígitos)
            const cleanPhone = phone.replace(/\D/g, '');
            // Pegar últimos 8-9 dígitos para garantir match
            const phoneEnd = cleanPhone.slice(-8);
            lead = await db.getLeadByPhone(phoneEnd);
        }

        if (!lead) {
            return res.status(404).json({ error: 'Lead não encontrado' });
        }

        // Atualizar checking
        // Se checking não foi enviado, assume true (marcar como checado)
        const isChecking = checking !== undefined ? checking : true;

        // Se já estava checkado e o valor é o mesmo, não faz nada (ou faz update de timestamp)
        // Adicionar observação automática
        const obs = `[AUTO] Checking confirmado via Google Forms em ${new Date().toLocaleString('pt-BR')}`;
        const newObs = lead.observations ? `${lead.observations}\n${obs}` : obs;

        await db.updateLeadById(lead.id, {
            checking: isChecking,
            observations: newObs
        });

        res.json({
            success: true,
            message: `Lead ${lead.first_name} checking atualizado para ${isChecking}`,
            lead_uuid: lead.uuid
        });

    } catch (error) {
        console.error('Checking webhook error:', error);
        res.status(500).json({ error: 'Erro ao processar checking' });
    }
});

/**
 * POST /api/webhook/greatpages
 * Recebe leads da GreatPages
 */
router.post('/greatpages', async (req, res) => {
    try {
        // Verificar se webhook está habilitado
        const settings = await db.getApiSettings();

        if (!settings || !settings.webhook_enabled) {
            return res.status(403).json({ error: 'Webhook desabilitado' });
        }

        const body = req.body;
        console.log('📥 GreatPages Webhook received:', JSON.stringify(body));

        // Extrair dados - GreatPages envia campos em MAIÚSCULAS ou minúsculas
        // Campos padrão do GreatPages: NOME, EMAIL, TELEFONE
        const email = body.EMAIL || body.email || body.Email || body['e-mail'] || body['E-mail'];
        const name = body.NOME || body.nome || body.name || body.Nome || body.first_name || 'Lead GreatPages';
        let phone = body.TELEFONE || body.telefone || body.phone || body.Phone || body.whatsapp || body.WhatsApp || body.celular;

        console.log(`   📋 Dados extraídos: Nome="${name}", Email="${email}", Telefone="${phone}"`);

        if (!email && !phone) {
            console.log('   ❌ Nenhum email ou telefone encontrado no payload');
            return res.status(400).json({ error: 'Email ou telefone não encontrados no payload' });
        }

        // Normalizar telefone usando função robusta
        phone = normalizePhone(phone);
        console.log(`   📞 Telefone normalizado: ${phone}`);

        if (!phone && !email) {
            console.log('   ❌ Telefone inválido e sem email');
            return res.status(400).json({ error: 'Telefone inválido e email não fornecido' });
        }

        // Verificar Campanha (Query Param) - ANTES de verificar lead existente
        let campaignId = null;
        const campaignUuid = req.query.campaign || req.query.campaign_id;
        if (campaignUuid) {
            try {
                const campaign = await db.getCampaignByUuid(campaignUuid);
                if (campaign) {
                    campaignId = campaign.id;
                    console.log(`   🎯 Campanha identificada: ${campaign.name} (${campaignId})`);
                }
            } catch (err) {
                console.error('Erro ao buscar campanha GreatPages:', err.message);
            }
        }

        // Verificar existência NA MESMA CAMPANHA
        let existing = null;
        if (campaignId) {
            // Buscar lead com mesmo email/telefone NA MESMA campanha
            if (email) {
                const { data, error } = await supabase
                    .from('leads')
                    .select('id, uuid, first_name, campaign_id')
                    .eq('email', email.toLowerCase())
                    .eq('campaign_id', campaignId)
                    .single();

                if (data && !error) existing = data;
            }

            if (!existing && phone) {
                const phoneEnd = phone.slice(-8);
                const { data, error } = await supabase
                    .from('leads')
                    .select('id, uuid, first_name, campaign_id')
                    .ilike('phone', `%${phoneEnd}`)
                    .eq('campaign_id', campaignId)
                    .single();

                if (data && !error) existing = data;
            }
        }

        if (existing) {
            console.log(`⚠️ Lead já existe na campanha ${campaignId}: ${existing.id}`);
            // Lead já existe na mesma campanha, apenas retornar
            return res.json({ message: 'Lead já existe nesta campanha', id: existing.uuid });
        }

        // Lead não existe nesta campanha, pode criar (mesmo que exista em outra)
        console.log(`   ✅ Criando novo lead na campanha ${campaignId}`);

        // Distribuir (Round-Robin) - SE HABILITADO
        let sellerId = null;
        if (settings.round_robin_enabled !== false) {
            const sellers = await db.getActiveSellersInDistribution();
            if (sellers.length > 0) {
                const control = await db.getDistributionControl();
                const lastSellerId = control?.last_seller_id;
                let nextIndex = 0;
                if (lastSellerId) {
                    // Encontrar índice do último e pegar o próximo
                    const idx = sellers.findIndex(s => s.id === lastSellerId);
                    if (idx >= 0) nextIndex = (idx + 1) % sellers.length;
                }
                sellerId = sellers[nextIndex].id;
                await db.updateDistributionControl(sellerId);
                console.log(`   👤 Lead distribuído para: ${sellers[nextIndex].name}`);
            }
        } else {
            console.log(`   ⚠️ Round-Robin desabilitado - Lead criado sem vendedor`);
        }

        // Lógica de espelhamento de vendedora (se campanha tiver mirror_campaign_id)
        if (campaignId) {
            const campaign = await db.getCampaignByUuid(campaignUuid);
            if (campaign && campaign.mirror_campaign_id) {
                console.log(`   🪞 Campanha espelha ${campaign.mirror_campaign_id}. Buscando vendedora...`);

                let sourceLead = null;

                // Buscar lead na campanha espelhada pelo telefone
                if (phone && phone.length >= 8) {
                    const phoneEnd = phone.slice(-8);
                    console.log(`   🔍 Buscando por telefone terminando em: ${phoneEnd}`);

                    const { data: leads, error } = await supabase
                        .from('leads')
                        .select('id, first_name, seller_id, phone')
                        .eq('campaign_id', campaign.mirror_campaign_id)
                        .ilike('phone', `%${phoneEnd}`)
                        .limit(1);

                    console.log(`   📊 Query result: ${leads?.length || 0} leads encontrados`);
                    if (leads && leads.length > 0) {
                        console.log(`   📋 Lead encontrado: ${leads[0].first_name} (ID: ${leads[0].id}, Seller: ${leads[0].seller_id})`);
                        sourceLead = leads[0];
                    }
                    if (error) console.error('   ❌ Erro na busca:', error);
                }

                // Se não encontrou por telefone, tentar por email
                if (!sourceLead && email) {
                    console.log(`   🔍 Buscando por email: ${email.toLowerCase()}`);
                    const { data: leads, error } = await supabase
                        .from('leads')
                        .select('id, first_name, seller_id, email')
                        .eq('campaign_id', campaign.mirror_campaign_id)
                        .eq('email', email.toLowerCase())
                        .limit(1);

                    console.log(`   📊 Query result: ${leads?.length || 0} leads encontrados`);
                    if (leads && leads.length > 0) {
                        console.log(`   📋 Lead encontrado: ${leads[0].first_name} (ID: ${leads[0].id}, Seller: ${leads[0].seller_id})`);
                        sourceLead = leads[0];
                    }
                    if (error) console.error('   ❌ Erro na busca:', error);
                }

                // Se encontrou e tem vendedora, usar a mesma (sobrescreve round-robin)
                if (sourceLead && sourceLead.seller_id) {
                    sellerId = sourceLead.seller_id;
                    console.log(`   ✅ Vendedora espelhada: ID ${sellerId}`);
                } else {
                    console.log(`   ⚠️ Lead não encontrado na campanha de origem ou sem vendedora.`);
                    if (sourceLead) console.log(`   ⚠️ Lead encontrado mas seller_id = ${sourceLead.seller_id}`);
                }
            }
        }

        // Criar Lead (SEM status - deixar null para não vir como "Onboarding")
        const newLead = await db.createLead({
            uuid: uuidv4(),
            first_name: name,
            email: email ? email.toLowerCase() : null,
            phone: phone,
            seller_id: sellerId,
            status_id: null, // NULL = sem status (não usar default)
            campaign_id: campaignId,
            source: 'greatpages',
            checking: false,
            in_group: false,
            observations: `[Origem: GreatPages]\nPayload: ${JSON.stringify(body)}`
        });

        res.json({ success: true, id: newLead.uuid });

    } catch (error) {
        console.error('GreatPages Webhook Error:', error);
        // Debug: write to file
        try { fs.writeFileSync('greatpages_error.log', `Error: ${error.message}\nStack: ${error.stack}\n`); } catch (e) { }
        res.status(500).json({ error: 'Erro interno ao processar GreatPages webhook' });
    }
});

/**
 * POST /api/webhook/exclusion
 * Remove contatos dos grupos selecionados
 */
router.post('/exclusion', async (req, res) => {
    try {
        console.log('🗑️ Exclusion Webhook received');

        // Verificar se webhook está habilitado
        const settings = await db.getApiSettings();

        if (!settings || !settings.exclusion_enabled) {
            return res.status(403).json({ error: 'Webhook de exclusão desabilitado' });
        }

        // Verificar token APENAS se estiver configurado
        if (settings.exclusion_token && settings.exclusion_token.trim() !== '') {
            const authHeader = req.headers.authorization;
            const token = authHeader?.replace('Bearer ', '') || req.query.token;

            if (!token || token !== settings.exclusion_token) {
                return res.status(401).json({ error: 'Token inválido' });
            }
        }
        // Se não tiver token configurado, permite acesso sem autenticação

        const body = req.body;
        // Tentar pegar telefone de vários campos possíveis
        let phone = body.phone || body.telefone || body.whatsapp || body.celular || body.phone_number;

        // Se vier do Hotmart, pode estar aninhado
        if (!phone && (body.data?.buyer?.phone || body.buyer?.phone)) {
            phone = body.data?.buyer?.phone || body.buyer?.phone;
        }

        if (!phone) {
            return res.status(400).json({ error: 'Telefone não encontrado no payload' });
        }

        // Normalizar telefone
        phone = normalizePhone(phone);
        console.log(`   📞 Telefone para exclusão: ${phone}`);

        if (!phone) {
            return res.status(400).json({ error: 'Telefone inválido' });
        }

        // Obter grupos configurados para exclusão
        const excludedGroupIds = settings.exclusion_group_ids;
        if (!excludedGroupIds || !Array.isArray(excludedGroupIds) || excludedGroupIds.length === 0) {
            console.log('   ⚠️ Nenhum grupo configurado para exclusão');
            return res.json({ success: true, message: 'Nenhum grupo configurado para exclusão' });
        }

        console.log(`   🎯 Grupos alvo: ${excludedGroupIds.length} grupos`);

        // Importar service dinamicamente para evitar ciclo ou carregar desnecessariamente
        const { removeParticipant } = await import('../services/whatsappService.js');

        // Para cada grupo, descobrir a conexão e remover
        const results = [];

        for (const groupId of excludedGroupIds) {
            // Buscar conexão dona deste grupo
            const { data: groupData, error } = await supabase
                .from('whatsapp_groups')
                .select('connection_id, group_name')
                .eq('group_id', groupId)
                .single();

            if (error || !groupData) {
                console.error(`   ❌ Grupo ${groupId} não encontrado no banco`);
                results.push({ groupId, success: false, error: 'Grupo não encontrado' });
                continue;
            }

            try {
                // Tentar remover
                await removeParticipant(groupData.connection_id, groupId, phone);
                results.push({ groupId, groupName: groupData.group_name, success: true });
            } catch (err) {
                console.error(`   ❌ Erro ao remover do grupo ${groupData.group_name}:`, err.message);
                results.push({ groupId, groupName: groupData.group_name, success: false, error: err.message });
            }
        }

        res.json({
            success: true,
            message: 'Processamento de exclusão concluído',
            results
        });

    } catch (error) {
        console.error('Exclusion Webhook Error:', error);
        res.status(500).json({ error: 'Erro interno ao processar webhook de exclusão' });
    }
});

export default router;
