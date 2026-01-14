/**
 * WhatsApp Service usando Baileys
 * Gerencia conexões, QR codes e listagem de grupos
 */

import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    initAuthCreds,
    BufferJSON,
    isJidBroadcast,
    proto
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import QRCode from 'qrcode';
import { supabase } from '../database/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Armazenar conexões ativas em memória
const activeConnections = new Map();

// Logger
const logger = pino({ level: 'silent' }); // Silencioso para produção

/**
 * Custom auth state using Supabase instead of filesystem
 * This prevents session loss on deploy/restart
 */
async function useSupabaseAuthState(connectionId) {
    // Helper to revive JSON with Buffers
    const reviveAuthState = (key, value) => {
        return BufferJSON.reviver(key, value);
    };

    // Load existing state from database
    const { data } = await supabase
        .from('whatsapp_auth_state')
        .select('creds, keys')
        .eq('connection_id', connectionId)
        .single();

    // Initialize creds
    let creds;
    let keys = {};

    if (data && data.creds) {
        // Revive creds (convert Buffer string representations back to Buffers)
        creds = JSON.parse(JSON.stringify(data.creds), reviveAuthState);
    } else {
        creds = await initAuthCreds();
    }

    if (data && data.keys) {
        // Revive keys
        keys = JSON.parse(JSON.stringify(data.keys), reviveAuthState);
    }

    console.log(`📊 Estado da sessão carregado (Keys: ${Object.keys(keys).length})`);

    // Debounce save function to prevent database flooding
    let saveTimeout;
    const saveState = async () => {
        if (saveTimeout) clearTimeout(saveTimeout);

        saveTimeout = setTimeout(async () => {
            try {
                // Serialize with BufferJSON replacer
                const credsJSON = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
                const keysJSON = JSON.parse(JSON.stringify(keys, BufferJSON.replacer));

                await supabase
                    .from('whatsapp_auth_state')
                    .upsert({
                        connection_id: connectionId,
                        creds: credsJSON,
                        keys: keysJSON,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'connection_id'
                    });
                // console.log('💾 Credenciais salvas no Supabase (Debounced)');
            } catch (error) {
                console.error('❌ Erro ao salvar credenciais:', error);
            }
        }, 2000); // Wait 2s before saving
    };

    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    ids.forEach(id => {
                        const key = `${type}-${id}`;
                        let value = keys[key];
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    });
                    return data;
                },
                set: async (data) => {
                    let hasChanges = false;
                    for (const type in data) {
                        for (const id in data[type]) {
                            const key = `${type}-${id}`;
                            const value = data[type][id];
                            if (value) {
                                keys[key] = value;
                                hasChanges = true;
                            } else {
                                delete keys[key];
                                hasChanges = true;
                            }
                        }
                    }
                    if (hasChanges) {
                        await saveState();
                    }
                }
            }
        },
        saveCreds: async () => {
            await saveState();
        }
    };
}

/**
 * Inicializar conexão WhatsApp com suporte a Pairing Code
 * @param {string} connectionId - ID da conexão
 * @param {boolean} usePairingCode - Se true, usa código de pareamento em vez de QR code
 * @param {string} phoneNumber - Número de telefone para pairing code (formato: 5511999999999)
 */
