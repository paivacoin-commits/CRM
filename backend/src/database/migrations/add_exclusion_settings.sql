-- Migration: Add Exclusion API settings
-- Purpose: Store configuration for the Exclusion API (token, enabled status, group IDs)

ALTER TABLE api_settings 
ADD COLUMN IF NOT EXISTS exclusion_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS exclusion_token TEXT,
ADD COLUMN IF NOT EXISTS exclusion_group_ids JSONB DEFAULT '[]';

COMMENT ON COLUMN api_settings.exclusion_group_ids IS 'List of WhatsApp Group IDs to remove participants from';
