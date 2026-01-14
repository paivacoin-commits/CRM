import { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Trash2, Plus, Check, Users, Search, Download } from 'lucide-react';
import '../styles/Groups.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Groups() {
    const [activeTab, setActiveTab] = useState('connect'); // 'connect', 'select', 'synced'
    const [connections, setConnections] = useState([]);
    const [selectedConnection, setSelectedConnection] = useState(null);
    const [qrCode, setQrCode] = useState(null);
    const [groups, setGroups] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaign, setSelectedCampaign] = useState('');
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newConnectionName, setNewConnectionName] = useState('');
    const [showNewConnectionModal, setShowNewConnectionModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); // Busca de grupos
    const [participantSearchTerm, setParticipantSearchTerm] = useState(''); // Busca de participantes
    const [syncedCampaigns, setSyncedCampaigns] = useState([]); // Campanhas sincronizadas
    const [syncing, setSyncing] = useState(false); // Estado de sincronização
    const [selectedCampaignId, setSelectedCampaignId] = useState(null); // Campanha selecionada para ver participantes
    const [participants, setParticipants] = useState([]); // Participantes da campanha
    const [showConnectionModal, setShowConnectionModal] = useState(false); // Modal de escolha de método
    const [connectionIdToConnect, setConnectionIdToConnect] = useState(null); // ID da conexão sendo conectada
    const [usePairingCode, setUsePairingCode] = useState(false); // Se usa pairing code
    const [pairingPhoneNumber, setPairingPhoneNumber] = useState(''); // Número para pairing code
    const [pairingCode, setPairingCode] = useState(''); // Código de pareamento gerado

    // Função para formatar número de telefone brasileiro
    const formatPhoneNumber = (phone) => {
        if (!phone) return '-';

        // Remove caracteres não numéricos
        const cleaned = phone.replace(/\D/g, '');

        // Se for número brasileiro (começa com 55 e tem 13 dígitos)
        if (cleaned.startsWith('55') && cleaned.length === 13) {
            return cleaned; // Retorna apenas os dígitos: 5562999981718
        }

        // Se for número brasileiro sem DDI (11 dígitos) - adicionar 55
        if (cleaned.length === 11) {
            return `55${cleaned}`; // Adiciona 55 no início: 5562999981718
        }

        // Se for número com 10 dígitos (sem o 9) - adicionar 55
        if (cleaned.length === 10) {
            return `55${cleaned}`; // Adiciona 55 no início: 556299981718
        }

        // Para números internacionais (não brasileiros)
        if (cleaned.length > 10 && !cleaned.startsWith('55')) {
            return cleaned; // Retorna apenas os dígitos
        }

        // Retornar o número limpo se não se encaixar nos padrões
        return cleaned || phone;
    };

    // Carregar conexões
    useEffect(() => {
        loadConnections();
        loadCampaigns();

        // Polling para atualizar conexões a cada 3 segundos
        const interval = setInterval(() => {
            loadConnections();
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // Polling para QR code e status
    useEffect(() => {
        if (selectedConnection && selectedConnection.status === 'connecting') {
            const interval = setInterval(() => {
                fetchQRCode(selectedConnection.id);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [selectedConnection]);

    async function loadConnections() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/whatsapp-groups/connections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                console.error('Erro ao carregar conexões:', res.status);
                setConnections([]);
                return;
            }
            const data = await res.json();
            setConnections(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Erro ao carregar conexões:', error);
            setConnections([]);
        }
    }

    async function loadCampaigns() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/campaigns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                console.error('Erro ao carregar campanhas:', res.status);
                setCampaigns([]);
                return;
            }
            const data = await res.json();
            // A API pode retornar { campaigns: [...] } ou diretamente [...]
            const campaignsArray = data.campaigns || data;
            setCampaigns(Array.isArray(campaignsArray) ? campaignsArray : []);
        } catch (error) {
            console.error('Erro ao carregar campanhas:', error);
            setCampaigns([]);
        }
    }

    async function createConnection() {
        if (!newConnectionName.trim()) {
            alert('Digite um nome para a conexão');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/whatsapp-groups/connections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newConnectionName })
            });
            const data = await res.json();
            setConnections([...connections, data]);
            setNewConnectionName('');
            setShowNewConnectionModal(false);
        } catch (error) {
            console.error('Erro ao criar conexão:', error);
            alert('Erro ao criar conexão');
        } finally {
            setLoading(false);
        }
    }

    async function connectWhatsApp(connectionId) {
        try {
            setLoading(true);
            setQrCode(null);
            const token = localStorage.getItem('token');

            const res = await fetch(`${API_URL}/whatsapp-groups/connections/${connectionId}/connect`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}) // QR Code por padrão
            });

            if (!res.ok) throw new Error('Erro ao conectar');

            // Atualizar conexão selecionada
            const connection = connections.find(c => c.id === connectionId);
            setSelectedConnection({ ...connection, status: 'connecting' });

            // Começar a buscar QR code (delay maior para dar tempo do backend gerar)
            setTimeout(() => fetchQRCode(connectionId), 3000);
        } catch (error) {
            console.error('Erro ao conectar WhatsApp:', error);
            alert('Erro ao conectar WhatsApp: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    async function fetchQRCode(connectionId) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/whatsapp-groups/connections/${connectionId}/qr`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.qr_code) {
                setQrCode(data.qr_code);
            }

            if (data.status === 'connected') {
                setQrCode(null);
                loadConnections();
                loadGroups(connectionId);
            }

            // Atualizar status da conexão
            setSelectedConnection(prev => prev ? { ...prev, status: data.status } : null);
        } catch (error) {
            console.error('Erro ao buscar QR code:', error);
        }
    }

    async function disconnectWhatsApp(connectionId) {
        if (!confirm('Deseja realmente desconectar?')) return;

        try {
            setLoading(true);
            await fetch(`${API_URL}/whatsapp-groups/connections/${connectionId}/disconnect`, {
                method: 'POST'
            });
            loadConnections();
            setSelectedConnection(null);
            setQrCode(null);
        } catch (error) {
            console.error('Erro ao desconectar:', error);
            alert('Erro ao desconectar');
        } finally {
            setLoading(false);
        }
    }

    async function deleteConnection(connectionId) {
        if (!confirm('Deseja realmente deletar esta conexão?')) return;

        try {
            setLoading(true);
            await fetch(`${API_URL}/whatsapp-groups/connections/${connectionId}`, {
                method: 'DELETE'
            });
            loadConnections();
            setSelectedConnection(null);
        } catch (error) {
            console.error('Erro ao deletar conexão:', error);
            alert('Erro ao deletar conexão');
        } finally {
            setLoading(false);
        }
    }

    async function loadGroups(connectionId) {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/whatsapp-groups/connections/${connectionId}/groups`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setGroups(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Erro ao carregar grupos:', error);
        }
    }

    async function syncGroups(connectionId) {
        try {
            setLoading(true);
            await fetch(`${API_URL}/whatsapp-groups/connections/${connectionId}/sync-groups`, {
                method: 'POST'
            });
            loadGroups(connectionId);
            alert('Grupos sincronizados com sucesso!');
        } catch (error) {
            console.error('Erro ao sincronizar grupos:', error);
            alert('Erro ao sincronizar grupos');
        } finally {
            setLoading(false);
        }
    }

    async function associateGroupsToCampaign() {
        if (!selectedCampaign) {
            alert('Selecione uma campanha');
            return;
        }

        if (selectedGroups.length === 0) {
            alert('Selecione pelo menos um grupo');
            return;
        }

        if (!confirm(`Deseja associar ${selectedGroups.length} grupo(s) à campanha e importar todos os participantes como leads?`)) {
            return;
        }

        try {
            setSyncing(true);
            const token = localStorage.getItem('token');

            // 1. Associar grupos à campanha
            const resAssociate = await fetch(`${API_URL}/whatsapp-groups/campaigns/${selectedCampaign}/groups`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ groupIds: selectedGroups })
            });

            if (!resAssociate.ok) throw new Error('Erro ao associar grupos');

            // ⚠️ REMOVIDO: Não sincronizar participantes automaticamente
            // Participantes serão apenas visualizados, não importados para leads
            // const resSyncParticipants = await fetch(...);

            const result = await resAssociate.json();

            alert(`✅ Sucesso!\n\nGrupos associados à campanha com sucesso! Os participantes serão visualizados, mas não importados automaticamente como leads.`);

            setSelectedGroups([]);
            setActiveTab('synced'); // Mudar para aba de campanhas sincronizadas
            loadSyncedCampaigns(); // Carregar campanhas sincronizadas
        } catch (error) {
            console.error('Erro ao associar grupos:', error);
            alert('Erro: ' + error.message);
        } finally {
            setSyncing(false);
        }
    }

    async function loadSyncedCampaigns() {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/whatsapp-groups/synced-campaigns`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            setSyncedCampaigns(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Erro ao carregar campanhas sincronizadas:', error);
        }
    }

    async function loadParticipants(campaignId) {
        try {
            console.log('🔍 Carregando participantes da campanha:', campaignId);
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/whatsapp-groups/campaigns/${campaignId}/participants`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            console.log('📡 Resposta da API:', res.status);

            if (!res.ok) {
                console.error('❌ Erro na resposta:', res.status, res.statusText);
                alert(`Erro ao carregar participantes: ${res.status} ${res.statusText}`);
                return;
            }

            const data = await res.json();
            console.log('📊 Dados recebidos:', data);
            console.log('📊 Total de participantes:', data.length);

            // Debug: Mostrar alguns exemplos de números de telefone
            if (data.length > 0) {
                console.log('📱 Exemplos de telefones:', data.slice(0, 5).map(p => ({ phone: p.phone })));
            }

            setParticipants(Array.isArray(data) ? data : []);
            setSelectedCampaignId(campaignId);

            if (data.length === 0) {
                alert('ℹ️ Esta campanha não possui participantes importados ainda.\n\nDica: Associe grupos a esta campanha na aba "Selecionar Grupos"');
            } else {
                console.log(`✅ ${data.length} participantes carregados com sucesso`);
            }
        } catch (error) {
            console.error('❌ Erro ao carregar participantes:', error);
            alert('Erro ao carregar participantes: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    function exportParticipantsCSV(campaignId, campaignName) {
        if (participants.length === 0) {
            alert('Nenhum participante para exportar');
            return;
        }

        // Criar CSV
        const headers = ['Nome', 'Telefone', 'Email', 'Grupo', 'Data Importação'];
        const rows = participants.map(p => [
            p.first_name || formatPhoneNumber(p.phone),
            formatPhoneNumber(p.phone),
            p.email || '',
            p.in_group ? 'Sim' : 'Não',
            new Date(p.created_at).toLocaleDateString('pt-BR')
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `participantes_${campaignName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        alert(`✅ ${participants.length} participantes exportados com sucesso!`);
    }

    async function resyncCampaignParticipants(campaignId, campaignName) {
        if (!confirm(`Deseja ressincronizar todos os participantes da campanha "${campaignName}"?\n\nIsso irá atualizar a lista de participantes com os dados mais recentes dos grupos.`)) {
            return;
        }

        try {
            setSyncing(true);
            const token = localStorage.getItem('token');

            // Buscar grupos associados à campanha
            const campaign = syncedCampaigns.find(c => c.id === campaignId);
            if (!campaign || !campaign.groups) {
                alert('Nenhum grupo encontrado para esta campanha');
                return;
            }

            const groupIds = campaign.groups.map(g => g.id);

            // ⚠️ REMOVIDO: Não ressincronizar participantes
            // Participantes serão apenas visualizados, não importados para leads
            // const res = await fetch(`${API_URL}/whatsapp-groups/campaigns/${campaignId}/sync-participants`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'Authorization': `Bearer ${token}`
            //     },
            //     body: JSON.stringify({ groupIds })
            // });

            // if (!res.ok) throw new Error('Erro ao ressincronizar');

            // const result = await res.json();

            alert('✅ Grupos atualizados! Os participantes serão visualizados, mas não importados como leads.');

            // Recarregar campanhas
            loadSyncedCampaigns();

            // Se estava visualizando participantes, recarregar
            if (selectedCampaignId === campaignId) {
                loadParticipants(campaignId);
            }
        } catch (error) {
            console.error('Erro ao ressincronizar:', error);
            alert('Erro ao ressincronizar participantes: ' + error.message);
        } finally {
            setSyncing(false);
        }
    }

    async function deleteSyncedCampaign(campaignId, campaignName) {
        if (!confirm(`⚠️ ATENÇÃO!\n\nDeseja excluir a sincronização da campanha "${campaignName}"?\n\nIsso irá:\n- Remover a associação dos grupos com a campanha\n- Os participantes importados permanecerão como leads\n\nEsta ação não pode ser desfeita!`)) {
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const res = await fetch(`${API_URL}/whatsapp-groups/campaigns/${campaignId}/sync`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Erro ao excluir sincronização');

            alert('✅ Sincronização excluída com sucesso!');

            // Limpar participantes se estava visualizando esta campanha
            if (selectedCampaignId === campaignId) {
                setSelectedCampaignId(null);
                setParticipants([]);
            }

            // Recarregar campanhas
            loadSyncedCampaigns();
        } catch (error) {
            console.error('Erro ao excluir:', error);
            alert('Erro ao excluir sincronização: ' + error.message);
        } finally {
            setLoading(false);
        }
    }

    function toggleGroupSelection(groupId) {
        setSelectedGroups(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        );
    }

    // Filtrar grupos pela busca
    const filteredGroups = groups.filter(group =>
        group.group_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fade-in">
            {/* Page Header */}
            <div className="page-header">
                <h1 className="page-title">📱 Grupos WhatsApp</h1>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
                    Conecte dispositivos e associe grupos às campanhas
                </p>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'connect' ? 'active' : ''}`}
                    onClick={() => setActiveTab('connect')}
                >
                    <Smartphone size={18} />
                    Conectar Dispositivo
                </button>
                <button
                    className={`tab ${activeTab === 'select' ? 'active' : ''}`}
                    onClick={() => setActiveTab('select')}
                >
                    <Users size={18} />
                    Selecionar Grupos
                </button>
                <button
                    className={`tab ${activeTab === 'synced' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveTab('synced');
                        loadSyncedCampaigns();
                    }}
                >
                    <RefreshCw size={18} />
                    Campanhas Sincronizadas
                </button>
            </div>

            {/* Tab: Conectar Dispositivo */}
            {activeTab === 'connect' && (
                <div className="tab-content">
                    <div className="connections-header">
                        <h2>Conexões WhatsApp</h2>
                        <button
                            className="btn btn-primary"
                            onClick={() => setShowNewConnectionModal(true)}
                        >
                            <Plus size={18} />
                            Nova Conexão
                        </button>
                    </div>

                    <div className="connections-grid">
                        {connections.map(conn => (
                            <div key={conn.id} className={`connection-card ${conn.status}`}>
                                <div className="connection-header">
                                    <h3>{conn.name}</h3>
                                    <span className={`status-badge ${conn.status}`}>
                                        {conn.status === 'connected' ? '🟢 Conectado' :
                                            conn.status === 'connecting' ? '🟡 Conectando...' :
                                                '🔴 Desconectado'}
                                    </span>
                                </div>

                                {conn.phone_number && (
                                    <p className="phone-number">📞 {conn.phone_number}</p>
                                )}

                                <div className="connection-actions">
                                    {conn.status === 'disconnected' && (
                                        <button
                                            className="btn btn-success btn-sm"
                                            onClick={() => connectWhatsApp(conn.id)}
                                            disabled={loading}
                                        >
                                            <Smartphone size={16} />
                                            Conectar
                                        </button>
                                    )}

                                    {conn.status === 'connected' && (
                                        <>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => {
                                                    setSelectedConnection(conn);
                                                    loadGroups(conn.id);
                                                }}
                                            >
                                                <Users size={16} />
                                                Ver Grupos
                                            </button>
                                            <button
                                                className="btn btn-warning btn-sm"
                                                onClick={() => disconnectWhatsApp(conn.id)}
                                                disabled={loading}
                                            >
                                                Desconectar
                                            </button>
                                        </>
                                    )}

                                    {conn.status === 'connecting' && (
                                        <>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => {
                                                    setSelectedConnection(conn);
                                                    fetchQRCode(conn.id);
                                                }}
                                                disabled={loading}
                                            >
                                                <Smartphone size={16} />
                                                Ver QR Code
                                            </button>
                                            <button
                                                className="btn btn-warning btn-sm"
                                                onClick={() => disconnectWhatsApp(conn.id)}
                                                disabled={loading}
                                            >
                                                Cancelar
                                            </button>
                                        </>
                                    )}

                                    <button
                                        className="btn btn-danger btn-sm"
                                        onClick={() => deleteConnection(conn.id)}
                                        disabled={loading}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                {/* QR Code */}
                                {selectedConnection?.id === conn.id && qrCode && (
                                    <div className="qr-code-container">
                                        <p>Escaneie o QR Code no WhatsApp:</p>
                                        <img src={qrCode} alt="QR Code" />
                                        <p className="qr-instructions">
                                            WhatsApp → Mais opções → Aparelhos conectados → Conectar
                                        </p>
                                    </div>
                                )}

                                {/* Pairing Code */}
                                {selectedConnection?.id === conn.id && pairingCode && (
                                    <div className="qr-code-container" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '2rem', borderRadius: '16px' }}>
                                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}>🔑 Código de Pareamento</h3>
                                        <div style={{ background: 'rgba(255,255,255,0.2)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem' }}>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', letterSpacing: '0.5rem', fontFamily: 'monospace' }}>
                                                {pairingCode}
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1rem', borderRadius: '8px', fontSize: '0.875rem', lineHeight: '1.6' }}>
                                            <strong>📱 Como conectar:</strong><br />
                                            1. Abra o WhatsApp no número <strong>{pairingPhoneNumber}</strong><br />
                                            2. Vá em <strong>Configurações → Aparelhos Conectados</strong><br />
                                            3. Toque em <strong>Conectar com número de telefone</strong><br />
                                            4. Digite o código acima: <strong>{pairingCode}</strong><br />
                                            5. Aguarde a confirmação!
                                        </div>
                                    </div>
                                )}

                                {/* Lista de Grupos */}
                                {selectedConnection?.id === conn.id && conn.status === 'connected' && groups.length > 0 && (
                                    <div className="groups-list">
                                        <div className="groups-list-header">
                                            <h4>Grupos ({groups.length})</h4>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => syncGroups(conn.id)}
                                                disabled={loading}
                                            >
                                                <RefreshCw size={14} />
                                                Sincronizar
                                            </button>
                                        </div>
                                        <ul>
                                            {groups.map(group => (
                                                <li key={group.id}>
                                                    <span>{group.group_name}</span>
                                                    <span className="participant-count">
                                                        {group.participant_count} participantes
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab: Selecionar Grupos */}
            {activeTab === 'select' && (
                <div className="tab-content">
                    <h2>Associar Grupos a Campanhas</h2>

                    {/* Selecionar Campanha */}
                    <div className="form-group">
                        <label>Selecione a Campanha:</label>
                        <select
                            value={selectedCampaign}
                            onChange={(e) => setSelectedCampaign(e.target.value)}
                            className="form-control"
                        >
                            <option value="">-- Selecione uma campanha --</option>
                            {campaigns.map(campaign => (
                                <option key={campaign.id} value={campaign.id}>
                                    {campaign.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Selecionar Conexão */}
                    <div className="form-group">
                        <label>Selecione a Conexão WhatsApp:</label>
                        <select
                            value={selectedConnection?.id || ''}
                            onChange={(e) => {
                                const conn = connections.find(c => c.id === e.target.value);
                                setSelectedConnection(conn);
                                if (conn) loadGroups(conn.id);
                            }}
                            className="form-control"
                        >
                            <option value="">-- Selecione uma conexão --</option>
                            {connections.filter(c => c.status === 'connected').map(conn => (
                                <option key={conn.id} value={conn.id}>
                                    {conn.name} ({conn.phone_number})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Lista de Grupos para Seleção */}
                    {selectedConnection && groups.length > 0 && (
                        <div className="groups-selection">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0 }}>Selecione os Grupos:</h3>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    {selectedGroups.length} selecionado(s) de {filteredGroups.length}
                                </div>
                            </div>

                            {/* Barra de Pesquisa */}
                            <div className="search-box" style={{
                                position: 'relative',
                                marginBottom: '1.5rem'
                            }}>
                                <Search
                                    size={18}
                                    style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-secondary)'
                                    }}
                                />
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Pesquisar grupos..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    style={{
                                        paddingLeft: '40px',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '8px'
                                    }}
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontSize: '1.2rem'
                                        }}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {filteredGroups.length > 0 ? (
                                <>
                                    <div className="groups-grid">
                                        {filteredGroups.map(group => (
                                            <div
                                                key={group.id}
                                                className={`group-card ${selectedGroups.includes(group.id) ? 'selected' : ''}`}
                                                onClick={() => toggleGroupSelection(group.id)}
                                            >
                                                <div className="group-card-header">
                                                    <h4>{group.group_name}</h4>
                                                    {selectedGroups.includes(group.id) && (
                                                        <Check size={20} className="check-icon" />
                                                    )}
                                                </div>
                                                <p>{group.participant_count} participantes</p>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        className="btn btn-primary btn-lg"
                                        onClick={associateGroupsToCampaign}
                                        disabled={loading || !selectedCampaign || selectedGroups.length === 0}
                                    >
                                        Associar {selectedGroups.length} Grupo(s) à Campanha
                                    </button>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <p>🔍 Nenhum grupo encontrado com "{searchTerm}"</p>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setSearchTerm('')}
                                        style={{ marginTop: '1rem' }}
                                    >
                                        Limpar Pesquisa
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mensagem quando não há grupos */}
                    {selectedConnection && groups.length === 0 && (
                        <div className="empty-state">
                            <p>📭 Nenhum grupo encontrado para esta conexão.</p>
                            <p>Possíveis causas:</p>
                            <ul style={{ textAlign: 'left', maxWidth: '500px', margin: '1rem auto' }}>
                                <li>O WhatsApp conectado não participa de nenhum grupo</li>
                                <li>A sincronização ainda não foi executada</li>
                                <li>A conexão foi perdida antes da sincronização</li>
                            </ul>
                            <p><strong>Solução:</strong></p>
                            <p>Vá para a aba "Conectar Dispositivo" e:</p>
                            <ol style={{ textAlign: 'left', maxWidth: '500px', margin: '1rem auto' }}>
                                <li>Verifique se a conexão está "🟢 Conectado"</li>
                                <li>Clique em "Ver Grupos"</li>
                                <li>Clique em "Sincronizar" para forçar a sincronização</li>
                            </ol>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setActiveTab('connect');
                                    if (selectedConnection) {
                                        loadGroups(selectedConnection.id);
                                    }
                                }}
                                style={{ marginTop: '1rem' }}
                            >
                                Ir para Conectar Dispositivo
                            </button>
                        </div>
                    )}

                    {/* Mensagem quando não há conexões ativas */}
                    {!selectedConnection && connections.filter(c => c.status === 'connected').length === 0 && (
                        <div className="empty-state">
                            <p>⚠️ Nenhuma conexão WhatsApp ativa encontrada.</p>
                            <p>Você precisa conectar um dispositivo WhatsApp primeiro.</p>
                            <button
                                className="btn btn-primary"
                                onClick={() => setActiveTab('connect')}
                                style={{ marginTop: '1rem' }}
                            >
                                Ir para Conectar Dispositivo
                            </button>
                        </div>
                    )}

                    {/* Debug info */}
                    <div className="debug-info" style={{
                        marginTop: '2rem',
                        padding: '1rem',
                        background: '#f3f4f6',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                    }}>
                        <details>
                            <summary style={{ cursor: 'pointer', fontWeight: '500' }}>🔍 Informações de Debug</summary>
                            <div style={{ marginTop: '1rem' }}>
                                <p><strong>Total de conexões:</strong> {connections.length}</p>
                                <p><strong>Conexões ativas:</strong> {connections.filter(c => c.status === 'connected').length}</p>
                                <p><strong>Conexão selecionada:</strong> {selectedConnection ? selectedConnection.name : 'Nenhuma'}</p>
                                <p><strong>Grupos carregados:</strong> {groups.length}</p>
                                <p><strong>Campanhas disponíveis:</strong> {campaigns.length}</p>
                                {selectedConnection && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => {
                                            console.log('=== DEBUG INFO ===');
                                            console.log('Conexão selecionada:', selectedConnection);
                                            console.log('Grupos:', groups);
                                            console.log('Campanhas:', campaigns);
                                            alert('Informações enviadas para o console (F12)');
                                        }}
                                        style={{ marginTop: '0.5rem' }}
                                    >
                                        Mostrar detalhes no console
                                    </button>
                                )}
                            </div>
                        </details>
                    </div>
                </div>
            )}

            {/* Tab: Campanhas Sincronizadas */}
            {activeTab === 'synced' && (
                <div className="tab-content">
                    <h2>📊 Campanhas Sincronizadas</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Visualize as campanhas com grupos WhatsApp associados e seus participantes importados
                    </p>

                    {syncedCampaigns.length > 0 ? (
                        <div style={{ display: 'grid', gap: '1.5rem' }}>
                            {syncedCampaigns.map(campaign => (
                                <div key={campaign.id} className="card" style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '16px',
                                    padding: '1.5rem',
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}>
                                    {/* Borda superior colorida */}
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: '4px',
                                        background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
                                    }} />

                                    {/* Header da campanha */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                                                {campaign.name}
                                            </h3>
                                            <p style={{ margin: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                {campaign.groups_count || 0} grupo(s) • {campaign.participants_count || 0} participantes
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => loadParticipants(campaign.id)}
                                                disabled={loading}
                                            >
                                                <Users size={14} />
                                                {loading && selectedCampaignId === campaign.id ? 'Carregando...' : 'Ver Participantes'}
                                            </button>
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => {
                                                    if (selectedCampaignId === campaign.id && participants.length > 0) {
                                                        exportParticipantsCSV(campaign.id, campaign.name);
                                                    } else {
                                                        alert('Carregue os participantes primeiro clicando em "Ver Participantes"');
                                                    }
                                                }}
                                            >
                                                <Download size={14} />
                                                Exportar CSV
                                            </button>
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => resyncCampaignParticipants(campaign.id, campaign.name)}
                                                disabled={syncing}
                                            >
                                                <RefreshCw size={14} />
                                                {syncing ? 'Sincronizando...' : 'Sincronizar'}
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => deleteSyncedCampaign(campaign.id, campaign.name)}
                                                disabled={loading}
                                            >
                                                <Trash2 size={14} />
                                                Excluir
                                            </button>
                                        </div>
                                    </div>

                                    {/* Lista de grupos */}
                                    {campaign.groups && campaign.groups.length > 0 && (
                                        <div style={{ marginTop: '1rem' }}>
                                            <h4 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                                                Grupos Associados:
                                            </h4>
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                {campaign.groups.map(group => (
                                                    <div key={group.id} style={{
                                                        background: 'var(--bg-primary)',
                                                        padding: '0.75rem 1rem',
                                                        borderRadius: '8px',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center'
                                                    }}>
                                                        <div>
                                                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                                {group.group_name}
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                                {group.participant_count} participantes
                                                            </div>
                                                        </div>
                                                        <div style={{
                                                            background: '#10b981',
                                                            color: 'white',
                                                            padding: '0.25rem 0.75rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 500
                                                        }}>
                                                            Sincronizado
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Lista de Participantes */}
                                    {(() => {
                                        console.log('🔍 Debug Participantes:', {
                                            selectedCampaignId,
                                            'campaign.id': campaign.id,
                                            'participants.length': participants.length,
                                            'Deve mostrar?': selectedCampaignId === campaign.id && participants.length > 0
                                        });
                                        return null;
                                    })()}
                                    {selectedCampaignId === campaign.id && participants.length > 0 && (() => {
                                        // Filtrar participantes pela busca
                                        let filteredParticipants = participants.filter(participant => {
                                            if (!participantSearchTerm) return true;

                                            const searchLower = participantSearchTerm.toLowerCase();
                                            const name = (participant.first_name || '').toLowerCase();
                                            const phone = formatPhoneNumber(participant.phone).toLowerCase();
                                            const rawPhone = (participant.phone || '').toLowerCase(); // Telefone original do banco
                                            const cleanedRawPhone = (participant.phone || '').replace(/\D/g, ''); // Apenas dígitos do telefone original
                                            const email = (participant.email || '').toLowerCase();

                                            // Debug detalhado para o primeiro participante
                                            if (participants.indexOf(participant) === 0 && participantSearchTerm) {
                                                const debugInfo = {
                                                    'Termo de busca': participantSearchTerm,
                                                    'participant.phone (original)': participant.phone,
                                                    'rawPhone': rawPhone,
                                                    'cleanedRawPhone': cleanedRawPhone,
                                                    'phone (formatado)': phone,
                                                    'Encontrou em rawPhone?': rawPhone.includes(searchLower),
                                                    'Encontrou em cleanedRawPhone?': cleanedRawPhone.includes(participantSearchTerm),
                                                    'Encontrou em phone?': phone.includes(searchLower)
                                                };
                                                console.log('🔍 Debug da busca (primeiro participante):', debugInfo);
                                                console.table(debugInfo);
                                            }

                                            const found = name.includes(searchLower) ||
                                                phone.includes(searchLower) ||
                                                rawPhone.includes(searchLower) ||
                                                cleanedRawPhone.includes(participantSearchTerm) ||
                                                email.includes(searchLower);

                                            return found;
                                        });

                                        // Ordenar: números que COMEÇAM com o termo de busca aparecem primeiro
                                        if (participantSearchTerm) {
                                            filteredParticipants = filteredParticipants.sort((a, b) => {
                                                const aPhone = (a.phone || '').toLowerCase();
                                                const bPhone = (b.phone || '').toLowerCase();
                                                const searchLower = participantSearchTerm.toLowerCase();

                                                const aStarts = aPhone.startsWith(searchLower);
                                                const bStarts = bPhone.startsWith(searchLower);

                                                // Se A começa e B não, A vem primeiro
                                                if (aStarts && !bStarts) return -1;
                                                // Se B começa e A não, B vem primeiro  
                                                if (!aStarts && bStarts) return 1;
                                                // Se ambos começam ou nenhum começa, manter ordem original
                                                return 0;
                                            });

                                            console.log(`🔍 Busca por "${participantSearchTerm}": ${filteredParticipants.length} de ${participants.length} encontrados`);

                                            // Mostrar os primeiros 3 telefones encontrados
                                            if (filteredParticipants.length > 0) {
                                                console.log('📱 Primeiros resultados:', filteredParticipants.slice(0, 3).map(p => p.phone));
                                            }
                                        }

                                        return (
                                            <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <h4 style={{ fontSize: '1rem', margin: 0, color: 'var(--text-primary)' }}>
                                                        📋 Participantes ({filteredParticipants.length}{participantSearchTerm ? ` de ${participants.length}` : ''})
                                                    </h4>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={() => {
                                                            setSelectedCampaignId(null);
                                                            setParticipantSearchTerm('');
                                                        }}
                                                    >
                                                        Ocultar
                                                    </button>
                                                </div>

                                                {/* Campo de Pesquisa */}
                                                <div className="search-box" style={{
                                                    position: 'relative',
                                                    marginBottom: '1rem'
                                                }}>
                                                    <Search
                                                        size={18}
                                                        style={{
                                                            position: 'absolute',
                                                            left: '12px',
                                                            top: '50%',
                                                            transform: 'translateY(-50%)',
                                                            color: 'var(--text-secondary)'
                                                        }}
                                                    />
                                                    <input
                                                        type="text"
                                                        className="form-control"
                                                        placeholder="Pesquisar por nome, telefone ou email..."
                                                        value={participantSearchTerm}
                                                        onChange={(e) => setParticipantSearchTerm(e.target.value)}
                                                        style={{
                                                            paddingLeft: '40px',
                                                            background: 'var(--bg-primary)',
                                                            border: '1px solid var(--border-color)',
                                                            borderRadius: '8px'
                                                        }}
                                                    />
                                                    {participantSearchTerm && (
                                                        <button
                                                            onClick={() => setParticipantSearchTerm('')}
                                                            style={{
                                                                position: 'absolute',
                                                                right: '12px',
                                                                top: '50%',
                                                                transform: 'translateY(-50%)',
                                                                background: 'none',
                                                                border: 'none',
                                                                color: 'var(--text-secondary)',
                                                                cursor: 'pointer',
                                                                fontSize: '1.2rem'
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>

                                                <div style={{
                                                    maxHeight: '400px',
                                                    overflowY: 'auto',
                                                    background: 'var(--bg-primary)',
                                                    borderRadius: '8px',
                                                    padding: '1rem'
                                                }}>
                                                    {filteredParticipants.length > 0 ? (
                                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                            <thead>
                                                                <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Nome</th>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Telefone</th>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Email</th>
                                                                    <th style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Data</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {filteredParticipants.map((participant, idx) => (
                                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                                        <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                                                            {participant.first_name || participant.phone}
                                                                        </td>
                                                                        <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                                                                            {formatPhoneNumber(participant.phone)}
                                                                        </td>
                                                                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                                            {participant.email || '-'}
                                                                        </td>
                                                                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                                            {new Date(participant.created_at).toLocaleDateString('pt-BR')}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <div style={{
                                                            textAlign: 'center',
                                                            padding: '2rem',
                                                            color: 'var(--text-secondary)'
                                                        }}>
                                                            Nenhum participante encontrado com "{participantSearchTerm}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Última sincronização */}
                                    {campaign.last_sync && (
                                        <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            Última sincronização: {new Date(campaign.last_sync).toLocaleString('pt-BR')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>📭 Nenhuma campanha sincronizada ainda</p>
                            <p>Vá para a aba "Selecionar Grupos" e associe grupos a uma campanha para começar</p>
                            <button
                                className="btn btn-primary"
                                onClick={() => setActiveTab('select')}
                                style={{ marginTop: '1rem' }}
                            >
                                Ir para Selecionar Grupos
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal: Escolher Método de Conexão */}
            {showConnectionModal && (
                <div className="modal-overlay" onClick={() => setShowConnectionModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <h2>🔌 Conectar WhatsApp</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Escolha o método de conexão:
                        </p>

                        {/* Opção: QR Code */}
                        <div
                            onClick={() => setUsePairingCode(false)}
                            style={{
                                padding: '1.5rem',
                                border: `2px solid ${!usePairingCode ? 'var(--color-primary)' : 'var(--border-color)'}`,
                                borderRadius: '12px',
                                marginBottom: '1rem',
                                cursor: 'pointer',
                                background: !usePairingCode ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                                <input
                                    type="radio"
                                    checked={!usePairingCode}
                                    onChange={() => setUsePairingCode(false)}
                                    style={{ marginTop: '4px' }}
                                />
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                                        📷 QR Code (Tradicional)
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>
                                        Escaneie um QR Code com a câmera do celular
                                    </p>
                                    <div style={{ fontSize: '0.8rem', color: '#f59e0b' }}>
                                        ⚠️ Limitado: Muitos contatos serão filtrados (LIDs)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Opção: Pairing Code */}
                        <div
                            onClick={() => setUsePairingCode(true)}
                            style={{
                                padding: '1.5rem',
                                border: `2px solid ${usePairingCode ? 'var(--color-primary)' : 'var(--border-color)'}`,
                                borderRadius: '12px',
                                marginBottom: '1.5rem',
                                cursor: 'pointer',
                                background: usePairingCode ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                                <input
                                    type="radio"
                                    checked={usePairingCode}
                                    onChange={() => setUsePairingCode(true)}
                                    style={{ marginTop: '4px' }}
                                />
                                <div style={{ flex: 1 }}>
                                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                                        🔑 Código de Pareamento (Recomendado)
                                        <span style={{
                                            background: 'linear-gradient(135deg, #10b981, #059669)',
                                            color: 'white',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            marginLeft: '0.5rem',
                                            fontWeight: 'bold'
                                        }}>
                                            MELHOR
                                        </span>
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 0.5rem 0' }}>
                                        Digite um código de 8 dígitos no WhatsApp
                                    </p>
                                    <div style={{ fontSize: '0.8rem', color: '#10b981' }}>
                                        ✅ Acesso completo: TODOS os números reais dos grupos!
                                    </div>
                                </div>
                            </div>

                            {/* Campo de número (se Pairing Code selecionado) */}
                            {usePairingCode && (
                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                                        📱 Seu número WhatsApp (com DDI):
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={pairingPhoneNumber}
                                        onChange={(e) => setPairingPhoneNumber(e.target.value)}
                                        placeholder="Ex: 5511999999999"
                                        style={{ fontSize: '1rem' }}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                        Digite apenas números, incluindo código do país (55 para Brasil)
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowConnectionModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={connectWithMethod}
                                disabled={loading || (usePairingCode && !pairingPhoneNumber.trim())}
                            >
                                {usePairingCode ? '🔑 Gerar Código' : '📷 Gerar QR Code'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Nova Conexão */}
            {showNewConnectionModal && (
                <div className="modal-overlay" onClick={() => setShowNewConnectionModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2>Nova Conexão WhatsApp</h2>
                        <div className="form-group">
                            <label>Nome da Conexão:</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newConnectionName}
                                onChange={(e) => setNewConnectionName(e.target.value)}
                                placeholder="Ex: WhatsApp Principal"
                            />
                        </div>
                        <div className="modal-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowNewConnectionModal(false)}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={createConnection}
                                disabled={loading}
                            >
                                Criar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
