-- =============================================================================
-- SALES RECOVERY CRM - SUPABASE SCHEMA (PostgreSQL)
-- Execute este SQL no SQL Editor do Supabase
-- =============================================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA DE USUÁRIOS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'seller')),
    is_active BOOLEAN DEFAULT true,
    is_in_distribution BOOLEAN DEFAULT true,
    distribution_order INTEGER DEFAULT 999,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABELA DE CONFIGURAÇÕES DE API
-- ============================================
CREATE TABLE IF NOT EXISTS api_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    webhook_token TEXT NOT NULL,
    webhook_enabled BOOLEAN DEFAULT true,
    require_token BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABELA DE STATUS DE LEADS
-- ============================================
CREATE TABLE IF NOT EXISTS lead_statuses (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    is_conversion BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0
);

-- ============================================
-- TABELA DE CAMPANHAS
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABELA DE LEADS
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    product_name TEXT,
    transaction_id TEXT,
    seller_id INTEGER REFERENCES users(id),
    status_id INTEGER DEFAULT 1 REFERENCES lead_statuses(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    observations TEXT,
    source TEXT DEFAULT 'hotmart',
    in_group BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    import_batch_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABELA DE CONTROLE DE DISTRIBUIÇÃO
-- ============================================
CREATE TABLE IF NOT EXISTS distribution_control (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_seller_id INTEGER REFERENCES users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TABELA DE BATCHES DE IMPORTAÇÃO
-- ============================================
CREATE TABLE IF NOT EXISTS import_batches (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    name TEXT NOT NULL,
    source TEXT DEFAULT 'manual',
    campaign_id INTEGER REFERENCES campaigns(id),
    seller_id INTEGER REFERENCES users(id),
    in_group BOOLEAN DEFAULT true,
    total_imported INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    total_updated INTEGER DEFAULT 0,
    is_reverted BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_leads_seller ON leads(seller_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_distribution ON users(is_in_distribution);

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Status padrão
INSERT INTO lead_statuses (id, name, color, is_conversion, is_system, display_order) VALUES
    (1, 'Novo', '#3B82F6', false, false, 1),
    (2, 'Em Contato', '#F59E0B', false, false, 2),
    (3, 'Agendado', '#8B5CF6', false, false, 3),
    (4, 'Vendido', '#10B981', true, true, 4),
    (5, 'Perdido', '#EF4444', false, false, 5)
ON CONFLICT (id) DO NOTHING;

-- Inicializar controle de distribuição
INSERT INTO distribution_control (id, last_seller_id) VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- Usuário admin padrão (senha: admin123)
INSERT INTO users (uuid, name, email, password_hash, role) VALUES
    (uuid_generate_v4(), 'Administrador', 'admin@crm.com', '$2a$10$nLVp0YK7mQ93Bp7Edhk3BukWuVCbNsObfiQaEb7l8197npqJCbsk.', 'admin')
ON CONFLICT (email) DO NOTHING;

-- Reset sequences para evitar conflitos
SELECT setval('lead_statuses_id_seq', (SELECT MAX(id) FROM lead_statuses));
