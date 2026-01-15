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
        console.log('🗑️🗑️🗑️ EXCLUSION WEBHOOK RECEIVED 🗑️🗑️🗑️');
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(req.body, null, 2));
        console.log('Query:', JSON.stringify(req.query, null, 2));

        // Verificar se webhook está habilitado
        const settings = await db.getApiSettings();
        console.log('Settings loaded:', settings ? 'YES' : 'NO');
        console.log('Exclusion enabled:', settings?.exclusion_enabled);

        if (!settings || !settings.exclusion_enabled) {
            console.log('⚠️ Webhook de exclusão desabilitado');
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

        // Se vier do Hotmart, pode estar aninhado em vários lugares
        if (!phone && body.data?.buyer) {
            phone = body.data.buyer.checkout_phone || body.data.buyer.phone;
        }

        // Fallback para buyer direto (sem data)
        if (!phone && body.buyer) {
            phone = body.buyer.checkout_phone || body.buyer.phone;
        }

        console.log(`   📱 Telefone bruto extraído: ${phone}`);

        if (!phone) {
            console.log('   ❌ Telefone não encontrado no payload');
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
        console.log(`   📞 Telefone normalizado: ${phone}`);

        // Importar service dinamicamente para evitar ciclo ou carregar desnecessariamente
        const { removeParticipant, getConnectionStatus } = await import('../services/whatsappService.js');

        // Para cada grupo, descobrir a conexão e remover
        const results = [];
        let processedCount = 0;

        for (const groupId of excludedGroupIds) {
            processedCount++;
            console.log(`\n   📋 [${processedCount}/${excludedGroupIds.length}] Processando grupo: ${groupId}`);

            // Buscar conexão dona deste grupo
            const { data: groupData, error } = await supabase
                .from('whatsapp_groups')
                .select('connection_id, group_name, participant_count')
                .eq('group_id', groupId)
                .single();

            if (error || !groupData) {
                const errorMsg = `Grupo não encontrado no banco de dados`;
                console.error(`   ❌ ${errorMsg}`);
                console.error(`   🔍 Detalhes: ${error?.message || 'Grupo não existe na tabela whatsapp_groups'}`);
                results.push({
                    groupId,
                    success: false,
                    error: errorMsg,
                    details: error?.message || 'Grupo não cadastrado'
                });
                continue;
            }

            console.log(`   📱 Grupo: ${groupData.group_name}`);
            console.log(`   🔗 Connection ID: ${groupData.connection_id}`);
            console.log(`   👥 Participantes: ${groupData.participant_count || 'N/A'}`);

            // Verificar status da conexão
            try {
                const connectionStatus = await getConnectionStatus(groupData.connection_id);
                console.log(`   🔌 Status da conexão: ${connectionStatus ? 'Conectado' : 'Desconectado'}`);

                if (!connectionStatus) {
                    const errorMsg = 'WhatsApp desconectado';
                    console.error(`   ❌ ${errorMsg} - Não é possível remover participante`);
                    results.push({
                        groupId,
                        groupName: groupData.group_name,
                        success: false,
                        error: errorMsg,
                        details: 'A conexão WhatsApp não está ativa. Reconecte o WhatsApp e tente novamente.'
                    });
                    continue;
                }
            } catch (statusErr) {
                console.error(`   ⚠️ Não foi possível verificar status da conexão: ${statusErr.message}`);
                // Continua tentando remover mesmo sem verificar status
            }

            try {
                console.log(`   🗑️ Tentando remover ${phone} do grupo...`);

                // Tentar remover
                await removeParticipant(groupData.connection_id, groupId, phone);

                console.log(`   ✅ Removido com sucesso!`);
                results.push({
                    groupId,
                    groupName: groupData.group_name,
                    success: true,
                    message: 'Participante removido com sucesso'
                });

            } catch (err) {
                // Análise detalhada do erro
                let errorReason = err.message;
                let errorDetails = '';

                if (err.message?.includes('participant-not-found') || err.message?.includes('not a participant')) {
                    errorReason = 'Participante não encontrado no grupo';
                    errorDetails = 'O número não está neste grupo ou já foi removido anteriormente';
                } else if (err.message?.includes('not-authorized') || err.message?.includes('forbidden')) {
                    errorReason = 'Sem permissão para remover';
                    errorDetails = 'O bot não tem permissão de admin neste grupo';
                } else if (err.message?.includes('rate-overlimit')) {
                    errorReason = 'Limite de requisições atingido';
                    errorDetails = 'WhatsApp bloqueou temporariamente. Aguarde alguns minutos';
                } else if (err.message?.includes('connection')) {
                    errorReason = 'Erro de conexão';
                    errorDetails = 'Conexão WhatsApp instável ou desconectada';
                } else {
                    errorDetails = err.message;
                }

                console.error(`   ❌ Falha ao remover: ${errorReason}`);
                console.error(`   📝 Detalhes: ${errorDetails}`);
                console.error(`   🔍 Stack: ${err.stack?.split('\n')[0]}`);

                results.push({
                    groupId,
                    groupName: groupData.group_name,
                    success: false,
                    error: errorReason,
                    details: errorDetails
                });
            }
        }

        // Resumo final
        const successCount = results.filter(r => r.success).length;
        const errorCount = results.filter(r => !r.success).length;

        console.log(`\n   📊 RESUMO DA EXCLUSÃO:`);
        console.log(`   ✅ Sucessos: ${successCount}`);
        console.log(`   ❌ Erros: ${errorCount}`);
        console.log(`   📋 Total processado: ${results.length}`);

        // Salvar log no banco de dados - um registro por grupo
        try {
            console.log('   💾 Salvando logs no banco de dados...');

            const logsToInsert = results.map(result => ({
                phone: phone,
                group_id: result.groupId,
                group_name: result.groupName || 'Grupo desconhecido',
                status: result.success ? 'success' : 'error',
                error_message: result.success ? null : `${result.error}${result.details ? ': ' + result.details : ''}`,
                created_at: new Date().toISOString()
            }));

            const { data, error: logError } = await supabase
                .from('exclusion_logs')
                .insert(logsToInsert)
                .select();

            if (logError) {
                console.error('   ⚠️ Erro ao salvar logs no banco:', logError.message);
                console.error('   🔍 Detalhes:', logError);
            } else {
                console.log(`   ✅ ${data.length} logs salvos no banco de dados com sucesso!`);
            }
        } catch (logErr) {
            console.error('   ⚠️ Falha ao salvar logs:', logErr.message);
            console.error('   🔍 Stack:', logErr.stack);
        }

        res.json({
            success: true,
            message: 'Processamento de exclusão concluído',
            phone: phone,
            summary: {
                total: results.length,
                success: successCount,
                errors: errorCount
            },
            results
        });

    } catch (error) {
        console.error('Exclusion Webhook Error:', error);
        res.status(500).json({ error: 'Erro interno ao processar webhook de exclusão' });
    }
});

export default router;
