import { useState, useEffect } from 'react';
import { api } from '../api';
import { Copy, RefreshCw, Trash2, Check, X, Shield, Search } from 'lucide-react';

export default function ExclusionSettings() {
    const [settings, setSettings] = useState(null);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [logs, setLogs] = useState([]);

    // Detectar ambiente automaticamente
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const baseUrl = isLocal ? "http://localhost:3001" : "https://crmsales-recovery-crm-api.onrender.com";
    const webhookUrl = `${baseUrl}/api/webhook/exclusion`;

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                console.log('🔍 [ExclusionLogs] Fetching logs...');
                const data = await api.getExclusionLogs();
                console.log('📦 [ExclusionLogs] Received data:', data);
                console.log('📊 [ExclusionLogs] Logs array:', data?.logs);
                console.log('🔢 [ExclusionLogs] Logs count:', data?.logs?.length);

                if (data && data.logs) {
                    console.log('✅ [ExclusionLogs] Setting logs state with', data.logs.length, 'items');
                    setLogs(data.logs);
                } else {
                    console.warn('⚠️ [ExclusionLogs] No logs in response');
                }
            } catch (error) {
                console.error('❌ [ExclusionLogs] Error fetching logs:', error);
            }
        };

        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsData, groupsData] = await Promise.all([
                api.getApiSettings(),
                api.getAllWhatsAppGroups()
            ]);

            setSettings(settingsData);
            setGroups(groupsData || []);
        } catch (error) {
            console.error('Error loading exclusion settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.updateApiSettings({
                exclusion_enabled: settings.exclusion_enabled,
                exclusion_token: settings.exclusion_token,
                exclusion_group_ids: settings.exclusion_group_ids
            });
            alert('✅ Configurações de exclusão salvas com sucesso!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('❌ Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    const generateToken = () => {
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        setSettings({ ...settings, exclusion_token: token });
    };

    const toggleGroup = (groupId) => {
        const currentGroups = settings.exclusion_group_ids || [];
        let newGroups;
        if (currentGroups.includes(groupId)) {
            newGroups = currentGroups.filter(id => id !== groupId);
        } else {
            newGroups = [...currentGroups, groupId];
        }
        setSettings({ ...settings, exclusion_group_ids: newGroups });
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) return <div className="card">Carregando...</div>;

    // Filtrar grupos
    const filteredGroups = groups.filter(g =>
        g.group_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{ maxWidth: 1200 }}>
            <h2><Shield size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} />API de Exclusão</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Configure a API para remover contatos automaticamente de grupos específicos.
            </p>

            {/* Webhook URL & Token */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>Credenciais da API</h3>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Endpoint (POST)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input" value={webhookUrl} readOnly style={{ flex: 1, fontFamily: 'monospace' }} />
                        <button className="btn btn-secondary" onClick={() => copyToClipboard(webhookUrl)}>
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                    </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                    <label className="label">Token de Autenticação</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            className="input"
                            value={settings.exclusion_token || ''}
                            onChange={(e) => setSettings({ ...settings, exclusion_token: e.target.value })}
                            placeholder="Gere um token seguro"
                            style={{ flex: 1, fontFamily: 'monospace' }}
                        />
                        <button className="btn btn-secondary" onClick={generateToken}>
                            <RefreshCw size={16} /> Gerar
                        </button>
                    </div>
                    <small style={{ color: 'var(--text-secondary)' }}>
                        Envie este token no header 'Authorization: Bearer TOKEN' ou na query '?token=TOKEN'.
                    </small>
                </div>

                <div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '1rem', fontWeight: 500 }}>
                        <input
                            type="checkbox"
                            checked={settings.exclusion_enabled || false}
                            onChange={(e) => setSettings({ ...settings, exclusion_enabled: e.target.checked })}
                        />
                        Ativar API de Exclusão
                    </label>
                </div>
            </div>

            {/* Seleção de Grupos */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3>Grupos para Exclusão</h3>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Selecione os grupos de onde os contatos recebidos via API serão removidos.
                </p>

                <div style={{ position: 'relative', marginBottom: 16 }}>
                    <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-secondary)' }} />
                    <input
                        className="input"
                        placeholder="Buscar grupos..."
                        style={{ paddingLeft: 40 }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: 12,
                    maxHeight: 400,
                    overflowY: 'auto',
                    padding: 4
                }}>
                    {filteredGroups.map(group => {
                        const isSelected = (settings.exclusion_group_ids || []).includes(group.group_id);
                        return (
                            <div
                                key={group.group_id}
                                onClick={() => toggleGroup(group.group_id)}
                                style={{
                                    padding: 12,
                                    borderRadius: 8,
                                    border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                                    background: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    transition: 'all 0.2s'
                                }}
                            >
                                <div style={{
                                    width: 20, height: 20,
                                    borderRadius: 4,
                                    border: isSelected ? 'none' : '2px solid var(--text-secondary)',
                                    background: isSelected ? 'var(--accent)' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {isSelected && <Check size={14} color="white" />}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {group.group_name}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {group.participant_count} participantes
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>
                            <strong>{(settings.exclusion_group_ids || []).length}</strong> grupos selecionados
                        </span>
                        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </div>
            </div>

            {/* LOGS DE EXCLUSÃO */}
            <div style={{ marginTop: 24 }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Trash2 size={20} />
                    Logs de Exclusão (Últimas Ações)
                </h4>
                {console.log('🎨 [ExclusionLogs] Rendering table section. Logs count:', logs.length)}
                <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    {logs.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            Nenhum registro de exclusão recente.
                        </div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '8px 16px' }}>Telefone</th>
                                    <th style={{ padding: '8px 16px' }}>Grupo</th>
                                    <th style={{ padding: '8px 16px' }}>Status</th>
                                    <th style={{ padding: '8px 16px' }}>Horário</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '8px 16px' }}>{log.phone}</td>
                                        <td style={{ padding: '8px 16px' }}>{log.group_name || log.group_id}</td>
                                        <td style={{ padding: '8px 16px' }}>
                                            {log.status === 'success' ? (
                                                <span style={{ color: '#10b981', fontWeight: 500 }}>Sucesso</span>
                                            ) : (
                                                <span style={{ color: '#ef4444', fontWeight: 500 }} title={log.error_message}>
                                                    Erro
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>
                                            {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <small style={{ display: 'block', marginTop: 8, color: 'var(--text-secondary)', textAlign: 'right' }}>
                    Atualiza automaticamente a cada 5 segundos
                </small>
            </div>
        </div>
    );
}
