-- =============================================================================
-- SALES RECOVERY CRM - DATABASE SCHEMA
-- Sistema de CRM para recuperação de vendas com distribuição Round-Robin
-- =============================================================================

-- Tabela de Usuários (Administradores e Vendedoras)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'seller')),
    is_active BOOLEAN DEFAULT 1,           -- Se está ativo no sistema
    is_in_distribution BOOLEAN DEFAULT 1,  -- Se participa da distribuição (Round-Robin)
    distribution_order INTEGER DEFAULT 999, -- Ordem na fila de distribuição
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Configurações de API
CREATE TABLE IF NOT EXISTS api_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    webhook_token TEXT NOT NULL,
    webhook_enabled BOOLEAN DEFAULT 1,
    require_token BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Status de Leads (Tags configuráveis)
CREATE TABLE IF NOT EXISTS lead_statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL,
    is_conversion BOOLEAN DEFAULT 0,  -- Se este status conta como conversão
    is_system BOOLEAN DEFAULT 0,      -- Se é um status do sistema (não pode ser deletado)
    display_order INTEGER DEFAULT 0
);

-- Tabela de Leads (Contatos do CRM)
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    product_name TEXT,
    transaction_id TEXT,
    seller_id INTEGER,                  -- Vendedora responsável (FK)
    status_id INTEGER DEFAULT 1,        -- Status atual do lead
    observations TEXT,                  -- Histórico de observações
    source TEXT DEFAULT 'hotmart',      -- Origem do lead
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (status_id) REFERENCES lead_statuses(id)
);

-- Tabela para controle da distribuição Round-Robin
-- Armazena qual vendedora recebeu o último lead para continuar a rotação
CREATE TABLE IF NOT EXISTS distribution_control (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Garante apenas um registro
    last_seller_id INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (last_seller_id) REFERENCES users(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_seller ON leads(seller_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status_id);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_distribution ON users(is_in_distribution);

-- Inserir status padrões
INSERT OR IGNORE INTO lead_statuses (id, name, color, is_conversion, display_order) VALUES
    (1, 'Novo', '#3B82F6', 0, 1),
    (2, 'Em Contato', '#F59E0B', 0, 2),
    (3, 'Agendado', '#8B5CF6', 0, 3),
    (4, 'Venda Recuperada', '#10B981', 1, 4),
    (5, 'Perdido', '#EF4444', 0, 5);

-- Inicializar controle de distribuição
INSERT OR IGNORE INTO distribution_control (id, last_seller_id) VALUES (1, NULL);
