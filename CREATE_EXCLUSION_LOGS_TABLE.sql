-- ============================================
-- MIGRATION: Create exclusion_logs table
-- ============================================
-- Execute este SQL no Supabase SQL Editor
-- ou em qualquer cliente PostgreSQL

-- Create exclusion_logs table to track removed contacts
CREATE TABLE IF NOT EXISTS exclusion_logs (
    id SERIAL PRIMARY KEY,
    phone TEXT NOT NULL,
    group_id TEXT,
    group_name TEXT,
    status TEXT CHECK (status IN ('success', 'error')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_exclusion_logs_phone ON exclusion_logs(phone);
CREATE INDEX IF NOT EXISTS idx_exclusion_logs_created_at ON exclusion_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_exclusion_logs_status ON exclusion_logs(status);

-- Verify table was created
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'exclusion_logs'
ORDER BY ordinal_position;
