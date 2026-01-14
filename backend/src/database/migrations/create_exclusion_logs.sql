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

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_exclusion_logs_phone ON exclusion_logs(phone);
CREATE INDEX IF NOT EXISTS idx_exclusion_logs_created_at ON exclusion_logs(created_at);
