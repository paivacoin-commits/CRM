-- Remove DEFAULT constraint from status_id column in leads table
-- This allows leads to have NULL status (no status assigned)
-- Specifically needed for GreatPages leads that should not have automatic status

ALTER TABLE leads 
ALTER COLUMN status_id DROP DEFAULT;

-- Add comment explaining the change
COMMENT ON COLUMN leads.status_id IS 'Status do lead. NULL = sem status atribuído (ex: leads do GreatPages que não devem ter status inicial)';
