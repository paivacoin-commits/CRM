-- Tabela de Subcampanhas
CREATE TABLE IF NOT EXISTS subcampaigns (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    color VARCHAR(7) DEFAULT '#6366f1', -- Cor hex para o ponto
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar campo subcampaign_id na tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS subcampaign_id INTEGER REFERENCES subcampaigns(id) ON DELETE SET NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subcampaigns_campaign_id ON subcampaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_subcampaign_id ON leads(subcampaign_id);

-- RLS para subcampaigns
ALTER TABLE subcampaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON subcampaigns
    FOR ALL USING (true) WITH CHECK (true);
