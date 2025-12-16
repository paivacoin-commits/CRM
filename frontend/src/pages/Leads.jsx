import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { MessageSquare, Phone, Search, X, Send, UserX, UserCheck, Trash2, CheckSquare, Square, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Leads() {
    const { isAdmin } = useAuth();
    const [leads, setLeads] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [campaignFilter, setCampaignFilter] = useState('');
    const [inGroupFilter, setInGroupFilter] = useState('');
    const [selectedLead, setSelectedLead] = useState(null);
    const [observation, setObservation] = useState('');
    const [sellers, setSellers] = useState([]);
    const [sellerFilter, setSellerFilter] = useState('');

    // Paginação
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const LIMIT = 50;

    // Seleção múltipla
    const [selectedUuids, setSelectedUuids] = useState(new Set());
    const [selectAll, setSelectAll] = useState(false);
    const [totalSelected, setTotalSelected] = useState(0);

    // Auto-refresh
    const [autoRefresh, setAutoRefresh] = useState(true);

    // Refs para manter valores atualizados no interval
    const filtersRef = useRef({ search, statusFilter, campaignFilter, inGroupFilter, sellerFilter, page });

    // Atualizar ref quando filtros mudam
    useEffect(() => {
        filtersRef.current = { search, statusFilter, campaignFilter, inGroupFilter, sellerFilter, page };
    }, [search, statusFilter, campaignFilter, inGroupFilter, sellerFilter, page]);

    const loadLeads = useCallback(async () => {
        const { search, statusFilter, campaignFilter, inGroupFilter, sellerFilter, page } = filtersRef.current;
        const params = { page, limit: LIMIT };
        if (search) params.search = search;
        if (statusFilter) params.status = statusFilter;
        if (campaignFilter) params.campaign_id = campaignFilter;
        if (inGroupFilter) params.in_group = inGroupFilter;
        if (sellerFilter) params.seller_id = sellerFilter;
        try {
            const data = await api.getLeads(params);
            setLeads(data.leads);
            setPagination(data.pagination || { total: data.leads.length, pages: 1 });
        } catch (e) {
            console.error('Erro ao carregar leads:', e);
        }
        setLoading(false);
    }, []);

    // Carregamento inicial
    useEffect(() => {
        api.getStatuses().then(d => setStatuses(d.statuses));
        if (isAdmin) {
            api.getCampaigns({ active_only: true }).then(d => setCampaigns(d.campaigns));
            api.getSellers().then(d => setSellers(d.sellers || []));
        }
        loadLeads();
    }, [loadLeads, isAdmin]);

    // Recarregar quando filtros ou página mudam
    useEffect(() => {
        const t = setTimeout(loadLeads, 300);
        return () => clearTimeout(t);
    }, [search, statusFilter, campaignFilter, inGroupFilter, sellerFilter, page, loadLeads]);

    // Reset página quando filtros mudam
    useEffect(() => {
        setPage(1);
        setSelectedUuids(new Set());
        setSelectAll(false);
    }, [search, statusFilter, campaignFilter, inGroupFilter, sellerFilter]);

    // Auto-refresh a cada 5 segundos
    useEffect(() => {
        let interval = null;
        if (autoRefresh) {
            interval = setInterval(loadLeads, 5000);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [autoRefresh, loadLeads]);

    const updateStatus = async (uuid, status_id) => {
        await api.updateLeadStatus(uuid, status_id);
        loadLeads();
        if (selectedLead?.uuid === uuid) setSelectedLead({ ...selectedLead, status_id });
    };

    const toggleInGroup = async (uuid, current) => {
        await api.updateLeadInGroup(uuid, !current);
        loadLeads();
        if (selectedLead?.uuid === uuid) setSelectedLead({ ...selectedLead, in_group: !current });
    };

    const addObs = async () => {
        if (!observation.trim()) return;
        const result = await api.addObservation(selectedLead.uuid, observation);
        setSelectedLead({ ...selectedLead, observations: result.observations });
        setObservation('');
        loadLeads();
    };

    // Seleção individual
    const toggleSelect = (uuid) => {
        const newSet = new Set(selectedUuids);
        if (newSet.has(uuid)) {
            newSet.delete(uuid);
            setSelectAll(false);
        } else {
            newSet.add(uuid);
        }
        setSelectedUuids(newSet);
        setTotalSelected(newSet.size);
    };

    // Selecionar TODOS os leads (busca todos os UUIDs do servidor)
    const toggleSelectAll = async () => {
        if (selectAll) {
            setSelectedUuids(new Set());
            setSelectAll(false);
            setTotalSelected(0);
        } else {
            // Buscar TODOS os UUIDs do servidor (não só da página)
            const params = {};
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            if (campaignFilter) params.campaign_id = campaignFilter;
            if (inGroupFilter) params.in_group = inGroupFilter;
            if (sellerFilter) params.seller_id = sellerFilter;

            const data = await api.getAllLeadUuids(params);
            setSelectedUuids(new Set(data.uuids));
            setSelectAll(true);
            setTotalSelected(data.total);
        }
    };

    const deleteSelected = async () => {
        if (selectedUuids.size === 0) return;
        if (!confirm(`Tem certeza que deseja excluir ${selectedUuids.size} lead(s)?`)) return;

        await api.deleteLeadsBulk(Array.from(selectedUuids));
        setSelectedUuids(new Set());
        setSelectAll(false);
        setTotalSelected(0);
        loadLeads();
    };

    const formatPhone = (phone) => phone?.replace(/\D/g, '') || '';
    const formatDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Leads {autoRefresh && <span style={{ fontSize: '0.6rem', color: '#10b981', marginLeft: 8, fontWeight: 400 }}>● LIVE</span>}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="toggle" style={{ transform: 'scale(0.8)' }}>
                        <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
                        <span className="toggle-slider"></span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: autoRefresh ? '#10b981' : 'var(--text-secondary)' }}>
                        {autoRefresh ? 'Atualização automática' : 'Automático desligado'}
                    </span>
                </div>
            </div>

            {/* Filtros */}
            <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input className="form-input" style={{ paddingLeft: 40 }} placeholder="Buscar por nome, email ou telefone..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="form-select" style={{ width: 130 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">Status</option>
                        {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {isAdmin && campaigns.length > 0 && (
                        <select className="form-select" style={{ width: 150 }} value={campaignFilter} onChange={e => setCampaignFilter(e.target.value)}>
                            <option value="">Campanhas</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                    {isAdmin && sellers.length > 0 && (
                        <select className="form-select" style={{ width: 150 }} value={sellerFilter} onChange={e => setSellerFilter(e.target.value)}>
                            <option value="">Vendedora</option>
                            {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <select className="form-select" style={{ width: 130 }} value={inGroupFilter} onChange={e => setInGroupFilter(e.target.value)}>
                        <option value="">Grupo</option>
                        <option value="true">No grupo</option>
                        <option value="false">Fora</option>
                    </select>
                </div>
            </div>

            {/* Barra de ações em massa */}
            {isAdmin && (
                <div className="card" style={{ marginBottom: 16, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16, background: selectedUuids.size > 0 ? 'rgba(239, 68, 68, 0.1)' : undefined }}>
                    <button className="btn btn-ghost btn-sm" onClick={toggleSelectAll}>
                        {selectAll ? <CheckSquare size={16} /> : <Square size={16} />}
                        {selectAll ? ` Desmarcar todos (${totalSelected})` : ` Selecionar todos (${pagination.total})`}
                    </button>

                    {selectedUuids.size > 0 && (
                        <>
                            <span style={{ color: '#ef4444', fontSize: '0.875rem', fontWeight: 600 }}>
                                {selectedUuids.size} selecionado(s)
                            </span>
                            <button className="btn btn-danger btn-sm" onClick={deleteSelected}>
                                <Trash2 size={14} /> Excluir {selectedUuids.size}
                            </button>
                        </>
                    )}

                    <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        Total: {pagination.total} leads
                    </span>
                </div>
            )}

            {/* Tabela */}
            <div className="card">
                {loading ? <p>Carregando...</p> : leads.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Nenhum lead encontrado</p> : (
                    <div className="table-container">
                        <table>
                            <thead><tr>
                                {isAdmin && <th style={{ width: 40 }}></th>}
                                <th>Nome</th>
                                <th>Contato</th>
                                <th>Status</th>
                                <th>Grupo</th>
                                {isAdmin && <th>Campanha</th>}
                                <th>Data</th>
                                <th>Ações</th>
                            </tr></thead>
                            <tbody>
                                {leads.map(lead => (
                                    <tr key={lead.uuid} style={{ background: selectedUuids.has(lead.uuid) ? 'rgba(99, 102, 241, 0.1)' : undefined }}>
                                        {isAdmin && (
                                            <td>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => toggleSelect(lead.uuid)}
                                                    style={{ padding: 4 }}
                                                >
                                                    {selectedUuids.has(lead.uuid) ? <CheckSquare size={16} color="var(--accent)" /> : <Square size={16} />}
                                                </button>
                                            </td>
                                        )}
                                        <td>
                                            <strong>{lead.first_name}</strong>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{lead.email}</div>
                                        </td>
                                        <td>
                                            {lead.phone ? (
                                                <a href={`https://wa.me/${formatPhone(lead.phone)}`} target="_blank" rel="noopener" className="whatsapp-btn" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                                                    <Phone size={12} /> WhatsApp
                                                </a>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <select className="form-select" style={{ width: 110, padding: '4px 8px', fontSize: '0.75rem' }} value={lead.status_id} onChange={e => updateStatus(lead.uuid, parseInt(e.target.value))}>
                                                {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                className="btn btn-sm"
                                                style={{
                                                    background: lead.in_group ? '#10b98122' : '#f59e0b22',
                                                    color: lead.in_group ? '#10b981' : '#f59e0b',
                                                    border: 'none',
                                                    padding: '4px 8px',
                                                    fontSize: '0.75rem'
                                                }}
                                                onClick={() => toggleInGroup(lead.uuid, lead.in_group)}
                                            >
                                                {lead.in_group ? <UserCheck size={12} /> : <UserX size={12} />}
                                                {lead.in_group ? ' Sim' : ' Não'}
                                            </button>
                                        </td>
                                        {isAdmin && (
                                            <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                                {lead.campaign_name || '-'}
                                            </td>
                                        )}
                                        <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{formatDate(lead.created_at)}</td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" style={{ padding: 4 }} onClick={() => { setSelectedLead(lead); setObservation(''); }}>
                                                <MessageSquare size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Paginação */}
                {pagination.pages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            style={{ opacity: page === 1 ? 0.5 : 1 }}
                        >
                            <ChevronLeft size={16} /> Anterior
                        </button>

                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                let pageNum;
                                if (pagination.pages <= 5) {
                                    pageNum = i + 1;
                                } else if (page <= 3) {
                                    pageNum = i + 1;
                                } else if (page >= pagination.pages - 2) {
                                    pageNum = pagination.pages - 4 + i;
                                } else {
                                    pageNum = page - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        className="btn btn-sm"
                                        onClick={() => setPage(pageNum)}
                                        style={{
                                            background: page === pageNum ? 'var(--accent)' : 'var(--bg-hover)',
                                            color: page === pageNum ? 'white' : 'var(--text-secondary)',
                                            minWidth: 36,
                                            padding: '6px 10px'
                                        }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                            {pagination.pages > 5 && page < pagination.pages - 2 && (
                                <>
                                    <span style={{ color: 'var(--text-secondary)' }}>...</span>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setPage(pagination.pages)} style={{ minWidth: 36 }}>
                                        {pagination.pages}
                                    </button>
                                </>
                            )}
                        </div>

                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                            disabled={page === pagination.pages}
                            style={{ opacity: page === pagination.pages ? 0.5 : 1 }}
                        >
                            Próximo <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Modal do Lead */}
            {selectedLead && (
                <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
                    <div className="modal slide-up" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{selectedLead.first_name}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLead(null)}><X size={18} /></button>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <p><strong>Email:</strong> {selectedLead.email}</p>
                            <p><strong>Telefone:</strong> {selectedLead.phone || '-'}</p>
                            <p><strong>Produto:</strong> {selectedLead.product_name}</p>
                            <p><strong>Entrou no grupo:</strong>
                                <span style={{ marginLeft: 8, color: selectedLead.in_group ? '#10b981' : '#f59e0b' }}>
                                    {selectedLead.in_group ? 'Sim ✓' : 'Não ✗'}
                                </span>
                            </p>
                            {selectedLead.campaign_name && <p><strong>Campanha:</strong> {selectedLead.campaign_name}</p>}
                            {selectedLead.phone && <a href={`https://wa.me/${formatPhone(selectedLead.phone)}`} target="_blank" rel="noopener" className="whatsapp-btn" style={{ marginTop: 12 }}><Phone size={14} /> Abrir WhatsApp</a>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Histórico de Observações</label>
                            <div style={{ background: 'var(--bg-primary)', padding: 16, borderRadius: 8, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                {selectedLead.observations || 'Nenhuma observação ainda'}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Adicionar Observação</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <textarea className="form-textarea" style={{ minHeight: 60 }} value={observation} onChange={e => setObservation(e.target.value)} placeholder="Digite sua observação..." />
                                <button className="btn btn-primary" onClick={addObs} disabled={!observation.trim()}><Send size={16} /></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
