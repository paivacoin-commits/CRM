import { useState, useEffect } from 'react';
import { api } from '../api';
import { UserPlus, X, Edit2, Trash2 } from 'lucide-react';

export default function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'seller' });

    const loadUsers = () => api.getUsers().then(d => setUsers(d.users)).finally(() => setLoading(false));
    useEffect(() => { loadUsers(); }, []);

    const openNew = () => { setEditUser(null); setForm({ name: '', email: '', password: '', role: 'seller' }); setShowModal(true); };
    const openEdit = (u) => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setShowModal(true); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editUser) {
            const updates = { name: form.name, email: form.email, role: form.role };
            if (form.password) updates.password = form.password;
            await api.updateUser(editUser.uuid, updates);
        } else {
            await api.createUser(form);
        }
        setShowModal(false);
        loadUsers();
    };

    const toggleDist = async (uuid, current) => {
        await api.toggleDistribution(uuid, !current);
        loadUsers();
    };

    const handleDelete = async (uuid) => {
        if (confirm('Deseja realmente desativar este usuário?')) {
            await api.deleteUser(uuid);
            loadUsers();
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h1 className="page-title">Vendedoras</h1>
                <button className="btn btn-primary" onClick={openNew}><UserPlus size={18} /> Nova Vendedora</button>
            </div>

            <div className="card">
                {loading ? <p>Carregando...</p> : (
                    <div className="table-container">
                        <table>
                            <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Leads</th><th>Conversões</th><th>Na Distribuição</th><th>Ações</th></tr></thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.uuid}>
                                        <td><strong>{u.name}</strong></td>
                                        <td>{u.email}</td>
                                        <td><span className="badge" style={{ background: u.role === 'admin' ? '#6366f122' : '#10b98122', color: u.role === 'admin' ? '#6366f1' : '#10b981' }}>{u.role === 'admin' ? 'Admin' : 'Vendedora'}</span></td>
                                        <td>{u.total_leads || 0}</td>
                                        <td>{u.conversions || 0}</td>
                                        <td>
                                            {u.role === 'seller' && (
                                                <label className="toggle">
                                                    <input type="checkbox" checked={!!u.is_in_distribution} onChange={() => toggleDist(u.uuid, u.is_in_distribution)} />
                                                    <span className="toggle-slider"></span>
                                                </label>
                                            )}
                                        </td>
                                        <td style={{ display: 'flex', gap: 8 }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}><Edit2 size={14} /></button>
                                            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(u.uuid)}><Trash2 size={14} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showModal && (
                <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
                    <div className="modal slide-up">
                        <div className="modal-header">
                            <h3>{editUser ? 'Editar Usuário' : 'Nova Vendedora'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <form onSubmit={handleSubmit} autoComplete="off">
                            <div className="form-group">
                                <label className="form-label">Nome</label>
                                <input className="form-input" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input type="email" className="form-input" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{editUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}</label>
                                <input type="password" className="form-input" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editUser} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Perfil</label>
                                <select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                    <option value="seller">Vendedora</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{editUser ? 'Salvar' : 'Criar'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
