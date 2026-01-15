-- Migration 013: Cart Abandonment System
-- Cria tabelas para gerenciar abandono de carrinho com integração ManyChat

-- 1. Tabela de configurações do sistema de abandono de carrinho
CREATE TABLE IF NOT EXISTS public.cart_abandonment_settings (
    id SERIAL PRIMARY KEY,
    
    -- Configurações ManyChat
    manychat_api_token TEXT,
    manychat_flow_id_first TEXT, -- Flow disparado pela TAG (primeira mensagem)
    manychat_flow_id_second TEXT, -- Flow disparado via API (segunda mensagem)
    manychat_webhook_url TEXT, -- URL do webhook ManyChat (opcional)
    manychat_tag_name TEXT DEFAULT 'abandono_carrinho', -- Nome da TAG a ser aplicada
    
    -- Configurações de processamento
    delay_minutes INTEGER DEFAULT 60, -- Tempo de espera antes da segunda verificação
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL, -- Campanha para verificar conversão
    
    -- Controle
    is_enabled BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configuração padrão
INSERT INTO public.cart_abandonment_settings (id, is_enabled, delay_minutes)
VALUES (1, false, 60)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de eventos de abandono de carrinho
CREATE TABLE IF NOT EXISTS public.cart_abandonment_events (
    id SERIAL PRIMARY KEY,
    uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    -- Dados do contato
    contact_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    product_name TEXT,
    
    -- Dados do evento Hotmart
    event_type TEXT, -- PURCHASE_CANCELED, CART_ABANDONED, etc.
    hotmart_transaction_id TEXT,
    
    -- Status de processamento
    status TEXT DEFAULT 'pending', -- pending, processing, completed, error, duplicate
    error_message TEXT,
    
    -- Controle de mensagens
    first_message_sent BOOLEAN DEFAULT false,
    first_message_sent_at TIMESTAMPTZ,
    
    second_message_sent BOOLEAN DEFAULT false,
    second_message_sent_at TIMESTAMPTZ,
    
    -- Verificação de campanha
    found_in_campaign BOOLEAN DEFAULT false,
    campaign_check_at TIMESTAMPTZ,
    
    -- ManyChat
    manychat_subscriber_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Payload original
    payload JSONB
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_cart_events_email 
ON public.cart_abandonment_events(contact_email);

CREATE INDEX IF NOT EXISTS idx_cart_events_phone 
ON public.cart_abandonment_events(contact_phone);

CREATE INDEX IF NOT EXISTS idx_cart_events_status 
ON public.cart_abandonment_events(status);

CREATE INDEX IF NOT EXISTS idx_cart_events_created 
ON public.cart_abandonment_events(created_at DESC);

-- Índice composto para buscar duplicatas
CREATE INDEX IF NOT EXISTS idx_cart_events_duplicate_check 
ON public.cart_abandonment_events(contact_email, contact_phone, created_at DESC);

-- 3. Tabela de logs detalhados de processamento
CREATE TABLE IF NOT EXISTS public.cart_abandonment_logs (
    id SERIAL PRIMARY KEY,
    
    -- Referência ao evento
    event_id INTEGER REFERENCES cart_abandonment_events(id) ON DELETE CASCADE,
    
    -- Tipo de ação
    action_type TEXT NOT NULL, -- webhook_received, first_message, delay_wait, campaign_check, second_message, error
    
    -- Status da ação
    status TEXT NOT NULL, -- success, error, skipped
    
    -- Detalhes
    message TEXT,
    error_message TEXT,
    
    -- Payload da ação (para debug)
    payload JSONB,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_cart_logs_event 
ON public.cart_abandonment_logs(event_id);

CREATE INDEX IF NOT EXISTS idx_cart_logs_action 
ON public.cart_abandonment_logs(action_type);

CREATE INDEX IF NOT EXISTS idx_cart_logs_created 
ON public.cart_abandonment_logs(created_at DESC);

-- 4. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_cart_abandonment_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_cart_abandonment_settings_updated_at 
ON public.cart_abandonment_settings;

CREATE TRIGGER trigger_update_cart_abandonment_settings_updated_at
    BEFORE UPDATE ON public.cart_abandonment_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_cart_abandonment_settings_updated_at();

-- Verificar criação
SELECT 'Tabelas criadas com sucesso!' as status;
SELECT * FROM public.cart_abandonment_settings;