export async function initializeWhatsAppConnection(connectionId, usePairingCode = false, phoneNumber = null) {
    try {
        console.log(`🔄 Iniciando conexão WhatsApp: ${connectionId}`);
        console.log(`📱 Método: ${usePairingCode ? 'PAIRING CODE (Redirect+)' : 'QR CODE'}`);
        console.log(`💾 Usando Supabase para persistência de sessão`);

        // Use Supabase for auth state instead of filesystem
        const { state, saveCreds } = await useSupabaseAuthState(connectionId);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger,
            printQRInTerminal: false,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            browser: ['Recovery CRM', 'Chrome', '1.0.0'],
        });

        // Armazenar conexão ativa
        activeConnections.set(connectionId, sock);

        // Se usar pairing code, gerar código
        if (usePairingCode && phoneNumber && !state.creds.registered) {
            console.log(`📞 Gerando código de pareamento para: ${phoneNumber}`);

            // Remover caracteres não numéricos
            const cleanPhone = phoneNumber.replace(/\D/g, '');

            try {
                const code = await sock.requestPairingCode(cleanPhone);
                console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code}`);

                // Salvar código no banco
                await supabase
                    .from('whatsapp_connections')
                    .update({
                        pairing_code: code,
                        pairing_phone: cleanPhone,
                        status: 'waiting_pairing',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', connectionId);

                console.log(`✅ Código salvo. Insira o código ${code} no WhatsApp do número ${phoneNumber}`);
            } catch (pairingError) {
                console.error('❌ Erro ao gerar código de pareamento:', pairingError);
                throw pairingError;
            }
        }

        // Event: QR Code ou Pairing Code
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`📱 QR Code gerado para conexão ${connectionId}`);
                const qrCodeDataURL = await QRCode.toDataURL(qr);

                // Salvar QR no banco
                await supabase
                    .from('whatsapp_connections')
                    .update({
                        qr_code: qrCodeDataURL,
                        status: 'connecting',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', connectionId);
            }

            if (connection === 'close') {
                // Verificar se o erro foi rate-limit
                const isRateLimit = lastDisconnect?.error?.message?.includes('rate-overlimit')
                    || lastDisconnect?.error?.data === 429;

                if (isRateLimit) {
                    console.log('⏰ Conexão fechada por rate-limit. NÃO reconectando automaticamente.');
                    console.log('💡 Aguarde 60 segundos e reconecte manualmente.');

                    // Atualizar status no banco
                    await supabase
                        .from('whatsapp_connections')
                        .update({
                            status: 'disconnected',
                            qr_code: null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', connectionId);

                    activeConnections.delete(connectionId);
                    return; // NÃO reconectar
                }

                const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                    ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                    : true;

                console.log('❌ Conexão fechada. Reconectar?', shouldReconnect);

                if (shouldReconnect) {
                    setTimeout(() => initializeWhatsAppConnection(connectionId), 3000);
                } else {
                    activeConnections.delete(connectionId);

                    // Limpar sessão do Supabase ao desconectar/logout via evento
                    try {
                        console.log(`🗑️ Removendo sessão do Supabase (evento close): ${connectionId}`);
                        await supabase
                            .from('whatsapp_auth_state')
                            .delete()
                            .eq('connection_id', connectionId);
                    } catch (err) {
                        console.error('Erro ao remover sessão do Supabase:', err);
                    }

                    await supabase
                        .from('whatsapp_connections')
                        .update({
                            status: 'disconnected',
                            qr_code: null,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', connectionId);
                }
            } else if (connection === 'open') {
                console.log('✅ Conectado ao WhatsApp!');

                // Obter informações do usuário
                const phoneNumber = sock.user?.id?.split(':')[0] || 'Desconhecido';

                await supabase
                    .from('whatsapp_connections')
                    .update({
                        status: 'connected',
                        phone_number: phoneNumber,
                        qr_code: null,
                        last_connected_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', connectionId);

                // Sincronizar grupos (com proteção contra crash)
                try {
                    await syncWhatsAppGroups(connectionId, sock);
                } catch (syncError) {
                    console.error('⚠️ Erro ao sincronizar grupos (não crítico):', syncError.message);
                    // Não propagar erro - servidor continua funcionando
                }
            }
        });

        // Event: Salvar credenciais
        sock.ev.on('creds.update', saveCreds);

        return sock;
    } catch (error) {
        console.error('❌ Erro ao inicializar WhatsApp:', error);
        throw error;
    }
}

/**
 * Sincronizar grupos do WhatsApp
 */
async function syncWhatsAppGroups(connectionId, sock) {
    try {
        console.log('🔄 Sincronizando grupos...');
        console.log('📱 Connection ID:', connectionId);
        console.log('🔌 Socket ativo:', !!sock);

        // Aguardar 2 segundos antes de buscar grupos (evitar rate-limit)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Buscar todos os grupos
        const groups = await sock.groupFetchAllParticipating();
        const groupList = Object.values(groups);

        console.log(`📊 ${groupList.length} grupos encontrados`);

        if (groupList.length === 0) {
            console.log('⚠️ Nenhum grupo encontrado no WhatsApp');
            return;
        }

        // Salvar grupos no banco (com delay entre cada um)
        for (const group of groupList) {
            console.log(`💾 Salvando grupo: ${group.subject} (${group.participants?.length || 0} participantes)`);

            const { data, error } = await supabase
                .from('whatsapp_groups')
                .upsert({
                    connection_id: connectionId,
                    group_id: group.id,
                    group_name: group.subject,
                    participant_count: group.participants?.length || 0,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'connection_id,group_id'
                });

            if (error) {
                console.error('❌ Erro ao salvar grupo:', error);
            } else {
                console.log('✅ Grupo salvo com sucesso');
            }

            // Pequeno delay entre grupos (100ms)
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log('✅ Grupos sincronizados!');
    } catch (error) {
        console.error('❌ Erro ao sincronizar grupos:', error);
        console.error('Stack:', error.stack);

        // Se for rate-limit, avisar e NÃO tentar reconectar imediatamente
        if (error.message?.includes('rate-overlimit') || error.data === 429) {
            console.log('⏰ Rate limit atingido. Aguarde 60 segundos antes de tentar novamente.');
            throw error; // Propagar erro para evitar reconexão automática
        }
    }
}

/**
 * Obter conexão ativa
 */
export function getActiveConnection(connectionId) {
    return activeConnections.get(connectionId);
}

/**
 * Desconectar WhatsApp
 */
export async function disconnectWhatsApp(connectionId) {
    const sock = activeConnections.get(connectionId);
    if (sock) {
        try {
            console.log(`🔌 Encerrando socket para: ${connectionId}`);
            // Tentar fechar socket graciosamente
            if (sock.ws) sock.ws.close();
            sock.end(undefined);
        } catch (err) {
            console.error('Erro ao fechar socket:', err);
        }
        activeConnections.delete(connectionId);
    }

    // Limpar sessão do Supabase para garantir novo QR code
    try {
        console.log(`🗑️ Removendo sessão do Supabase: ${connectionId}`);
        await supabase
            .from('whatsapp_auth_state')
            .delete()
            .eq('connection_id', connectionId);
    } catch (err) {
        console.error('Erro ao remover sessão do Supabase:', err);
    }

    await supabase
        .from('whatsapp_connections')
        .update({
            status: 'disconnected',
            qr_code: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', connectionId);
}

/**
 * Listar grupos de uma conexão
 */
export async function listGroups(connectionId) {
    const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('connection_id', connectionId)
        .order('group_name');

    if (error) throw error;
    return data;
}

/**
 * Forçar sincronização de grupos
 */
export async function forceGroupSync(connectionId) {
    const sock = activeConnections.get(connectionId);
    if (!sock) {
        throw new Error('Conexão não está ativa. Tente reconectar o dispositivo.');
    }
    await syncWhatsAppGroups(connectionId, sock);
}

/**
 * Remover participante de um grupo
 * @param {string} connectionId - ID da conexão
 * @param {string} groupId - ID do grupo (JID)
 * @param {string} participantId - ID do participante (JID/Telefone com @s.whatsapp.net)
 */
export async function removeParticipant(connectionId, groupId, participantId) {
    const sock = activeConnections.get(connectionId);
    if (!sock) {
        throw new Error('Conexão não está ativa.');
    }

    try {
        console.log(`🔨 Removendo participante ${participantId} do grupo ${groupId}...`);

        // Formatar participantId se necessário (adicionar @s.whatsapp.net se for só número)
        let jid = participantId;
        if (!jid.includes('@')) {
            jid = `${jid}@s.whatsapp.net`;
        }

        // Executar remoção
        await sock.groupParticipantsUpdate(
            groupId,
            [jid],
            'remove' // action: add, remove, promote, demote
        );

        console.log(`✅ Participante ${jid} removido com sucesso!`);
        return true;
    } catch (error) {
        console.error(`❌ Erro ao remover participante:`, error);
        throw error;
    }
}

/**
 * Restaurar sessões ativas ao iniciar o servidor
 */
export async function restoreSessions() {
    try {
        console.log('🔄 Verificando sessões para restaurar...');

        const { data: connections, error } = await supabase
            .from('whatsapp_connections')
            .select('id, name')
            .eq('status', 'connected');

        if (error) throw error;

        console.log(`📊 Encontradas ${connections.length} conexões marcadas como ativas`);

        for (const conn of connections) {
            // Check if session exists in Supabase
            const { data: authState } = await supabase
                .from('whatsapp_auth_state')
                .select('connection_id')
                .eq('connection_id', conn.id)
                .single();

            if (authState) {
                console.log(`🔌 Restaurando sessão do Supabase: ${conn.name} (${conn.id})`);
                initializeWhatsAppConnection(conn.id).catch(err => {
                    console.error(`❌ Falha ao restaurar sessão ${conn.name}:`, err);
                });
            } else {
                console.log(`⚠️ Sessão ${conn.name} não possui dados de autenticação no Supabase. Marcando como desconectada.`);
                await supabase
                    .from('whatsapp_connections')
                    .update({ status: 'disconnected' })
                    .eq('id', conn.id);
            }
        }
    } catch (error) {
        console.error('❌ Erro ao restaurar sessões:', error);
    }
}
