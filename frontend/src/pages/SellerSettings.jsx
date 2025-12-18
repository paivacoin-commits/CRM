import { useState, useEffect } from 'react';
import { api } from '../api';
import { Settings as SettingsIcon, MessageCircle, Plus, Edit2, Trash2, X, Download } from 'lucide-react';

export default function SellerSettings() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState(null);
    const [form, setForm] = useState({ name: '', message: '' });

    // Estados para exportação vCard
    const [vcardName, setVcardName] = useState('');
    const [exporting, setExporting] = useState(false);

    const loadTemplates = () => {
        api.getWhatsAppTemplates().then(d => setTemplates(d.templates || [])).finally(() => setLoading(false));
    };

    useEffect(() => { loadTemplates(); }, []);

    const openNew = () => { setEditTemplate(null); setForm({ name: '', message: '' }); setShowModal(true); };
    const openEdit = (t) => { setEditTemplate(t); setForm({ name: t.name, message: t.message }); setShowModal(true); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editTemplate) {
            await api.updateWhatsAppTemplate(editTemplate.uuid, form);
        } else {
            await api.createWhatsAppTemplate(form);
        }
        setShowModal(false);
        loadTemplates();
    };

    const handleDelete = async (uuid) => {
        if (confirm('Tem certeza que deseja excluir este template?')) {
            await api.deleteWhatsAppTemplate(uuid);
            loadTemplates();
        }
    };

    // Função para gerar vCard
    const generateVCard = (lead, baseName, numero) => {
        const contactName = `${baseName} ${numero}`;
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

    // Exportar leads da vendedora como vCard
    const handleExportVCard = async () => {
        if (!vcardName.trim()) {
            alert('Digite um nome base para os contatos');
            return;
        }

        setExporting(true);
        try {
            // Buscar leads da vendedora (sem filtro de seller_id, o backend já filtra pelo usuário logado)
            const data = await api.getLeads({ limit: 10000 });
            const leads = data.leads || [];

            if (leads.length === 0) {
                alert('Nenhum lead encontrado para exportar');
                return;
            }

            // Gerar vCards
            const vcards = leads.map((lead, index) => {
                const numero = String(index + 1).padStart(2, '0');
                return generateVCard(lead, vcardName.trim(), numero);
            }).join('\n');

            // Download
            const blob = new Blob([vcards], { type: 'text/vcard;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${vcardName.trim().replace(/\s+/g, '_')}_${leads.length}.vcf`;
            a.click();

            alert(`✅ Exportados ${leads.length} contatos!`);
        } catch (err) {
            alert('Erro ao exportar: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title"><SettingsIcon size={28} style={{ marginRight: 12 }} />Minhas Configurações</h1>
            </div>

            {/* Card de Exportação vCard */}
            <div className="card" style={{ marginBottom: 24 }}>
                <h3 style={{ marginBottom: 16 }}><Download size={20} style={{ marginRight: 8 }} /> Exportar Meus Contatos</h3>

                <p style={{ color: 'var(--text-secondary)', marginBottom: 16, fontSize: '0.875rem' }}>
                    Exporte seus leads em formato vCard (.vcf) para importar no celular ou WhatsApp Business.
                </p>

                <div style={{
                    padding: 20,
                    background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.1), rgba(18, 140, 126, 0.05))',
                    borderRadius: 12,
                    border: '1px solid rgba(37, 211, 102, 0.3)'
                }}>
                    <div className="form-group" style={{ marginBottom: 16 }}>
                        <label className="form-label">📇 Nome base dos contatos</label>
                        <input
                            className="form-input"
                            value={vcardName}
                            onChange={e => setVcardName(e.target.value)}
                            placeholder="Ex: Lead Recuperação, Cliente, etc."
                        />
                    </div>

                    {vcardName.trim() && (
                        <div style={{
                            padding: 12,
                            background: 'var(--bg-primary)',
                            borderRadius: 8,
                            fontSize: '0.85rem',
                            marginBottom: 16
                        }}>
                            <strong>Preview:</strong>
                            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {[1, 2, 3].map(n => (
                                    <div key={n} style={{ color: '#25D366', fontFamily: 'monospace' }}>
                                        {vcardName.trim()} {String(n).padStart(2, '0')}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={handleExportVCard}
                        disabled={exporting || !vcardName.trim()}
                        style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                    >
                        <Download size={16} /> {exporting ? 'Exportando...' : 'Baixar vCard (.vcf)'}
                    </button>

                    <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        💡 O arquivo pode ser importado diretamente na agenda do celular.
                    </p>
                </div>
            </div>

            {/* Card de Templates WhatsApp */}
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h3><MessageCircle size={20} style={{ marginRight: 8 }} /> Templates de WhatsApp</h3>
                    <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Novo Template</button>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.875rem' }}>
                    Crie templates de mensagens para usar ao entrar em contato com leads. Use <code>{'{nome}'}</code> e <code>{'{produto}'}</code> para substituição automática.
                </p>

                {loading ? <p>Carregando...</p> : templates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                        <MessageCircle size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <p>Nenhum template criado ainda</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {templates.map(t => (
                            <div key={t.uuid} style={{
                                padding: 16, background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <strong style={{ fontSize: '1rem' }}>{t.name}</strong>
                                        <p style={{ color: 'var(--text-secondary)', marginTop: 8, whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                                            {t.message}
                                        </p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(t)}><Edit2 size={14} /></button>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(t.uuid)}><Trash2 size={14} /></button>
                                    </div>
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
        </div>
    );
}
