// Detecta automaticamente se está em produção ou desenvolvimento
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001/api'
    : 'https://crmsales-recovery-crm-api.onrender.com/api';

async function request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await res.json();

    if (!res.ok) {
        if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; }
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

export const api = {
    login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    getMe: () => request('/auth/me'),
    getDashboard: (params = {}) => request(`/dashboard?${new URLSearchParams(params)}`),
    getLeads: (params = {}) => request(`/leads?${new URLSearchParams(params)}`),
    getLead: (uuid) => request(`/leads/${uuid}`),
    getStatuses: () => request('/leads/statuses'),
    updateLeadStatus: (uuid, status_id) => request(`/leads/${uuid}/status`, { method: 'PATCH', body: JSON.stringify({ status_id }) }),
    addObservation: (uuid, observation) => request(`/leads/${uuid}/observation`, { method: 'PATCH', body: JSON.stringify({ observation }) }),
    updateLeadInGroup: (uuid, in_group) => request(`/leads/${uuid}/in-group`, { method: 'PATCH', body: JSON.stringify({ in_group }) }),
    updateLeadChecking: (uuid, checking) => request(`/leads/${uuid}/checking`, { method: 'PATCH', body: JSON.stringify({ checking }) }),
    updateLeadSaleCompleted: (uuid, sale_completed) => request(`/leads/${uuid}/sale-completed`, { method: 'PATCH', body: JSON.stringify({ sale_completed }) }),
    deleteLead: (uuid) => request(`/leads/${uuid}`, { method: 'DELETE' }),
    deleteLeadsBulk: (lead_uuids) => request('/leads/bulk', { method: 'DELETE', body: JSON.stringify({ lead_uuids }) }),
    getAllLeadUuids: (params = {}) => request(`/leads/all-uuids?${new URLSearchParams(params)}`),
    getUsers: () => request('/users'),
    getSellers: () => request('/users/sellers'),
    createUser: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (uuid, data) => request(`/users/${uuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
    toggleDistribution: (uuid, is_in_distribution) => request(`/users/${uuid}/distribution`, { method: 'PATCH', body: JSON.stringify({ is_in_distribution }) }),
    deleteUser: (uuid) => request(`/users/${uuid}`, { method: 'DELETE' }),
    // Campaigns
    getCampaigns: (params = {}) => request(`/campaigns?${new URLSearchParams(params)}`),
    createCampaign: (data) => request('/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    updateCampaign: (uuid, data) => request(`/campaigns/${uuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteCampaign: (uuid) => request(`/campaigns/${uuid}`, { method: 'DELETE' }),
    activateCampaign: (uuid) => request(`/campaigns/${uuid}/activate`, { method: 'POST' }),
    // Import History
    getImports: () => request('/imports'),
    revertImport: (uuid) => request(`/imports/${uuid}/revert`, { method: 'POST' }),
    deleteImportRecord: (uuid) => request(`/imports/${uuid}`, { method: 'DELETE' }),
    // Settings
    getApiSettings: () => request('/settings/api'),
    updateApiSettings: (data) => request('/settings/api', { method: 'PATCH', body: JSON.stringify(data) }),
    getDistributionOrder: () => request('/settings/distribution-order'),
    updateDistributionOrder: (order) => request('/settings/distribution-order', { method: 'PUT', body: JSON.stringify({ order }) }),
    exportLeads: (params = {}) => request(`/settings/export/leads?${new URLSearchParams(params)}`),
    importLeads: (data) => request('/settings/import/leads', { method: 'POST', body: JSON.stringify(data) }),
    // Statuses
    getAllStatuses: () => request('/statuses'),
    createStatus: (data) => request('/statuses', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, data) => request(`/statuses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteStatus: (id) => request(`/statuses/${id}`, { method: 'DELETE' }),
    updateStatusOrder: (order) => request('/statuses/order', { method: 'PUT', body: JSON.stringify({ order }) }),
    // WhatsApp Templates
    getWhatsAppTemplates: () => request('/whatsapp-templates'),
    createWhatsAppTemplate: (data) => request('/whatsapp-templates', { method: 'POST', body: JSON.stringify(data) }),
    updateWhatsAppTemplate: (uuid, data) => request(`/whatsapp-templates/${uuid}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteWhatsAppTemplate: (uuid) => request(`/whatsapp-templates/${uuid}`, { method: 'DELETE' }),
};
