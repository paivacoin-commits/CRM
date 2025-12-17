import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { TrendingUp, Users, CheckCircle, Clock, MessageSquare, CheckSquare, DollarSign, UserCheck, UserX, Filter } from 'lucide-react';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [campaigns, setCampaigns] = useState([]);
    const [subcampaigns, setSubcampaigns] = useState([]);
    const [campaignFilter, setCampaignFilter] = useState('');
    const [subcampaignFilter, setSubcampaignFilter] = useState('');
    const { isAdmin } = useAuth();

    const loadDashboard = (campaign_id, subcampaign_id) => {
        setLoading(true);
        const params = {};
        if (campaign_id) params.campaign_id = campaign_id;
        if (subcampaign_id) params.subcampaign_id = subcampaign_id;
        api.getDashboard(params).then(setData).finally(() => setLoading(false));
    };

    useEffect(() => {
        loadDashboard();
        if (isAdmin) {
            api.getCampaigns({ active_only: false }).then(d => setCampaigns(d.campaigns || []));
            api.getSubcampaigns({}).then(d => setSubcampaigns(d.subcampaigns || [])).catch(() => { });
        }
    }, [isAdmin]);

    useEffect(() => {
        loadDashboard(campaignFilter, subcampaignFilter);
    }, [campaignFilter, subcampaignFilter]);

    // Subcampanhas filtradas pela campanha selecionada
    const filteredSubcampaigns = subcampaigns.filter(sc =>
        !campaignFilter || sc.campaign_id === parseInt(campaignFilter)
    );

    if (loading && !data) return <div className="card">Carregando...</div>;
    if (!data) return <div className="card">Erro ao carregar dados</div>;

    return (
        <div className="fade-in">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <h1 className="page-title">{isAdmin ? 'Dashboard Administrativo' : 'Meu Painel'}</h1>
                {isAdmin && campaigns.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Filter size={16} color="var(--text-secondary)" />
                        <select
                            className="form-select"
                            style={{ minWidth: 180 }}
                            value={campaignFilter}
                            onChange={e => { setCampaignFilter(e.target.value); setSubcampaignFilter(''); }}
                        >
                            <option value="">Todas as Campanhas</option>
                            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {campaignFilter && filteredSubcampaigns.length > 0 && (
                            <select
                                className="form-select"
                                style={{ minWidth: 150 }}
                                value={subcampaignFilter}
                                onChange={e => setSubcampaignFilter(e.target.value)}
                            >
                                <option value="">Campanha Original</option>
                                {filteredSubcampaigns.map(sc => (
                                    <option key={sc.id} value={sc.id} style={{ color: sc.color }}>
                                        ● {sc.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                )}
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'rgba(99,102,241,0.2)', padding: 12, borderRadius: 12 }}><Users size={24} color="#6366f1" /></div>
                        <div><div className="stat-value">{data.summary.totalLeads}</div><div className="stat-label">Total de Leads</div></div>
                    </div>
                </div>
                {isAdmin && (
                    <div className="stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'rgba(245,158,11,0.2)', padding: 12, borderRadius: 12 }}><Clock size={24} color="#f59e0b" /></div>
                            <div><div className="stat-value">{data.summary.today}</div><div className="stat-label">Leads Hoje</div></div>
                        </div>
                    </div>
                )}
                {!isAdmin && (
                    <div className="stat-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ background: 'rgba(245,158,11,0.2)', padding: 12, borderRadius: 12 }}><Clock size={24} color="#f59e0b" /></div>
                            <div><div className="stat-value">{data.summary.pendingLeads}</div><div className="stat-label">Pendentes</div></div>
                        </div>
                    </div>
                )}
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'rgba(16,185,129,0.2)', padding: 12, borderRadius: 12 }}><CheckCircle size={24} color="#10b981" /></div>
                        <div><div className="stat-value">{isAdmin ? data.summary.totalConversions : data.summary.conversions}</div><div className="stat-label">Conversões Onboarding</div></div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'rgba(168,85,247,0.2)', padding: 12, borderRadius: 12 }}><TrendingUp size={24} color="#a855f7" /></div>
                        <div><div className="stat-value">{data.summary.conversionRate}%</div><div className="stat-label">Taxa de Onboarding</div></div>
                    </div>
                </div>
            </div>

            {/* Métricas Secundárias */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                <div style={{
                    background: 'var(--bg-secondary)',
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <CheckSquare size={20} color="#3b82f6" />
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>{data.summary.totalChecking || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Em Checking</div>
                    </div>
                </div>
                <div style={{
                    background: 'var(--bg-secondary)',
                    padding: 16,
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                }}>
                    <DollarSign size={20} color="#22c55e" />
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#22c55e' }}>{data.summary.totalSales || 0}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Vendas Concluídas</div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                {data.sellerPerformance && data.sellerPerformance.length > 0 && (
                    <div className="card">
                        <h3 style={{ marginBottom: 20 }}>📊 Performance das Vendedoras</h3>
                        <table><thead><tr><th>Vendedora</th><th>Leads</th><th>Conversões</th><th>Taxa</th></tr></thead><tbody>
                            {data.sellerPerformance.map(s => (
                                <tr key={s.id}><td>{s.name}</td><td>{s.total_leads}</td><td>{s.conversions}</td><td>{s.total_leads > 0 ? ((s.conversions / s.total_leads) * 100).toFixed(1) : 0}%</td></tr>
                            ))}
                        </tbody></table>
                    </div>
                )}

                <div className="card">
                    <h3 style={{ marginBottom: 20 }}><MessageSquare size={18} style={{ marginRight: 8 }} />Leads Recentes</h3>
                    {data.recentLeads?.length > 0 ? (
                        <table><thead><tr><th>Nome</th><th>Produto</th><th>Status</th></tr></thead><tbody>
                            {data.recentLeads.map(l => (
                                <tr key={l.uuid}><td>{l.first_name}</td><td>{l.product_name}</td><td><span className="badge" style={{ background: l.status_color + '22', color: l.status_color }}>{l.status_name}</span></td></tr>
                            ))}
                        </tbody></table>
                    ) : <p style={{ color: 'var(--text-secondary)' }}>Nenhum lead ainda</p>}
                </div>

                <div className="card">
                    <h3 style={{ marginBottom: 20 }}>📈 Por Status</h3>
                    {data.byStatus?.map(s => (
                        <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: s.color }} />{s.name}</span>
                            <strong>{s.count}</strong>
                        </div>
                    ))}
                </div>

                {/* Gráfico de Pizza - Grupo */}
                <div className="card">
                    <h3 style={{ marginBottom: 20 }}><Users size={18} style={{ marginRight: 8 }} />Leads por Grupo</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
                        {/* Gráfico de Pizza CSS */}
                        <div style={{
                            width: 140,
                            height: 140,
                            borderRadius: '50%',
                            background: `conic-gradient(
                                #10b981 0deg ${(data.summary.inGroup / (data.summary.totalLeads || 1)) * 360}deg,
                                #f59e0b ${(data.summary.inGroup / (data.summary.totalLeads || 1)) * 360}deg 360deg
                            )`,
                            position: 'relative',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'column'
                            }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{data.summary.totalLeads}</div>
                                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>Total</div>
                            </div>
                        </div>
                        {/* Legenda */}
                        <div style={{ display: 'grid', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 16, height: 16, borderRadius: 4, background: '#10b981' }} />
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No Grupo</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#10b981' }}>{data.summary.inGroup || 0}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ width: 16, height: 16, borderRadius: 4, background: '#f59e0b' }} />
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Fora do Grupo</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f59e0b' }}>{data.summary.outGroup || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
