import { useState, useEffect } from 'react';
import { api } from '../api';
import { Copy, RefreshCw, Zap, Check, X, AlertCircle, Plus, Trash2 } from 'lucide-react';

export default function HotmartSettings() {
    const [settings, setSettings] = useState(null);
    const [configs, setConfigs] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(null);

    // Use the API URL from environment variable, removing '/api' suffix for webhook URLs
    const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace('/api', '');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            await Promise.all([
                loadSettings(),
                loadConfigs(),
                loadCampaigns(),
                loadLogs()
            ]);
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const data = await api.getHotmartSettings();
            setSettings(data.settings || {
                enable_distribution: false
            });
        } catch (error) {
            console.error('Error loading Hotmart settings:', error);
        }
    };

    const loadConfigs = async () => {
        try {
            const data = await api.getHotmartConfigs();
            setConfigs(data.configs || []);
        } catch (error) {
            console.error('Error loading webhook configs:', error);
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

    const loadLogs = async () => {
        try {
            const data = await api.getHotmartLogs();
            setLogs(data.logs || []);
        } catch (error) {
            console.error('Error loading logs:', error);
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.updateHotmartSettings(settings);
            alert('✅ Configurações salvas com sucesso!');
            loadSettings();
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('❌ Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateWebhook = async () => {
        try {
            await api.createHotmartConfig({
                campaign_id: null,
                webhook_secret: ''
            });
            alert('✅ Webhook criado com sucesso!');
            loadConfigs();
        } catch (error) {
            console.error('Error creating webhook:', error);
            alert('❌ Erro ao criar webhook');
        }
    };

    const handleUpdateConfig = async (id, updates) => {
        try {
            await api.updateHotmartConfig(id, updates);
            loadConfigs();
        } catch (error) {
            console.error('Error updating config:', error);
            alert('❌ Erro ao atualizar webhook');
        }
    };

    const handleDeleteConfig = async (id) => {
        if (!confirm('Tem certeza que deseja deletar este webhook?')) {
            return;
        }

        try {
            await api.deleteHotmartConfig(id);
            alert('✅ Webhook deletado com sucesso!');
            loadConfigs();
        } catch (error) {
            console.error('Error deleting config:', error);
            alert('❌ Erro ao deletar webhook');
        }
    };

    const handleGenerateSecret = async (configId) => {
        try {
            const data = await api.generateHotmartSecret();
            const config = configs.find(c => c.id === configId);
            await handleUpdateConfig(configId, {
                ...config,
                webhook_secret: data.secret
            });
        } catch (error) {
            console.error('Error generating secret:', error);
            alert('❌ Erro ao gerar secret');
        }
    };

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const getStatusBadge = (status) => {
        const styles = {
            success: { bg: '#10b981', icon: Check },
            error: { bg: '#ef4444', icon: X },
            duplicate: { bg: '#f59e0b', icon: AlertCircle }
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
                {status}
            </span>
        );
    };

    if (loading) {
        return <div>Carregando...</div>;
    }

    return (
        <div style={{ maxWidth: 1200 }}>
            <h2>Integração Hotmart</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Configure múltiplos webhooks para receber leads de diferentes campanhas do Hotmart
            </p>


            {/* Webhook Configurations */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3>Webhooks Configurados</h3>
                    <button
                        className="btn btn-primary"
                        onClick={handleCreateWebhook}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Plus size={16} />
                        Criar Novo Webhook
                    </button>
                </div>

                {configs.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>
                        Nenhum webhook configurado. Clique em "Criar Novo Webhook" para começar.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {configs.map(config => {
                            const webhookUrl = `${baseUrl}/api/hotmart/webhook${config.webhook_number}`;
                            return (
                                <div key={config.id} className="card" style={{ background: 'var(--bg-secondary)', padding: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                        <h4 style={{ margin: 0 }}>Webhook #{config.webhook_number}</h4>
                                        <button
                                            className="btn btn-ghost btn-sm"
                                            onClick={() => handleDeleteConfig(config.id)}
                                            style={{ color: '#ef4444' }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* Webhook URL */}
                                    <div style={{ marginBottom: 12 }}>
                                        <label className="label" style={{ fontSize: '0.75rem' }}>URL do Webhook</label>
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
                                                onClick={() => copyToClipboard(webhookUrl, `url-${config.id}`)}
                                            >
                                                {copied === `url-${config.id}` ? <Check size={16} /> : <Copy size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Campaign */}
                                    <div style={{ marginBottom: 12 }}>
                                        <label className="label" style={{ fontSize: '0.75rem' }}>Campanha</label>
                                        <select
                                            value={config.campaign_id || ''}
                                            onChange={(e) => handleUpdateConfig(config.id, {
                                                ...config,
                                                campaign_id: parseInt(e.target.value) || null
                                            })}
                                            className="input"
                                        >
                                            <option value="">Sem campanha</option>
                                            {campaigns.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Webhook Secret */}
                                    <div style={{ marginBottom: 12 }}>
                                        <label className="label" style={{ fontSize: '0.75rem' }}>Webhook Secret (opcional)</label>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <input
                                                type="password"
                                                value={config.webhook_secret || ''}
                                                onChange={(e) => handleUpdateConfig(config.id, {
                                                    ...config,
                                                    webhook_secret: e.target.value
                                                })}
                                                className="input"
                                                placeholder="Deixe vazio para desabilitar validação"
                                                style={{ flex: 1 }}
                                            />
                                            <button
                                                className="btn btn-secondary btn-sm"
                                                onClick={() => handleGenerateSecret(config.id)}
                                            >
                                                Gerar
                                            </button>
                                        </div>
                                    </div>

                                    {/* Enabled Toggle */}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={config.is_enabled}
                                            onChange={(e) => handleUpdateConfig(config.id, {
                                                ...config,
                                                is_enabled: e.target.checked
                                            })}
                                        />
                                        <span style={{ fontSize: '0.875rem' }}>
                                            {config.is_enabled ? 'Ativo' : 'Desativado'}
                                        </span>
                                    </label>

                                    {/* Round-Robin Toggle */}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 12 }}>
                                        <input
                                            type="checkbox"
                                            checked={config.enable_round_robin || false}
                                            onChange={(e) => handleUpdateConfig(config.id, {
                                                ...config,
                                                enable_round_robin: e.target.checked
                                            })}
                                        />
                                        <span style={{ fontSize: '0.875rem' }}>
                                            Ativar distribuição Round-Robin
                                        </span>
                                    </label>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 28, marginTop: 4 }}>
                                        Leads deste webhook serão distribuídos automaticamente para vendedoras ativas
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Activity Log */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3>Log de Atividades</h3>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={loadLogs}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <RefreshCw size={14} />
                        Atualizar
                    </button>
                </div>

                {logs.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>
                        Nenhum webhook recebido ainda
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: '0.875rem' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Data</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Webhook</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Evento</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Comprador</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Produto</th>
                                    <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map(log => {
                                    const webhookConfig = configs.find(c => c.id === log.webhook_config_id);
                                    return (
                                        <tr key={log.id} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: 8 }}>
                                                {new Date(log.created_at).toLocaleString('pt-BR')}
                                            </td>
                                            <td style={{ padding: 8 }}>
                                                {webhookConfig ? `#${webhookConfig.webhook_number}` : '-'}
                                            </td>
                                            <td style={{ padding: 8 }}>{log.event_type}</td>
                                            <td style={{ padding: 8 }}>
                                                {log.buyer_name || '-'}
                                                {log.buyer_email && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                        {log.buyer_email}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: 8 }}>{log.product_name || '-'}</td>
                                            <td style={{ padding: 8 }}>{getStatusBadge(log.status)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
