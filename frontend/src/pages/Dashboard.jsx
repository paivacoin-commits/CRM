import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { TrendingUp, Users, CheckCircle, Clock, MessageSquare } from 'lucide-react';

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const { isAdmin } = useAuth();

    useEffect(() => {
        api.getDashboard().then(setData).finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="card">Carregando...</div>;
    if (!data) return <div className="card">Erro ao carregar dados</div>;

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">{isAdmin ? 'Dashboard Administrativo' : 'Meu Painel'}</h1>
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
                        <div><div className="stat-value">{isAdmin ? data.summary.totalConversions : data.summary.conversions}</div><div className="stat-label">Conversões</div></div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ background: 'rgba(168,85,247,0.2)', padding: 12, borderRadius: 12 }}><TrendingUp size={24} color="#a855f7" /></div>
                        <div><div className="stat-value">{data.summary.conversionRate}%</div><div className="stat-label">Taxa de Conversão</div></div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr', gap: 24 }}>
                {isAdmin && data.sellerPerformance && (
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
            </div>
        </div>
    );
}
