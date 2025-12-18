import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Settings as SettingsIcon, Key, Download, Upload, ArrowUpDown, Copy, Check, RefreshCw, GripVertical, X, History, RotateCcw, Trash2, Tags, Plus, Edit2, MessageCircle } from 'lucide-react';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('api');

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title"><SettingsIcon size={28} style={{ marginRight: 12 }} />Configurações</h1>
            </div>

            {/* Tabs */}
            <div className="card" style={{ marginBottom: 24, padding: 0 }}>
                <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                    <TabButton active={activeTab === 'api'} onClick={() => setActiveTab('api')} icon={<Key size={16} />} label="API" />
                    <TabButton active={activeTab === 'whatsapp'} onClick={() => setActiveTab('whatsapp')} icon={<MessageCircle size={16} />} label="WhatsApp" />
                    <TabButton active={activeTab === 'status'} onClick={() => setActiveTab('status')} icon={<Tags size={16} />} label="Status" />
                    <TabButton active={activeTab === 'order'} onClick={() => setActiveTab('order')} icon={<ArrowUpDown size={16} />} label="Ordem" />
                    <TabButton active={activeTab === 'export'} onClick={() => setActiveTab('export')} icon={<Download size={16} />} label="Exportar" />
                    <TabButton active={activeTab === 'import'} onClick={() => setActiveTab('import')} icon={<Upload size={16} />} label="Importar" />
                    <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={16} />} label="Histórico" />
                </div>
            </div>

            {activeTab === 'api' && <ApiSettings />}
            {activeTab === 'whatsapp' && <WhatsAppSettings />}
            {activeTab === 'status' && <StatusSettings />}
            {activeTab === 'order' && <DistributionOrder />}
            {activeTab === 'export' && <ExportLeads />}
            {activeTab === 'import' && <ImportLeads />}
            {activeTab === 'history' && <ImportHistory />}
        </div>
    );
}

function TabButton({ active, onClick, icon, label }) {
    return (
        <button onClick={onClick} style={{
            padding: '16px 24px', background: 'transparent', border: 'none', color: active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer',
            borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, transition: 'all 0.2s'
        }}>{icon} {label}</button>
    );
}

// ==============================
// API SETTINGS TAB
// ==============================
function ApiSettings() {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => { api.getApiSettings().then(setSettings).finally(() => setLoading(false)); }, []);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const toggleSetting = async (key, value) => {
        await api.updateApiSettings({ [key]: value });
        setSettings({ ...settings, [key]: value });
    };

    const regenerateToken = async () => {
        if (!confirm('Tem certeza? O token atual será invalidado.')) return;
        await api.updateApiSettings({ regenerate_token: true });
        const updated = await api.getApiSettings();
        setSettings(updated);
    };

    if (loading) return <div className="card">Carregando...</div>;

    const fullWebhookUrl = `${window.location.origin}${settings.webhook_url}`;

    return (
        <div className="card">
            <h3 style={{ marginBottom: 24 }}>🔗 Configurações do Webhook</h3>

            <div className="form-group">
                <label className="form-label">URL do Webhook (Hotmart)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" value={fullWebhookUrl} readOnly style={{ flex: 1 }} />
                    <button className="btn btn-ghost" onClick={() => copyToClipboard(fullWebhookUrl)}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                </div>
                <small style={{ color: 'var(--text-secondary)' }}>Use esta URL no painel da Hotmart para enviar webhooks</small>
            </div>

            <div className="form-group">
                <label className="form-label">Token de Autenticação</label>
                <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-input" value={settings.webhook_token} readOnly style={{ flex: 1, fontFamily: 'monospace' }} />
                    <button className="btn btn-ghost" onClick={() => copyToClipboard(settings.webhook_token)}><Copy size={16} /></button>
                    <button className="btn btn-danger" onClick={regenerateToken}><RefreshCw size={16} /></button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 32, marginTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="toggle">
                        <input type="checkbox" checked={settings.webhook_enabled} onChange={e => toggleSetting('webhook_enabled', e.target.checked)} />
                        <span className="toggle-slider"></span>
                    </label>
                    <span>Webhook Ativo</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="toggle">
                        <input type="checkbox" checked={settings.require_token} onChange={e => toggleSetting('require_token', e.target.checked)} />
                        <span className="toggle-slider"></span>
                    </label>
                    <span>Exigir Token no Header</span>
                </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 8 }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>Exemplo de uso:</p>
                <code style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    POST {fullWebhookUrl}<br />
                    {settings.require_token && <>Header: Authorization: Bearer {settings.webhook_token}<br /></>}
                    Body: {"{"}"first_name": "João", "email": "joao@email.com", "phone_number": "11999999999"{"}"}
                </code>
            </div>
        </div>
    );
}

