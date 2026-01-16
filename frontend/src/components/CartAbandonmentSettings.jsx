import { useState, useEffect } from 'react';
import { api } from '../api';
import { Copy, RefreshCw, Check, X, AlertCircle, TestTube } from 'lucide-react';

export default function CartAbandonmentSettings() {
    const [settings, setSettings] = useState(null);
    const [campaigns, setCampaigns] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [copied, setCopied] = useState(false);

    // Detecta se está em localhost ou produção
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocalhost
        ? window.location.origin.replace('5173', '3001')  // Local: http://localhost:3001
        : 'https://crmsales-recovery-crm-api.onrender.com'; // Produção: URL do backend no Render

    const webhookUrl = `${baseUrl}/api/cart-abandonment/webhook`;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            await Promise.all([
                loadSettings(),
                loadCampaigns(),
                loadEvents()
            ]);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const response = await fetch(`${baseUrl}/api/cart-abandonment/settings`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setSettings(data.settings || {
                is_enabled: false,
                delay_minutes: 60,
                manychat_tag_name: 'abandono_carrinho'
            });
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const loadCampaigns = async () => {
        try {
            const data = await api.getCampaigns();
            setCampaigns(data.campaigns || []);
        } catch (error) {
            console.error('Error loading campaigns:', error);
        }
    };

    const loadEvents = async () => {
        try {
            const response = await fetch(`${baseUrl}/api/cart-abandonment/events?limit=20`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            setEvents(data.events || []);
        } catch (error) {
            console.error('Error loading events:', error);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            const response = await fetch(`${baseUrl}/api/cart-abandonment/settings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(settings)
            });

            if (!response.ok) throw new Error('Failed to save');

            alert('✅ Configurações salvas com sucesso!');
            loadSettings();
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('❌ Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!settings.manychat_api_token) {
            alert('⚠️ Insira o API Token do ManyChat primeiro');
            return;
        }

        setTesting(true);
        try {
            const response = await fetch(`${baseUrl}/api/cart-abandonment/test-connection`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ api_token: settings.manychat_api_token })
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ Conexão com ManyChat estabelecida com sucesso!');
            } else {
                alert('❌ Falha ao conectar com ManyChat. Verifique o API Token.');
            }
        } catch (error) {
            console.error('Error testing connection:', error);
            alert('❌ Erro ao testar conexão');
        } finally {
            setTesting(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: { bg: '#6b7280', icon: AlertCircle, label: 'Pendente' },
            processing: { bg: '#3b82f6', icon: RefreshCw, label: 'Processando' },
            completed: { bg: '#10b981', icon: Check, label: 'Concluído' },
            error: { bg: '#ef4444', icon: X, label: 'Erro' },
            duplicate: { bg: '#f59e0b', icon: AlertCircle, label: 'Duplicado' }
        };
        const config = styles[status] || styles.error;
        const Icon = config.icon;

        return (
            <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 4,
                background: config.bg,
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 600
            }}>
                <Icon size={12} />
                {config.label}
            </span>
        );
    };

    if (loading) {
        return <div>Carregando...</div>;
    }

    return (
        <div style={{ maxWidth: 1200 }}>
            <h2>Abandono de Carrinho Hotmart</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Configure o sistema de recuperação de carrinho abandonado com integração ao ManyChat
            </p>

            {/* Webhook URL */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>URL do Webhook</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Configure esta URL no painel da Hotmart para receber eventos de abandono de carrinho
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input
                        type="text"
                        value={webhookUrl}
                        readOnly
                        className="input"
                        style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}
                    />
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyToClipboard(webhookUrl)}
                    >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
            </div>

            {/* ManyChat Configuration */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>Configurações ManyChat</h3>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">API Token do ManyChat</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Obtenha o token em: ManyChat → Settings → API
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="password"
                            value={settings.manychat_api_token || ''}
                            onChange={(e) => setSettings({ ...settings, manychat_api_token: e.target.value })}
                            className="input"
                            placeholder="Digite o API Token"
                            style={{ flex: 1 }}
                        />
                        <button
                            className="btn btn-secondary"
                            onClick={handleTestConnection}
                            disabled={testing}
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <TestTube size={16} />
                            {testing ? 'Testando...' : 'Testar'}
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Webhook URL do ManyChat (Opcional - Não Necessário)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        ⚠️ Este campo não é mais necessário. Deixe vazio para usar apenas API.
                    </p>
                    <input
                        type="text"
                        value={settings.manychat_webhook_url || ''}
                        onChange={(e) => setSettings({ ...settings, manychat_webhook_url: e.target.value })}
                        className="input"
                        placeholder="Deixe vazio (não necessário)"
                        disabled
                        style={{ opacity: 0.5 }}
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Nome da TAG (Opcional)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        TAG usada apenas para referência (não é mais necessária)
                    </p>
                    <input
                        type="text"
                        value={settings.manychat_tag_name || 'abandono_carrinho'}
                        onChange={(e) => setSettings({ ...settings, manychat_tag_name: e.target.value })}
                        className="input"
                        placeholder="abandono_carrinho"
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Flow ID - Primeira Mensagem ⭐</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        ID do Flow que será disparado imediatamente via API (Flow 1)
                    </p>
                    <input
                        type="text"
                        value={settings.manychat_flow_id_first || ''}
                        onChange={(e) => setSettings({ ...settings, manychat_flow_id_first: e.target.value })}
                        className="input"
                        placeholder="content20250115123456_123456"
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Flow ID - Segunda Mensagem ⭐</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        ID do Flow que será disparado via API após o delay (Flow 2)
                    </p>
                    <input
                        type="text"
                        value={settings.manychat_flow_id_second || ''}
                        onChange={(e) => setSettings({ ...settings, manychat_flow_id_second: e.target.value })}
                        className="input"
                        placeholder="content20250115123456_123456"
                    />
                </div>

                <div style={{
                    marginBottom: 16,
                    padding: 12,
                    borderRadius: 8,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                    <p style={{ fontSize: '0.85rem', color: '#3b82f6', margin: 0, lineHeight: 1.6 }}>
                        💡 <strong>Novo:</strong> Agora ambas as mensagens são enviadas via API!
                        Você só precisa dos Flow IDs. O campo "Webhook URL" não é mais necessário.
                    </p>
                </div>
            </div>

            {/* Processing Configuration */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>Configurações de Processamento</h3>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Delay (minutos)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Tempo de espera antes de verificar se o contato foi convertido
                    </p>
                    <input
                        type="number"
                        value={settings.delay_minutes || 60}
                        onChange={(e) => setSettings({ ...settings, delay_minutes: parseInt(e.target.value) })}
                        className="input"
                        min="1"
                        max="1440"
                    />
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Campanha para Verificação</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                        Campanha onde será verificado se o contato foi convertido
                    </p>
                    <select
                        value={settings.campaign_id || ''}
                        onChange={(e) => setSettings({ ...settings, campaign_id: parseInt(e.target.value) || null })}
                        className="input"
                    >
                        <option value="">Selecione uma campanha</option>
                        {campaigns.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={settings.is_enabled || false}
                            onChange={(e) => setSettings({ ...settings, is_enabled: e.target.checked })}
                        />
                        <span>Ativar sistema de abandono de carrinho</span>
                    </label>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleSaveSettings}
                    disabled={saving}
                >
                    {saving ? 'Salvando...' : 'Salvar Configurações'}
                </button>
            </div>

            {/* Events Log */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3>Eventos Recentes</h3>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={loadEvents}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <RefreshCw size={14} />
                        Atualizar
                    </button>
                </div>

                {events.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>
                        Nenhum evento de abandono recebido ainda
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.875rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Data</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Contato</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Produto</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>1ª Msg</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>2ª Msg</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Na Campanha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map(event => (
                                    <tr key={event.id} style={{ borderTop: '1px solid var(--border)' }}>
                                        <td style={{ padding: 8 }}>
                                            {new Date(event.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {event.contact_name || '-'}
                                            {event.contact_email && (
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {event.contact_email}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: 8 }}>{event.product_name || '-'}</td>
                                        <td style={{ padding: 8 }}>{getStatusBadge(event.status)}</td>
                                        <td style={{ padding: 8 }}>
                                            {event.first_message_sent ? (
                                                <Check size={16} style={{ color: '#10b981' }} />
                                            ) : (
                                                <X size={16} style={{ color: '#6b7280' }} />
                                            )}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {event.second_message_sent ? (
                                                <Check size={16} style={{ color: '#10b981' }} />
                                            ) : (
                                                <X size={16} style={{ color: '#6b7280' }} />
                                            )}
                                        </td>
                                        <td style={{ padding: 8 }}>
                                            {event.found_in_campaign ? (
                                                <Check size={16} style={{ color: '#10b981' }} />
                                            ) : (
                                                <X size={16} style={{ color: '#6b7280' }} />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
