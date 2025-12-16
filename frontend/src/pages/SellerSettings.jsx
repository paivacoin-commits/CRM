import { useState, useEffect } from 'react';
import { api } from '../api';
import { Settings as SettingsIcon, MessageCircle, Plus, Edit2, Trash2, X } from 'lucide-react';

export default function SellerSettings() {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTemplate, setEditTemplate] = useState(null);
    const [form, setForm] = useState({ name: '', message: '' });

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

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title"><SettingsIcon size={28} style={{ marginRight: 12 }} />Minhas Configurações</h1>
            </div>

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
