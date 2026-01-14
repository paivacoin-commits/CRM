-- Migration: Create whatsapp_auth_state table
-- Purpose: Store WhatsApp session credentials in database instead of filesystem
-- This prevents session loss on deploy/restart

CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
    connection_id UUID PRIMARY KEY REFERENCES whatsapp_connections(id) ON DELETE CASCADE,
    creds JSONB NOT NULL DEFAULT '{}',
    keys JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_state_connection_id ON whatsapp_auth_state(connection_id);

-- Add comment
COMMENT ON TABLE whatsapp_auth_state IS 'Stores WhatsApp authentication state (credentials and keys) for persistent sessions across deploys';
