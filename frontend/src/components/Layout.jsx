import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, Users, FileText, LogOut, Settings, FolderOpen } from 'lucide-react';

export default function Layout({ children }) {
    const { user, logout, isAdmin } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <div className="app">
            <aside className="sidebar">
                <div className="logo">🚀 Recovery CRM</div>
                <nav>
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <LayoutDashboard size={20} /> Dashboard
                    </NavLink>
                    <NavLink to="/leads" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <FileText size={20} /> Leads
                    </NavLink>
                    {isAdmin && (
                        <>
                            <NavLink to="/users" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                <Users size={20} /> Vendedoras
                            </NavLink>
                            <NavLink to="/campaigns" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                <FolderOpen size={20} /> Campanhas
                            </NavLink>
                            <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                <Settings size={20} /> Configurações
                            </NavLink>
                        </>
                    )}
                    {!isAdmin && (
                        <NavLink to="/my-settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <Settings size={20} /> Configurações
                        </NavLink>
                    )}
                </nav>
                <div className="user-info">
                    <div className="user-name">{user?.name}</div>
                    <div className="user-role">{user?.role === 'admin' ? 'Administrador' : 'Vendedora'}</div>
                    <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ marginTop: 12, width: '100%' }}>
                        <LogOut size={16} /> Sair
                    </button>
                </div>
            </aside>
            <main className="main-content">{children}</main>
        </div>
    );
}
