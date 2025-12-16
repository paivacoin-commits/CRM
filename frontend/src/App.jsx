import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Campaigns from './pages/Campaigns';
import Layout from './components/Layout';

function PrivateRoute({ children, adminOnly = false }) {
    const { user, loading, isAdmin } = useAuth();
    if (loading) return <div className="login-container"><div className="card">Carregando...</div></div>;
    if (!user) return <Navigate to="/login" />;
    if (adminOnly && !isAdmin) return <Navigate to="/" />;
    return children;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
                    <Route path="/leads" element={<PrivateRoute><Layout><Leads /></Layout></PrivateRoute>} />
                    <Route path="/users" element={<PrivateRoute adminOnly><Layout><Users /></Layout></PrivateRoute>} />
                    <Route path="/campaigns" element={<PrivateRoute adminOnly><Layout><Campaigns /></Layout></PrivateRoute>} />
                    <Route path="/settings" element={<PrivateRoute adminOnly><Layout><Settings /></Layout></PrivateRoute>} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    );
}
