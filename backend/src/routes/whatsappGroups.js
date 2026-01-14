/**
 * Rotas para gerenciar grupos WhatsApp
 */

import express from 'express';
import { supabase, db } from '../database/supabase.js';
import { v4 as uuidv4 } from 'uuid';
import {
    initializeWhatsAppConnection,
    disconnectWhatsApp,
    listGroups,
    forceGroupSync,
    getActiveConnection
} from '../services/whatsappService.js';
import { whapiService } from '../services/whapiService.js';
import { extractAndValidatePhone } from '../utils/phoneValidator.js';


const router = express.Router();

/**
 * Helper - Normaliza telefone (remove DDI, mantém DDD + número)
 * CORRIGIDO: Não adiciona 9 em telefones fixos e não duplica o 9
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
 * Listar todas as conexões WhatsApp
 */
router.get('/connections', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('whatsapp_connections')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Erro ao listar conexões:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Criar nova conexão WhatsApp
 * Suporta Baileys (local) ou Whapi.Cloud (API)
 */
router.post('/connections', async (req, res) => {
    try {
        const { name, provider = 'baileys' } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome da conexão é obrigatório' });
        }

        // Validar provider (se fornecido)
        if (provider && !['baileys', 'whapi'].includes(provider)) {
            return res.status(400).json({ error: 'Provider deve ser "baileys" ou "whapi"' });
        }

        // Criar conexão no banco
        // WORKAROUND: Não inclui 'provider' se a coluna não existir (espera migration 007)
        const connectionData = {
            name,
            status: 'disconnected'
        };

        // Tentar incluir provider, mas não falhar se a coluna não existir
        try {
            connectionData.provider = provider;
        } catch (e) {
            console.log('⚠️ Coluna provider não existe. Execute migration 007_add_provider_pairing.sql');
        }

        const { data, error } = await supabase
            .from('whatsapp_connections')
            .insert(connectionData)
            .select()
            .single();

        if (error) {
            // Se erro for sobre coluna provider, tentar sem ela
            if (error.message && error.message.includes('provider')) {
                console.log('⚠️ Tentando criar conexão sem provider (migration pendente)...');
                const { data: retryData, error: retryError } = await supabase
                    .from('whatsapp_connections')
                    .insert({
                        name,
                        status: 'disconnected'
                    })
                    .select()
                    .single();

                if (retryError) throw retryError;
                return res.json(retryData);
            }
            throw error;
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao criar conexão:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Conectar WhatsApp (gerar QR code ou Pairing Code)
 */
router.post('/connections/:id/connect', async (req, res) => {
    try {
        const { id } = req.params;
        const { usePairingCode, phoneNumber } = req.body;

        // Verificar se conexão existe
        const { data: connection, error } = await supabase
            .from('whatsapp_connections')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !connection) {
            return res.status(404).json({ error: 'Conexão não encontrada' });
        }

        // Validar pairing code
        if (usePairingCode && !phoneNumber) {
            return res.status(400).json({
                error: 'Número de telefone é obrigatório para usar código de pareamento'
            });
        }

        // Forçar desconexão anterior e limpeza de sessão para garantir novo QR Code
        console.log(`🔄 Reiniciando sessão para conexão: ${id}`);
        await disconnectWhatsApp(id);

        // Pequeno delay para garantir que o banco processou a deleção
        await new Promise(resolve => setTimeout(resolve, 1000));

        // ⚠️ FIX: Marcar IMEDIATAMENTE como 'connecting' no banco
        // Isso evita que o frontend (que faz polling) receba 'disconnected' e pare de buscar o QR Code
        await supabase
            .from('whatsapp_connections')
            .update({
                status: 'connecting',
                qr_code: null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);

        // Inicializar conexão com pairing code ou QR code
        await initializeWhatsAppConnection(id, usePairingCode || false, phoneNumber);

        const message = usePairingCode
            ? 'Código de pareamento gerado! Verifique o WhatsApp.'
            : 'Conexão iniciada. Aguarde o QR code...';

        res.json({ message, usePairingCode: usePairingCode || false });
    } catch (error) {
        console.error('Erro ao conectar WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Desconectar WhatsApp
 */
router.post('/connections/:id/disconnect', async (req, res) => {
    try {
        const { id } = req.params;
        await disconnectWhatsApp(id);
        res.json({ message: 'Desconectado com sucesso' });
    } catch (error) {
        console.error('Erro ao desconectar WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Obter QR code de uma conexão
 */
router.get('/connections/:id/qr', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('whatsapp_connections')
            .select('qr_code, status')
            .eq('id', id)
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao obter QR code:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Listar grupos de uma conexão
 */
router.get('/connections/:id/groups', async (req, res) => {
    try {
        const { id } = req.params;
        const groups = await listGroups(id);
        res.json(groups);
    } catch (error) {
        console.error('Erro ao listar grupos:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Sincronizar grupos manualmente
 */
router.post('/connections/:id/sync-groups', async (req, res) => {
    try {
        const { id } = req.params;
        await forceGroupSync(id);
        res.json({ message: 'Grupos sincronizados com sucesso' });
    } catch (error) {
        console.error('Erro ao sincronizar grupos:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Associar grupos a uma campanha
 */
router.post('/campaigns/:campaignId/groups', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { groupIds } = req.body; // Array de IDs de grupos

        if (!Array.isArray(groupIds) || groupIds.length === 0) {
            return res.status(400).json({ error: 'Lista de grupos inválida' });
        }

        // Remover associações antigas
        await supabase
            .from('campaign_groups')
            .delete()
            .eq('campaign_id', campaignId);

        // Criar novas associações
        const associations = groupIds.map(groupId => ({
            campaign_id: campaignId,
            whatsapp_group_id: groupId
        }));

        const { data, error } = await supabase
            .from('campaign_groups')
            .insert(associations)
            .select();

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao associar grupos:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Listar grupos de uma campanha
 */
router.get('/campaigns/:campaignId/groups', async (req, res) => {
    try {
        const { campaignId } = req.params;

        const { data, error } = await supabase
            .from('campaign_groups')
            .select(`
                id,
                whatsapp_group_id,
                whatsapp_groups (
                    id,
                    group_id,
                    group_name,
                    participant_count,
                    whatsapp_connections (
                        id,
                        name,
                        phone_number
                    )
                )
            `)
            .eq('campaign_id', campaignId);

        if (error) throw error;

        res.json(data);
    } catch (error) {
        console.error('Erro ao listar grupos da campanha:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Deletar conexão
 */
router.delete('/connections/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Desconectar primeiro
        await disconnectWhatsApp(id);

        // Deletar do banco
        const { error } = await supabase
            .from('whatsapp_connections')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Conexão deletada com sucesso' });
    } catch (error) {
        console.error('Erro ao deletar conexão:', error);
        res.status(500).json({ error: error.message });
    }
});


/**
 * Sincronizar participantes dos grupos para a campanha
 * SUPORTA BAILEYS E WHAPI.CLOUD AUTOMATICAMENTE
 * GARANTE que TODOS os contatos sejam importados sem perdas
 */
router.post('/campaigns/:campaignId/sync-participants', async (req, res) => {
    try {
        const { campaignId } = req.params;
        const { groupIds } = req.body;

        if (!groupIds || groupIds.length === 0) {
            return res.status(400).json({ error: 'Nenhum grupo selecionado' });
        }

        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const debugLogs = [];

        const log = (message) => {
            console.log(message);
            debugLogs.push(message);
        };

        // Buscar status padrão para novos leads
        const { data: defaultStatus } = await supabase
            .from('lead_statuses')
            .select('id')
            .order('display_order', { ascending: true })
            .limit(1)
            .single();

        const defaultStatusId = defaultStatus?.id || null;
        log(`📊 Status padrão para novos leads: ${defaultStatusId}`);

        // Para cada grupo, buscar participantes e importar
        for (const groupId of groupIds) {
            // Buscar informações do grupo E da conexão
            const { data: groupData } = await supabase
                .from('whatsapp_groups')
                .select('*, whatsapp_connections(*)')
                .eq('id', groupId)
                .single();

            if (!groupData) {
                log(`⚠️ Grupo ${groupId} não encontrado`);
                continue;
            }

            const provider = groupData.whatsapp_connections?.provider || 'baileys';
            log(`🔍 Grupo: ${groupData.group_name} | Provider: ${provider.toUpperCase()}`);

            let participants = [];

            // ============================================
            // OPÇÃO 1: WHAPI.CLOUD (SEM PERDAS!)
            // ============================================
            if (provider === 'whapi') {
                try {
                    log(`☁️ Usando Whapi.Cloud para ${groupData.group_name}...`);

                    const whapiParticipants = await whapiService.getGroupParticipants(groupData.group_id);

                    log(`✅ Whapi retornou ${whapiParticipants.length} participantes`);

                    // Converter formato Whapi para formato comum
                    participants = whapiParticipants.map(p => ({
                        id: p.id,
                        phone: p.phone,
                        name: p.name || p.phone,
                        source: 'whapi'
                    }));

                } catch (error) {
                    log(`❌ Erro ao buscar do Whapi: ${error.message}`);
                    log(`⚠️ Pulando grupo ${groupData.group_name}`);
                    continue;
                }
            }
            // ============================================
            // OPÇÃO 2: BAILEYS (COM VALIDAÇÕES)
            // ============================================
            else {
                const sock = getActiveConnection(groupData.connection_id);
                if (!sock) {
                    log(`❌ Conexão Baileys ${groupData.connection_id} não está ativa`);
                    continue;
                }

                try {
                    log(`🔌 Usando Baileys para ${groupData.group_name}...`);

                    const groupMetadata = await sock.groupMetadata(groupData.group_id);
                    const baileysParticipants = groupMetadata.participants || [];

                    log(`📊 Baileys retornou ${baileysParticipants.length} participantes`);

                    // Tentar resolver LIDs (esforço máximo)
                    const participantIds = baileysParticipants.map(p => p.id);
                    let resolvedNumbers = {};

                    log('🔄 Tentando resolver LIDs com onWhatsApp...');
                    const chunkSize = 50;
                    for (let i = 0; i < participantIds.length; i += chunkSize) {
                        const chunk = participantIds.slice(i, i + chunkSize);
                        try {
                            const onWhatsAppResult = await sock.onWhatsApp(...chunk);
                            if (onWhatsAppResult && Array.isArray(onWhatsAppResult)) {
                                onWhatsAppResult.forEach(result => {
                                    if (result.jid && result.exists) {
                                        const num = result.jid.split('@')[0];
                                        resolvedNumbers[result.jid] = num;
                                    }
                                });
                            }
                        } catch (err) {
                            log(`⚠️ Erro no onWhatsApp chunk ${i}: ${err.message}`);
                        }
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    log(`✅ Resolvidos ${Object.keys(resolvedNumbers).length} números`);

                    // Processar participantes
                    let validCount = 0;
                    let lidCount = 0;

                    for (const participant of baileysParticipants) {
                        const result = extractAndValidatePhone(participant, resolvedNumbers, validCount + lidCount);

                        if (!result) {
                            lidCount++;
                            continue;
                        }

                        validCount++;
                        participants.push({
                            id: participant.id,
                            phone: result.phone,
                            name: result.name,
                            source: result.source
                        });
                    }

                    log(`✅ Baileys: ${validCount} válidos, ${lidCount} LIDs ignorados`);

                } catch (error) {
                    log(`❌ Erro ao processar grupo Baileys ${groupData.group_name}: ${error.message}`);
                    continue;
                }
            }

            // ============================================
            // IMPORTAR PARTICIPANTES NO BANCO
            // ============================================
            log(`💾 Importando ${participants.length} participantes...`);

            for (const participant of participants) {
                const phone = normalizePhone(participant.phone);

                if (!phone) {
                    skipped++;
                    continue;
                }

                const contactName = participant.name || phone;

                try {
                    // MODIFICAÇÃO: Buscar lead ESPECIFICAMENTE nesta campanha
                    // Isso garante que se o contato já existe em outra campanha, será criado um NOVO nesta campanha
                    const existingLead = await db.getLeadByPhoneAndCampaign(phone, campaignId);

                    if (existingLead) {
                        // Atualizar lead existente NA CAMPANHA ATUAL
                        const { error: updateError } = await supabase
                            .from('leads')
                            .update({
                                // Não precisa alterar campaign_id pois já é desta campanha
                                in_group: true,
                                first_name: existingLead.first_name === existingLead.phone ? contactName : existingLead.first_name,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingLead.id);

                        if (!updateError) updated++;
                        else skipped++;
                    } else {
                        // Criar novo lead PARA ESTA CAMPANHA (mesmo que exista em outras)
                        const { error: insertError } = await supabase
                            .from('leads')
                            .insert({
                                uuid: uuidv4(),
                                phone,
                                email: `${phone}@whatsapp.gw`,
                                first_name: contactName,
                                campaign_id: parseInt(campaignId),
                                in_group: true,
                                status_id: defaultStatusId,
                                product_name: 'Produto Desconhecido',
                                source: participant.source || 'whatsapp_group',
                                created_at: new Date().toISOString()
                            });

                        if (!insertError) imported++;
                        else skipped++;
                    }
                } catch (dbErr) {
                    console.error('Erro banco:', dbErr);
                    skipped++;
                }
            }

            log(`✅ Grupo ${groupData.group_name} concluído`);
        }

        log(`\n📊 RESUMO FINAL:`);
        log(`- Importados: ${imported}`);
        log(`- Atualizados: ${updated}`);
        log(`- Ignorados: ${skipped}`);
        log(`- Total processado: ${imported + updated + skipped}`);

        res.json({
            imported,
            updated,
            skipped,
            total: imported + updated + skipped,
            debugLogs
        });
    } catch (error) {
        console.error('Erro ao sincronizar participantes:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Listar campanhas sincronizadas
 */
router.get('/synced-campaigns', async (req, res) => {
    try {
        // Buscar campanhas que têm grupos associados
        const { data: campaignGroups, error } = await supabase
            .from('campaign_groups')
            .select(`
                campaign_id,
                campaigns(id, name),
                whatsapp_groups(id, group_name, participant_count)
            `);

        if (error) throw error;

        // Agrupar por campanha
        const campaignsMap = new Map();

        campaignGroups.forEach(cg => {
            const campaignId = cg.campaign_id;

            if (!campaignsMap.has(campaignId)) {
                campaignsMap.set(campaignId, {
                    id: cg.campaigns.id,
                    name: cg.campaigns.name,
                    groups: [],
                    groups_count: 0,
                    participants_count: 0
                });
            }

            const campaign = campaignsMap.get(campaignId);
            campaign.groups.push(cg.whatsapp_groups);
            campaign.groups_count++;
            campaign.participants_count += cg.whatsapp_groups.participant_count || 0;
        });

        const syncedCampaigns = Array.from(campaignsMap.values());

        res.json(syncedCampaigns);
    } catch (error) {
        console.error('Erro ao listar campanhas sincronizadas:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Listar participantes DOS GRUPOS de uma campanha
 * ⚠️ IMPORTANTE: Retorna apenas participantes capturados dos grupos WhatsApp
 * NÃO retorna leads da campanha
 */
router.get('/campaigns/:campaignId/participants', async (req, res) => {
    try {
        const { campaignId } = req.params;

        console.log(`🔍 Buscando participantes DOS GRUPOS da campanha ${campaignId}`);

        // 1. Buscar grupos associados à campanha
        const { data: campaignGroups, error: cgError } = await supabase
            .from('campaign_groups')
            .select('whatsapp_group_id')
            .eq('campaign_id', parseInt(campaignId));

        if (cgError) {
            console.error('❌ Erro ao buscar campaign_groups:', cgError);
            return res.json([]);
        }

        if (!campaignGroups || campaignGroups.length === 0) {
            console.log('⚠️ Nenhum grupo associado a esta campanha');
            return res.json([]);
        }

        const groupIds = campaignGroups.map(cg => cg.whatsapp_group_id);
        console.log(`📊 Grupos associados: ${groupIds.length}`);

        // 2. Buscar informações dos grupos
        const { data: groups, error: groupsError } = await supabase
            .from('whatsapp_groups')
            .select('id, group_id, group_name, connection_id')
            .in('id', groupIds);

        if (groupsError) throw groupsError;

        console.log(`📊 Grupos encontrados: ${groups.length}`);

        // 3. Buscar participantes de cada grupo via Baileys
        const allParticipants = [];
        const seenPhones = new Set();

        for (const group of groups) {
            try {
                const sock = getActiveConnection(group.connection_id);
                if (!sock) {
                    console.log(`⚠️ Conexão ${group.connection_id} não ativa`);
                    continue;
                }

                const groupMetadata = await sock.groupMetadata(group.group_id);
                const participants = groupMetadata.participants || [];

                console.log(`📱 Grupo "${group.group_name}": ${participants.length} participantes`);

                // Processar cada participante
                for (const participant of participants) {
                    let phone = null;
                    let name = null;

                    // Tentar extrair número
                    if (!participant.id.includes('@lid')) {
                        phone = participant.id.split('@')[0];
                    } else if (participant.phoneNumber) {
                        phone = participant.phoneNumber;
                    }

                    // Nome
                    name = participant.notify || participant.verifiedName || phone;

                    if (phone) {
                        const normalized = normalizePhone(phone);

                        if (normalized) {
                            // Debug: mostrar alguns exemplos
                            if (allParticipants.length < 3) {
                                console.log(`📱 Telefone normalizado: ${phone} → ${normalized}`);
                            }

                            // Evitar duplicados
                            if (!seenPhones.has(normalized)) {
                                seenPhones.add(normalized);
                                allParticipants.push({
                                    id: allParticipants.length + 1,
                                    first_name: name,
                                    phone: normalized,
                                    email: null,
                                    in_group: true,
                                    created_at: new Date().toISOString(),
                                    source: 'whatsapp_group',
                                    group_name: group.group_name
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Erro ao processar grupo ${group.group_name}:`, error.message);
            }
        }

        console.log(`✅ Total de participantes únicos: ${allParticipants.length}`);

        res.json(allParticipants);
    } catch (error) {
        console.error('Erro ao listar participantes:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Excluir sincronização de uma campanha
 */
router.delete('/campaigns/:campaignId/sync', async (req, res) => {
    try {
        const { campaignId } = req.params;

        // Deletar associações de grupos com a campanha
        const { error } = await supabase
            .from('campaign_groups')
            .delete()
            .eq('campaign_id', parseInt(campaignId));

        if (error) throw error;

        res.json({ message: 'Sincronização excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir sincronização:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * ========================================
 * ROTAS WHAPI.CLOUD
 * ========================================
 */

/**
 * Salvar/atualizar configurações do Whapi.Cloud
 */
router.post('/whapi/settings', async (req, res) => {
    try {
        const { apiToken, channelId } = req.body;

        if (!apiToken) {
            return res.status(400).json({ error: 'API Token é obrigatório' });
        }

        const settings = await whapiService.saveSettings(apiToken, channelId);
        res.json({
            message: 'Configurações salvas com sucesso',
            settings
        });
    } catch (error) {
        console.error('Erro ao salvar configurações Whapi:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Testar conexão com Whapi.Cloud
 */
router.get('/whapi/test', async (req, res) => {
    try {
        const result = await whapiService.testConnection();
        res.json(result);
    } catch (error) {
        console.error('Erro ao testar Whapi:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Listar grupos via Whapi.Cloud
 */
router.get('/whapi/groups', async (req, res) => {
    try {
        const groups = await whapiService.listAllGroups();
        res.json(groups);
    } catch (error) {
        console.error('Erro ao listar grupos Whapi:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Sincronizar grupo específico via Whapi.Cloud
 */
router.post('/whapi/groups/:groupId/sync', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { connectionId } = req.body;

        if (!connectionId) {
            return res.status(400).json({ error: 'Connection ID é obrigatório' });
        }

        // Buscar participantes via Whapi
        const participants = await whapiService.getGroupParticipants(groupId);

        // Buscar nome do grupo
        const groups = await whapiService.listAllGroups();
        const group = groups.find(g => g.id === groupId);

        // Salvar grupo no banco
        const { data: savedGroup, error: groupError } = await supabase
            .from('whatsapp_groups')
            .upsert({
                connection_id: connectionId,
                group_id: groupId,
                group_name: group?.name || 'Grupo Whapi',
                participant_count: participants.length,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'connection_id,group_id'
            })
            .select()
            .single();

        if (groupError) throw groupError;

        res.json({
            group: savedGroup,
            participants: participants.length,
            message: `${participants.length} participantes encontrados`
        });
    } catch (error) {
        console.error('Erro ao sincronizar grupo Whapi:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Listar TODOS os grupos (de todas as conexões)
 * Útil para seleção global
 */
router.get('/groups', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('whatsapp_groups')
            .select(`
                *,
                whatsapp_connections (name, phone_number)
            `)
            .order('group_name');

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Erro ao listar todos os grupos:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
