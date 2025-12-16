import { useState, useEffect } from 'react';
import { api } from '../api';
import { FolderPlus, X, Edit2, Archive, RotateCcw, Users, AlertTriangle, Trash2 } from 'lucide-react';

export default function Campaigns() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editCampaign, setEditCampaign] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const [form, setForm] = useState({ name: '', description: '' });

    const loadCampaigns = () => {
        api.getCampaigns({ active_only: !showArchived }).then(d => setCampaigns(d.campaigns)).finally(() => setLoading(false));
    };

    useEffect(() => { loadCampaigns(); }, [showArchived]);

    const openNew = () => { setEditCampaign(null); setForm({ name: '', description: '' }); setShowModal(true); };
    const openEdit = (c) => { setEditCampaign(c); setForm({ name: c.name, description: c.description || '' }); setShowModal(true); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editCampaign) {
            await api.updateCampaign(editCampaign.uuid, form);
        } else {
            await api.createCampaign(form);
        }
        setShowModal(false);
        loadCampaigns();
    };

    const handleArchive = async (uuid) => {
        if (confirm('Tem certeza que deseja arquivar esta campanha? Os leads serão desativados.')) {
            await api.deleteCampaign(uuid);
            loadCampaigns();
        }
    };

    const handleActivate = async (uuid) => {
        await api.activateCampaign(uuid);
        loadCampaigns();
    };

    const handleDelete = async (uuid) => {
        if (confirm('Tem certeza que deseja EXCLUIR PERMANENTEMENTE esta campanha? Esta ação não pode ser desfeita.')) {
            await api.deleteCampaign(uuid);
            loadCampaigns();
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title"><FolderPlus size={28} style={{ marginRight: 12 }} />Campanhas / Lançamentos</h1>
                <button className="btn btn-primary" onClick={openNew}><FolderPlus size={18} /> Nova Campanha</button>
            </div>

            <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label className="toggle">
                        <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
                        <span className="toggle-slider"></span>
                    </label>
                    <span>Mostrar campanhas arquivadas</span>
                </div>
            </div>

            <div className="card">
                {loading ? <p>Carregando...</p> : campaigns.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                        <FolderPlus size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                        <p>Nenhuma campanha encontrada</p>
                        <p style={{ fontSize: '0.875rem' }}>Crie uma campanha para organizar seus lançamentos</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 16 }}>
                        {campaigns.map(c => (
                            <div key={c.uuid} style={{
                                display: 'flex', alignItems: 'center', gap: 16, padding: 20,
                                background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border)',
                                opacity: c.is_active ? 1 : 0.6
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: 12,
                                    background: c.is_active ? 'linear-gradient(135deg, var(--accent), #7c3aed)' : 'var(--border)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.2rem'
                                }}>
                                    {c.name.charAt(0).toUpperCase()}
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <h3 style={{ margin: 0 }}>{c.name}</h3>
                                        {!c.is_active && <span className="badge" style={{ background: '#ef444422', color: '#ef4444' }}>Arquivada</span>}
                                    </div>
                                    {c.description && <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{c.description}</p>}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginRight: 16 }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{c.total_leads || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Leads</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c.not_in_group > 0 ? '#f59e0b' : '#10b981' }}>{c.not_in_group || 0}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Fora do grupo</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(c)}><Edit2 size={14} /></button>
                                    {c.is_active ? (
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--warning)' }} onClick={() => handleArchive(c.uuid)} title="Arquivar"><Archive size={14} /></button>
                                    ) : (
                                        <>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleActivate(c.uuid)} title="Reativar"><RotateCcw size={14} /></button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(c.uuid)} title="Excluir permanentemente"><Trash2 size={14} /></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="modal slide-up">
                        <div className="modal-header">
                            <h3>{editCampaign ? 'Editar Campanha' : 'Nova Campanha'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-group">
                                <label className="form-label">Nome da Campanha</label>
                                <input className="form-input" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ex: Lançamento Janeiro 2024" required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Descrição (opcional)</label>
                                <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Notas sobre esta campanha..." />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{editCampaign ? 'Salvar' : 'Criar Campanha'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