// ==============================
// WHATSAPP TEMPLATES TAB (ADMIN VIEW)
// ==============================
function WhatsAppSettings() {
    const [sellerTemplates, setSellerTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSeller, setSelectedSeller] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState(null);
    const [form, setForm] = useState({ name: '', message: '' });

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const res = await api.getWhatsAppTemplatesBySeller();
            setSellerTemplates(res.sellers || []);
        } catch (err) {
            console.error('Erro ao carregar templates:', err);
        }
        setLoading(false);
    };

    useEffect(() => { loadTemplates(); }, []);

    const openNew = (sellerId) => {
        setSelectedSeller(sellerId);
        setEditTemplate(null);
        setForm({ name: '', message: '' });
        setShowModal(true);
    };

    const openEdit = (sellerId, t) => {
        setSelectedSeller(sellerId);
        setEditTemplate(t);
        setForm({ name: t.name, message: t.message });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editTemplate) {
                await api.updateWhatsAppTemplate(editTemplate.uuid, form);
            } else {
                await api.createWhatsAppTemplate({ ...form, seller_id: selectedSeller });
            }
            setShowModal(false);
            loadTemplates();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    };

    const handleDelete = async (uuid) => {
        if (confirm('Tem certeza que deseja excluir este template?')) {
            await api.deleteWhatsAppTemplate(uuid);
            loadTemplates();
        }
    };

    return (
        <div className="card">
            <div style={{ marginBottom: 20 }}>
                <h3><MessageCircle size={20} style={{ marginRight: 8 }} /> Templates de WhatsApp por Vendedor</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontSize: '0.875rem' }}>
                    Cada vendedor(a) possui seus próprios templates de mensagens. Use <code>{'{nome}'}</code> e <code>{'{produto}'}</code> para substituição automática.
                </p>
            </div>

            {loading ? <p>Carregando...</p> : sellerTemplates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                    <MessageCircle size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                    <p>Nenhum vendedor encontrado</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 24 }}>
                    {sellerTemplates.map(seller => (
                        <div key={seller.seller_id} style={{
                            background: 'var(--bg-primary)',
                            borderRadius: 12,
                            border: '1px solid var(--border)',
                            overflow: 'hidden'
                        }}>
                            {/* Header do Vendedor */}
                            <div style={{
                                padding: '16px 20px',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
                                borderBottom: '1px solid var(--border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'white',
                                        fontWeight: 700,
                                        fontSize: '1rem'
                                    }}>
                                        {seller.seller_name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{seller.seller_name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {seller.templates.length} template(s)
                                        </div>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => openNew(seller.seller_id)}
                                >
                                    <Plus size={14} /> Novo
                                </button>
                            </div>

                            {/* Templates do Vendedor */}
                            <div style={{ padding: 16 }}>
                                {seller.templates.length === 0 ? (
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '16px 0' }}>
                                        Nenhum template criado ainda
                                    </p>
                                ) : (
                                    <div style={{ display: 'grid', gap: 8 }}>
                                        {seller.templates.map(t => (
                                            <div key={t.uuid} style={{
                                                padding: 12,
                                                background: 'var(--bg-secondary)',
                                                borderRadius: 8,
                                                border: '1px solid var(--border)'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ flex: 1 }}>
                                                        <strong style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <MessageCircle size={14} color="#25D366" />
                                                            {t.name}
                                                        </strong>
                                                        <p style={{
                                                            color: 'var(--text-secondary)',
                                                            marginTop: 6,
                                                            whiteSpace: 'pre-wrap',
                                                            fontSize: '0.8rem',
                                                            lineHeight: 1.4,
                                                            display: '-webkit-box',
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: 'vertical',
                                                            overflow: 'hidden'
                                                        }}>
                                                            {t.message}
                                                        </p>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
                                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(seller.seller_id, t)}>
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(t.uuid)}>
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="modal slide-up" style={{ maxWidth: 500 }}>
                        <div className="modal-header">
                            <h3>{editTemplate ? 'Editar Template' : 'Novo Template'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-group">
                                <label className="form-label">Nome do Template</label>
                                <input className="form-input" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Boas-vindas" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mensagem</label>
                                <textarea className="form-textarea" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={5} placeholder="Olá {nome}! Tudo bem? Vi que você se interessou pelo {produto}..." required />
                                <small style={{ color: 'var(--text-secondary)', marginTop: 4, display: 'block' }}>
                                    Use <code>{'{nome}'}</code> para o nome do lead e <code>{'{produto}'}</code> para o produto.
                                </small>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{editTemplate ? 'Salvar' : 'Criar Template'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==============================
// DISTRIBUTION ORDER TAB
// ==============================
function DistributionOrder() {
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    useEffect(() => { api.getDistributionOrder().then(d => setSellers(d.sellers)).finally(() => setLoading(false)); }, []);

    const handleDragStart = (index) => { dragItem.current = index; };
    const handleDragEnter = (index) => { dragOverItem.current = index; };

    const handleDragEnd = () => {
        const items = [...sellers];
        const [draggedItem] = items.splice(dragItem.current, 1);
        items.splice(dragOverItem.current, 0, draggedItem);
        setSellers(items);
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const saveOrder = async () => {
        setSaving(true);
        const order = sellers.map(s => s.id);
        await api.updateDistributionOrder(order);
        setSaving(false);
        alert('Ordem salva com sucesso!');
    };

    if (loading) return <div className="card">Carregando...</div>;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h3>📊 Ordem Sequencial (Round-Robin)</h3>
                <button className="btn btn-primary" onClick={saveOrder} disabled={saving}>{saving ? 'Salvando...' : 'Salvar Ordem'}</button>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Arraste para reordenar. Os leads serão distribuídos na ordem abaixo.</p>

            <div>
                {sellers.map((seller, index) => (
                    <div key={seller.id} draggable onDragStart={() => handleDragStart(index)} onDragEnter={() => handleDragEnter(index)} onDragEnd={handleDragEnd} onDragOver={e => e.preventDefault()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: 16,
                            background: seller.is_in_distribution ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-primary)',
                            borderRadius: 8,
                            marginBottom: 8,
                            cursor: 'grab',
                            border: `2px solid ${seller.is_in_distribution ? '#10b981' : 'var(--border)'}`,
                            opacity: seller.is_in_distribution ? 1 : 0.6
                        }}>
                        <GripVertical size={20} color="var(--text-secondary)" />
                        <span style={{
                            background: seller.is_in_distribution ? 'linear-gradient(135deg, #10b981, #059669)' : '#9ca3af',
                            color: 'white',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            boxShadow: seller.is_in_distribution ? '0 2px 8px rgba(16, 185, 129, 0.4)' : 'none'
                        }}>{index + 1}</span>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: seller.is_in_distribution ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{seller.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{seller.email}</div>
                        </div>
                        <span style={{
                            background: seller.is_in_distribution ? '#10b981' : '#ef4444',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: 20,
                            fontSize: '0.75rem',
                            fontWeight: 600
                        }}>
                            {seller.is_in_distribution ? '✓ Ativa' : '✗ Inativa'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ==============================
// EXPORT LEADS TAB
// ==============================
function ExportLeads() {
    const [sellers, setSellers] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [selectedSeller, setSelectedSeller] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState('');
    const [format, setFormat] = useState('json');
    const [vcardNamePattern, setVcardNamePattern] = useState('{nome} - {produto}');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.getSellers().then(d => setSellers(d.sellers));
        api.getCampaigns({ active_only: false }).then(d => setCampaigns(d.campaigns));
    }, []);

    // Gerar vCard individual com número sequencial
    const generateVCard = (lead, namePattern, numero = '') => {
        // Helper para pegar valor não vazio
        const getValue = (...values) => {
            for (const v of values) {
                if (v && v.trim && v.trim() !== '') return v.trim();
                if (v && typeof v === 'string' && v !== '') return v;
            }
            return '';
        };

        const nome = getValue(lead.nome, lead.first_name, '');
        const produto = getValue(lead.produto, lead.product_name);
        const campanha = getValue(lead.campanha, lead.campaign_name);
        const vendedora = getValue(lead.vendedora, lead.seller_name);
        const status = getValue(lead.status, lead.status_name);

        // Substituir variáveis no padrão do nome
        let contactName = namePattern
            .replace(/{nome}/gi, nome)
            .replace(/{produto}/gi, produto)
            .replace(/{campanha}/gi, campanha)
            .replace(/{vendedora}/gi, vendedora)
            .replace(/{status}/gi, status)
            .trim();

        // Limpar espaços extras e hífens órfãos
        contactName = contactName
            .replace(/\s+/g, ' ')
            .replace(/\s*-\s*-\s*/g, ' - ')
            .replace(/\s*-\s*$/g, '')
            .replace(/^\s*-\s*/g, '')
            .trim();

        // Se o padrão não tem variáveis ou está vazio, usar o padrão como nome fixo
        if (!contactName) {
            contactName = namePattern.trim() || 'Contato';
        }

        // Adicionar número sequencial ao final
        if (numero) {
            contactName = `${contactName} ${numero}`;
        }

        const phone = (lead.telefone || lead.phone || '').replace(/\D/g, '');
        const email = lead.email || '';

        let vcard = 'BEGIN:VCARD\r\n';
        vcard += 'VERSION:3.0\r\n';
        vcard += `FN:${contactName}\r\n`;
        vcard += `N:${contactName};;;;\r\n`;
        if (phone) {
            vcard += `TEL;TYPE=CELL:+${phone}\r\n`;
        }
        if (email) {
            vcard += `EMAIL:${email}\r\n`;
        }
        vcard += 'END:VCARD\r\n';

        return vcard;
    };

    const handleExport = async () => {
        setLoading(true);
        try {
            const params = { format: 'json' }; // Sempre buscar JSON do servidor
            if (selectedSeller) params.seller_id = selectedSeller;
            if (selectedCampaign) params.campaign_id = selectedCampaign;

            if (format === 'csv') {
                const token = localStorage.getItem('token');
                const queryParams = new URLSearchParams({ format: 'csv' });
                if (selectedSeller) queryParams.append('seller_id', selectedSeller);
                if (selectedCampaign) queryParams.append('campaign_id', selectedCampaign);

                const res = await fetch(`/api/settings/export/leads?${queryParams}`, { headers: { Authorization: `Bearer ${token}` } });
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'leads_export.csv'; a.click();
            } else if (format === 'vcard') {
                // Buscar dados e gerar vCard
                const data = await api.exportLeads(params);
                const leads = data.leads || [];

                if (leads.length === 0) {
                    alert('Nenhum lead encontrado para exportar');
                    return;
                }

                // Gerar todos os vCards com número sequencial
                const vcards = leads.map((lead, index) => {
                    const numero = String(index + 1).padStart(2, '0'); // 01, 02, 03...
                    return generateVCard(lead, vcardNamePattern, numero);
                }).join('\n');

                const blob = new Blob([vcards], { type: 'text/vcard;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Nome do arquivo baseado no padrão
                const baseFileName = vcardNamePattern
                    .replace(/{nome}/gi, '')
                    .replace(/{produto}/gi, '')
                    .replace(/{campanha}/gi, '')
                    .replace(/{vendedora}/gi, '')
                    .replace(/{status}/gi, '')
                    .replace(/\s+/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_|_$/g, '')
                    .trim() || 'contatos';
                a.download = `${baseFileName}_${leads.length}.vcf`;
                a.click();

                alert(`✅ Exportados ${leads.length} contatos em formato vCard!`);
            } else {
                const data = await api.exportLeads(params);
                const blob = new Blob([JSON.stringify(data.leads, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'leads_export.json'; a.click();
            }
        } finally { setLoading(false); }
    };

    return (
        <div className="card">
            <h3 style={{ marginBottom: 24 }}>📥 Exportar Leads</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                    <label className="form-label">Filtrar por Vendedora</label>
                    <select className="form-select" value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)}>
                        <option value="">Todos os leads</option>
                        {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Filtrar por Campanha</label>
                    <select className="form-select" value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                        <option value="">Todas as campanhas</option>
                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Formato</label>
                    <select className="form-select" value={format} onChange={e => setFormat(e.target.value)}>
                        <option value="json">JSON</option>
                        <option value="csv">CSV (Excel)</option>
                        <option value="vcard">📇 vCard (Contatos)</option>
                    </select>
                </div>
            </div>

            {/* Opções do vCard */}
            {format === 'vcard' && (
                <div style={{
                    marginTop: 16,
                    padding: 20,
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.05))',
                    borderRadius: 12,
                    border: '1px solid rgba(99, 102, 241, 0.3)'
                }}>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            📇 Nome base dos contatos
                        </label>
                        <input
                            className="form-input"
                            value={vcardNamePattern}
                            onChange={e => setVcardNamePattern(e.target.value)}
                            placeholder="Ex: Lead Recuperação, Cliente VIP, etc."
                        />
                    </div>

                    <div style={{
                        padding: 12,
                        background: 'var(--bg-primary)',
                        borderRadius: 8,
                        fontSize: '0.85rem'
                    }}>
                        <strong>Preview:</strong>
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {[1, 2, 3].map(n => {
                                const num = String(n).padStart(2, '0');
                                const baseName = vcardNamePattern.trim() || 'Contato';
                                return (
                                    <div key={n} style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>
                                        {baseName} {num}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <button className="btn btn-primary" onClick={handleExport} disabled={loading} style={{ marginTop: 20 }}>
                <Download size={16} /> {loading ? 'Exportando...' : format === 'vcard' ? 'Baixar vCard (.vcf)' : 'Exportar Leads'}
            </button>

            {format === 'vcard' && (
                <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    💡 O arquivo .vcf pode ser importado diretamente na agenda do celular (iPhone, Android) ou no WhatsApp Business.
                </p>
            )}
        </div>
    );
}

// ==============================
// IMPORT LEADS TAB
// ==============================
function ImportLeads() {
    const [sellers, setSellers] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [subcampaigns, setSubcampaigns] = useState([]);
    const [fileData, setFileData] = useState('');
    const [fileName, setFileName] = useState('');
    const [selectedSeller, setSelectedSeller] = useState('');
    const [selectedCampaign, setSelectedCampaign] = useState('');
    const [selectedSubcampaign, setSelectedSubcampaign] = useState('');
    const [distribute, setDistribute] = useState(false);
    const [inGroup, setInGroup] = useState(true);
    const [preserveInGroup, setPreserveInGroup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState(null);

    const fileInputRef = useRef(null);

    // Estados do modal de mapeamento
    const [showMapping, setShowMapping] = useState(false);
    const [parsedData, setParsedData] = useState([]);
    const [columns, setColumns] = useState([]);
    const [mapping, setMapping] = useState({ nome: '', email: '', telefone: '', produto: '' });

    useEffect(() => {
        api.getSellers().then(d => setSellers(d.sellers));
        api.getCampaigns({ active_only: true }).then(d => setCampaigns(d.campaigns));
        api.getSubcampaigns({ active_only: true }).then(d => setSubcampaigns(d.subcampaigns || [])).catch(() => { });
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (ev) => setFileData(ev.target.result);
        reader.readAsText(file);
    };

    // Parsear dados e extrair colunas
    const parseDataAndExtractColumns = (data) => {
        const trimmed = data.trim();
        const isJSON = trimmed.startsWith('[') || trimmed.startsWith('{');

        if (isJSON) {
            const parsed = JSON.parse(trimmed);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            if (arr.length > 0) {
                return { rows: arr, columns: Object.keys(arr[0]) };
            }
        } else {
            const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
            if (lines.length < 2) return { rows: [], columns: [] };
            const delimiter = lines[0].includes(';') ? ';' : ',';
            const cols = lines[0].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
            const rows = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
                const row = {};
                cols.forEach((col, idx) => { row[col] = values[idx] || ''; });
                rows.push(row);
            }
            return { rows, columns: cols };
        }
        return { rows: [], columns: [] };
    };

    // Auto-detectar mapeamento
    const autoDetectMapping = (cols) => {
        const m = { nome: '', email: '', telefone: '', produto: '' };
        cols.forEach(col => {
            const lower = col.toLowerCase();
            if (!m.nome && (lower.includes('nome') || lower.includes('name') || lower === 'first_name')) m.nome = col;
            if (!m.email && (lower.includes('email') || lower.includes('e-mail'))) m.email = col;
            if (!m.telefone && (lower.includes('telefone') || lower.includes('phone') || lower.includes('whatsapp') || lower.includes('celular'))) m.telefone = col;
            if (!m.produto && (lower.includes('produto') || lower.includes('product') || lower.includes('curso'))) m.produto = col;
        });
        return m;
    };

    // Abrir modal de mapeamento
    const handleOpenMapping = () => {
        if (!fileData.trim()) return;
        try {
            const { rows, columns: cols } = parseDataAndExtractColumns(fileData);
            if (cols.length === 0) {
                setToast({ type: 'error', message: 'Não foi possível detectar as colunas' });
                return;
            }
            setParsedData(rows);
            setColumns(cols);
            setMapping(autoDetectMapping(cols));
            setShowMapping(true);
        } catch (err) {
            setToast({ type: 'error', message: 'Erro ao ler arquivo: ' + err.message });
        }
    };

    // Importar com mapeamento
    const handleImportWithMapping = async () => {
        setLoading(true);
        setShowMapping(false);
        setToast(null);
        try {
            const leads = parsedData.map(row => ({
                nome: mapping.nome ? row[mapping.nome] : '',
                email: mapping.email ? row[mapping.email] : '',
                telefone: mapping.telefone ? row[mapping.telefone] : '',
                produto: mapping.produto ? row[mapping.produto] : ''
            }));

            let data = {
                leads,
                distribute,
                in_group: inGroup,
                preserve_in_group: preserveInGroup,
                update_existing: true
            };
            if (selectedSeller && !distribute) data.seller_id = parseInt(selectedSeller);
            if (selectedCampaign) data.campaign_id = parseInt(selectedCampaign);
            if (selectedSubcampaign) data.subcampaign_id = parseInt(selectedSubcampaign);

            const res = await api.importLeads(data);
            setToast({ type: 'success', imported: res.imported, updated: res.updated || 0, skipped: res.skipped, total: res.total });
            setFileData('');
            setFileName('');
            setParsedData([]);
            setTimeout(() => setToast(null), 8000);
        } catch (err) {
            setToast({ type: 'error', message: err.message });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setLoading(false);
        }
    };

    const previewRows = parsedData.slice(0, 3);

    return (
        <div className="card">
            <h3 style={{ marginBottom: 24 }}>📤 Importar Leads</h3>

            <div className="form-group">
                <label className="form-label">Arquivo (JSON ou CSV)</label>
                <input type="file" accept=".json,.csv" ref={fileInputRef} onChange={handleFileUpload} style={{ display: 'none' }} />
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()}>
                        <Upload size={16} /> Selecionar Arquivo
                    </button>
                    {fileName && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                            📄 {fileName}
                        </span>
                    )}
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Ou cole os dados diretamente (JSON ou CSV):</label>
                <textarea
                    className="form-textarea"
                    value={fileData}
                    onChange={e => { setFileData(e.target.value); setFileName(''); }}
                    rows={8}
                    placeholder={'JSON:\n[{"nome": "João", "email": "joao@email.com", "telefone": "11999999999"}]\n\nCSV:\nNome;Email;Telefone;Produto\nJoão Silva;joao@email.com;11999999999;Curso ABC'}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="form-group">
                    <label className="form-label">Campanha / Lançamento</label>
                    <select className="form-select" value={selectedCampaign} onChange={e => { setSelectedCampaign(e.target.value); setSelectedSubcampaign(''); }}>
                        <option value="">Nenhuma campanha</option>
                        {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Subcampanha (marcador)</label>
                    <select
                        className="form-select"
                        value={selectedSubcampaign}
                        onChange={e => setSelectedSubcampaign(e.target.value)}
                        disabled={!selectedCampaign}
                    >
                        <option value="">Nenhuma subcampanha</option>
                        {subcampaigns
                            .filter(sc => sc.campaign_id === parseInt(selectedCampaign))
                            .map(sc => (
                                <option key={sc.id} value={sc.id} style={{ color: sc.color }}>● {sc.name}</option>
                            ))}
                    </select>
                    {selectedSubcampaign && (
                        <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Leads existentes serão marcados com o ponto colorido
                        </div>
                    )}
                </div>

                <div className="form-group">
                    <label className="form-label">Atribuir para vendedora</label>
                    <select className="form-select" value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)} disabled={distribute}>
                        <option value="">Não atribuir</option>
                        {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="toggle">
                        <input type="checkbox" checked={distribute} onChange={e => setDistribute(e.target.checked)} />
                        <span className="toggle-slider"></span>
                    </label>
                    <span style={{ fontSize: '0.875rem' }}>Distribuir (Round-Robin)</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="toggle">
                        <input type="checkbox" checked={inGroup} onChange={e => setInGroup(e.target.checked)} disabled={preserveInGroup} />
                        <span className="toggle-slider"></span>
                    </label>
                    <span style={{ fontSize: '0.875rem', opacity: preserveInGroup ? 0.5 : 1 }}>Marcar como "No grupo"</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="toggle">
                        <input type="checkbox" checked={preserveInGroup} onChange={e => setPreserveInGroup(e.target.checked)} />
                        <span className="toggle-slider"></span>
                    </label>
                    <span style={{ fontSize: '0.875rem' }}>Não alterar "grupo" (manter atual)</span>
                </div>
            </div>

            <button className="btn btn-primary" onClick={handleOpenMapping} disabled={loading || !fileData} style={{ marginTop: 24 }}>
                <Upload size={16} /> {loading ? 'Importando...' : 'Continuar →'}
            </button>

            {/* Modal de Mapeamento de Colunas */}
            {showMapping && (
                <div className="modal-overlay" onClick={() => setShowMapping(false)}>
                    <div className="modal slide-up" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🗂️ Mapear Colunas</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowMapping(false)}><X size={18} /></button>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                            Identifique qual coluna do arquivo corresponde a cada campo:
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">👤 Coluna do NOME</label>
                                <select className="form-select" value={mapping.nome} onChange={e => setMapping({ ...mapping, nome: e.target.value })}>
                                    <option value="">-- Não importar --</option>
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">📧 Coluna do EMAIL</label>
                                <select className="form-select" value={mapping.email} onChange={e => setMapping({ ...mapping, email: e.target.value })}>
                                    <option value="">-- Não importar --</option>
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">📱 Coluna do TELEFONE</label>
                                <select className="form-select" value={mapping.telefone} onChange={e => setMapping({ ...mapping, telefone: e.target.value })}>
                                    <option value="">-- Não importar --</option>
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label">📦 Coluna do PRODUTO</label>
                                <select className="form-select" value={mapping.produto} onChange={e => setMapping({ ...mapping, produto: e.target.value })}>
                                    <option value="">-- Não importar --</option>
                                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Preview */}
                        <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: 16, marginBottom: 24 }}>
                            <p style={{ fontWeight: 600, marginBottom: 12 }}>📋 Preview ({parsedData.length} contatos)</p>
                            <div style={{ overflow: 'auto', maxHeight: 200 }}>
                                <table style={{ fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ color: '#6366f1' }}>Nome</th>
                                            <th style={{ color: '#6366f1' }}>Email</th>
                                            <th style={{ color: '#6366f1' }}>Telefone</th>
                                            <th style={{ color: '#6366f1' }}>Produto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row, i) => (
                                            <tr key={i}>
                                                <td>{mapping.nome ? row[mapping.nome] : '-'}</td>
                                                <td>{mapping.email ? row[mapping.email] : '-'}</td>
                                                <td>{mapping.telefone ? row[mapping.telefone] : '-'}</td>
                                                <td>{mapping.produto ? row[mapping.produto] : '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {parsedData.length > 3 && (
                                    <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 8 }}>
                                        ... e mais {parsedData.length - 3} contatos
                                    </p>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowMapping(false)}>
                                Cancelar
                            </button>
                            <button
                                className="btn btn-primary"
                                style={{ flex: 2 }}
                                onClick={handleImportWithMapping}
                                disabled={!mapping.email && !mapping.telefone}
                            >
                                <Check size={16} /> Importar {parsedData.length} Contatos
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast de Notificação Estilo ManyChat */}
            {toast && (
                <div style={{
                    position: 'fixed',
                    top: 24,
                    right: 24,
                    zIndex: 9999,
                    minWidth: 320,
                    padding: 0,
                    borderRadius: 16,
                    background: toast.type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    animation: 'slideIn 0.4s ease-out',
                    overflow: 'hidden'
                }}>
                    {toast.type === 'success' ? (
                        <div style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span style={{ fontSize: 24 }}>✅</span>
                                </div>
                                <div>
                                    <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700 }}>Importação Concluída!</div>
                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem' }}>{toast.total} contatos processados</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                                    <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>{toast.imported}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>Novos</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                                    <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>{toast.updated}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>Atualizados</div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '12px 16px', textAlign: 'center' }}>
                                    <div style={{ color: 'white', fontSize: '1.5rem', fontWeight: 800 }}>{toast.skipped}</div>
                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.75rem' }}>Ignorados</div>
                                </div>
                            </div>

                            <button
                                onClick={() => setToast(null)}
                                style={{ marginTop: 16, width: '100%', padding: '10px 16px', border: 'none', borderRadius: 8, background: 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Fechar
                            </button>
                        </div>
                    ) : (
                        <div style={{ padding: 24, color: 'white' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 24 }}>❌</span>
                                <div>
                                    <div style={{ fontWeight: 700 }}>Erro na Importação</div>
                                    <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{toast.message}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

        </div>
    );
}

// ==============================
// IMPORT HISTORY TAB
// ==============================
function ImportHistory() {
    const [imports, setImports] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadImports = () => {
        api.getImports().then(d => setImports(d.imports)).finally(() => setLoading(false));
    };

    useEffect(() => { loadImports(); }, []);

    const formatDate = (d) => new Date(d).toLocaleString('pt-BR');

    const handleRevert = async (uuid, name) => {
        if (!confirm(`Tem certeza que deseja REVERTER a importação "${name}"?\n\nTodos os leads desta importação serão DELETADOS permanentemente!`)) return;

        try {
            const result = await api.revertImport(uuid);
            alert(result.message);
            loadImports();
        } catch (err) {
            alert('Erro: ' + err.message);
        }
    };

    const handleDelete = async (uuid) => {
        if (!confirm('Deletar apenas o registro (os leads permanecerão)?')) return;
        await api.deleteImportRecord(uuid);
        loadImports();
    };

    if (loading) return <div className="card">Carregando...</div>;

    return (
        <div className="card">
            <h3 style={{ marginBottom: 24 }}>📜 Histórico de Importações</h3>

            {imports.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>Nenhuma importação registrada</p>
            ) : (
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Nome</th>
                                <th>Importados</th>
                                <th>Atualizados</th>
                                <th>Ignorados</th>
                                <th>Restantes</th>
                                <th>Campanha</th>
                                <th>Status</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {imports.map(imp => (
                                <tr key={imp.uuid} style={{ opacity: imp.is_reverted ? 0.5 : 1 }}>
                                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(imp.created_at)}</td>
                                    <td style={{ fontWeight: 500 }}>{imp.name}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ color: '#10b981', fontWeight: 600 }}>{imp.total_imported}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ color: '#6366f1', fontWeight: 600 }}>{imp.total_updated || 0}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{imp.total_skipped}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{imp.current_leads}</span>
                                    </td>
                                    <td style={{ fontSize: '0.75rem' }}>{imp.campaign_name || '-'}</td>
                                    <td>
                                        {imp.is_reverted ? (
                                            <span className="badge" style={{ background: '#ef444422', color: '#ef4444' }}>Revertida</span>
                                        ) : (
                                            <span className="badge" style={{ background: '#10b98122', color: '#10b981' }}>Ativa</span>
                                        )}
                                    </td>
                                    <td>
                                        {!imp.is_reverted && imp.current_leads > 0 && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ color: '#ef4444' }}
                                                onClick={() => handleRevert(imp.uuid, imp.name)}
                                                title="Reverter (deletar todos os leads)"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        )}
                                        {(imp.is_reverted || imp.current_leads === 0) && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => handleDelete(imp.uuid)}
                                                title="Remover registro"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 8 }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>ℹ️ Como funciona:</p>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: 20 }}>
                    <li><strong>Reverter:</strong> Deleta permanentemente todos os leads da importação</li>
                    <li><strong>Restantes:</strong> Quantidade atual de leads (pode diminuir se foram deletados manualmente)</li>
                    <li>Após reverter, você pode remover o registro do histórico</li>
                </ul>
            </div>
        </div>
    );
}

// ==============================
// STATUS SETTINGS TAB
// ==============================
function StatusSettings() {
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingStatus, setEditingStatus] = useState(null);
    const [formData, setFormData] = useState({ name: '', color: '#6366f1', is_conversion: false });
    const [error, setError] = useState('');
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const colors = [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
        '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
    ];

    const loadStatuses = () => {
        api.getAllStatuses()
            .then(d => setStatuses(d.statuses))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadStatuses(); }, []);

    const handleDragStart = (index) => { dragItem.current = index; };
    const handleDragEnter = (index) => { dragOverItem.current = index; };

    const handleDragEnd = async () => {
        const items = [...statuses];
        const [draggedItem] = items.splice(dragItem.current, 1);
        items.splice(dragOverItem.current, 0, draggedItem);
        setStatuses(items);
        dragItem.current = null;
        dragOverItem.current = null;

        // Salvar nova ordem
        const order = items.map(s => s.id);
        await api.updateStatusOrder(order);
    };

    const openCreateModal = () => {
        setEditingStatus(null);
        setFormData({ name: '', color: '#6366f1', is_conversion: false });
        setError('');
        setShowModal(true);
    };

    const openEditModal = (status) => {
        setEditingStatus(status);
        setFormData({ name: status.name, color: status.color, is_conversion: status.is_conversion });
        setError('');
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            setError('Nome é obrigatório');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (editingStatus) {
                await api.updateStatus(editingStatus.id, formData);
            } else {
                await api.createStatus(formData);
            }
            setShowModal(false);
            loadStatuses();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (status) => {
        if (!confirm(`Tem certeza que deseja deletar o status "${status.name}"?`)) return;

        try {
            await api.deleteStatus(status.id);
            loadStatuses();
        } catch (err) {
            alert(err.message);
        }
    };

    if (loading) return <div className="card">Carregando...</div>;

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h3 style={{ marginBottom: 4 }}>🏷️ Status de Leads</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                        Personalize os status para organizar seus leads
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openCreateModal}>
                    <Plus size={16} /> Novo Status
                </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.85rem' }}>
                Arraste para reordenar. A ordem será usada em filtros e listas.
            </p>

            <div>
                {statuses.map((status, index) => (
                    <div
                        key={status.id}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => e.preventDefault()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 16,
                            padding: 16,
                            background: 'var(--bg-primary)',
                            borderRadius: 12,
                            marginBottom: 8,
                            cursor: 'grab',
                            border: '1px solid var(--border)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                        }}
                    >
                        <GripVertical size={20} color="var(--text-secondary)" />

                        <div
                            style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                background: status.color,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <Tags size={16} color="white" />
                        </div>

                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                                {status.name}
                                {Boolean(status.is_conversion) && (
                                    <span className="badge" style={{ background: '#10b98122', color: '#10b981', fontSize: '0.65rem', padding: '2px 6px' }}>
                                        Conversão
                                    </span>
                                )}
                                {Boolean(status.is_system) && (
                                    <span className="badge" style={{ background: '#6366f122', color: '#6366f1', fontSize: '0.65rem', padding: '2px 6px' }}>
                                        Sistema
                                    </span>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => openEditModal(status)}
                                title="Editar"
                            >
                                <Edit2 size={14} />
                            </button>
                            {!status.is_system && (
                                <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: '#ef4444' }}
                                    onClick={() => handleDelete(status)}
                                    title="Deletar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 8 }}>
                <p style={{ fontWeight: 600, marginBottom: 8 }}>ℹ️ Dicas:</p>
                <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, paddingLeft: 20 }}>
                    <li><strong>Status de conversão:</strong> O status "Vendido" é usado para calcular métricas de conversão</li>
                    <li><strong>Status do sistema:</strong> Não podem ser deletados, mas podem ter nome e cor alterados</li>
                    <li>Você pode criar quantos status personalizados precisar</li>
                </ul>
            </div>

            {/* Modal de Criar/Editar Status */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal slide-up" style={{ maxWidth: 450 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editingStatus ? '✏️ Editar Status' : '➕ Novo Status'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nome do Status</label>
                            <input
                                className="form-input"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ex: Em Negociação"
                                disabled={editingStatus?.is_system && editingStatus?.is_conversion}
                            />
                            {editingStatus?.is_system && editingStatus?.is_conversion && (
                                <small style={{ color: 'var(--text-secondary)' }}>
                                    O nome do status de conversão não pode ser alterado
                                </small>
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Cor</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {colors.map(color => (
                                    <button
                                        key={color}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, color })}
                                        style={{
                                            width: 36,
                                            height: 36,
                                            borderRadius: 8,
                                            background: color,
                                            border: formData.color === color ? '3px solid white' : 'none',
                                            boxShadow: formData.color === color ? `0 0 0 2px ${color}` : 'none',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s',
                                        }}
                                    />
                                ))}
                            </div>
                            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cor personalizada:</span>
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                                    style={{ width: 40, height: 30, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                />
                            </div>
                        </div>

                        {!editingStatus && (
                            <div className="form-group" style={{ marginTop: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <label className="toggle">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_conversion}
                                            onChange={e => setFormData({ ...formData, is_conversion: e.target.checked })}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>
                                    <span>Marcar como status de conversão</span>
                                </div>
                                <small style={{ color: 'var(--text-secondary)', marginLeft: 52, display: 'block' }}>
                                    Status de conversão são contabilizados nas métricas de vendas
                                </small>
                            </div>
                        )}

                        {error && (
                            <div style={{ padding: 12, background: '#ef444422', borderRadius: 8, color: '#ef4444', marginTop: 16 }}>
                                {error}
                            </div>
                        )}

                        {/* Preview */}
                        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-primary)', borderRadius: 12 }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>Preview:</p>
                            <span
                                className="badge"
                                style={{
                                    background: formData.color + '22',
                                    color: formData.color,
                                    padding: '6px 12px',
                                    fontWeight: 600
                                }}
                            >
                                {formData.name || 'Nome do Status'}
                            </span>
                        </div>

                        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowModal(false)}>
                                Cancelar
                            </button>
                            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={saving}>
                                <Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
