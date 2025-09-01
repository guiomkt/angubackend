-- Migração para sistema completo de integração WhatsApp Business Cloud API
-- Adiciona tabelas de logs e colunas necessárias para o fluxo completo

-- 1. Adicionar colunas na tabela whatsapp_credentials (se existir)
DO $$ 
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'whatsapp_credentials') THEN
        -- Adicionar colunas se não existirem
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_credentials' AND column_name = 'user_access_token') THEN
            ALTER TABLE whatsapp_credentials ADD COLUMN user_access_token TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_credentials' AND column_name = 'business_id') THEN
            ALTER TABLE whatsapp_credentials ADD COLUMN business_id TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_credentials' AND column_name = 'discovery_attempts') THEN
            ALTER TABLE whatsapp_credentials ADD COLUMN discovery_attempts INTEGER DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_credentials' AND column_name = 'creation_strategy') THEN
            ALTER TABLE whatsapp_credentials ADD COLUMN creation_strategy TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_credentials' AND column_name = 'polling_status') THEN
            ALTER TABLE whatsapp_credentials ADD COLUMN polling_status TEXT;
        END IF;
    END IF;
END $$;

-- 2. Criar tabela de logs de integração
CREATE TABLE IF NOT EXISTS whatsapp_integration_logs (
    id SERIAL PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    step TEXT NOT NULL CHECK (step IN (
        'oauth', 
        'token_exchange', 
        'waba_discovery', 
        'waba_creation', 
        'polling_system', 
        'polling_verification',
        'complete_flow',
        'phone_registration',
        'phone_verification'
    )),
    strategy TEXT,
    success BOOLEAN NOT NULL DEFAULT false,
    error_message TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_integration_logs_restaurant_id ON whatsapp_integration_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integration_logs_step ON whatsapp_integration_logs(step);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integration_logs_strategy ON whatsapp_integration_logs(strategy);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integration_logs_success ON whatsapp_integration_logs(success);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integration_logs_created_at ON whatsapp_integration_logs(created_at);

-- 4. Criar tabela de auditoria de conexões (se não existir)
CREATE TABLE IF NOT EXISTS whatsapp_connection_logs (
    id SERIAL PRIMARY KEY,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('connect', 'disconnect', 'reconnect', 'status_change')),
    previous_status TEXT,
    new_status TEXT,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id)
);

-- 5. Criar índices para auditoria
CREATE INDEX IF NOT EXISTS idx_whatsapp_connection_logs_restaurant_id ON whatsapp_connection_logs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connection_logs_action ON whatsapp_connection_logs(action);
CREATE INDEX IF NOT EXISTS idx_whatsapp_connection_logs_created_at ON whatsapp_connection_logs(created_at);

-- 6. Adicionar colunas na tabela whatsapp_signup_states (se existir)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'whatsapp_signup_states') THEN
        -- Adicionar colunas se não existirem
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_signup_states' AND column_name = 'discovery_attempts') THEN
            ALTER TABLE whatsapp_signup_states ADD COLUMN discovery_attempts INTEGER DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_signup_states' AND column_name = 'creation_strategy') THEN
            ALTER TABLE whatsapp_signup_states ADD COLUMN creation_strategy TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_signup_states' AND column_name = 'polling_attempts') THEN
            ALTER TABLE whatsapp_signup_states ADD COLUMN polling_attempts INTEGER DEFAULT 0;
        END IF;
        
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'whatsapp_signup_states' AND column_name = 'last_polling_at') THEN
            ALTER TABLE whatsapp_signup_states ADD COLUMN last_polling_at TIMESTAMP WITH TIME ZONE;
        END IF;
    END IF;
END $$;

-- 7. Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Aplicar trigger na tabela de logs
DROP TRIGGER IF EXISTS update_whatsapp_integration_logs_updated_at ON whatsapp_integration_logs;
CREATE TRIGGER update_whatsapp_integration_logs_updated_at
    BEFORE UPDATE ON whatsapp_integration_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Criar view para status consolidado de integração
CREATE OR REPLACE VIEW whatsapp_integration_status AS
SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    wbi.id as integration_id,
    wbi.business_account_id as waba_id,
    wbi.phone_number_id,
    wbi.phone_number,
    wbi.business_name,
    wbi.connection_status,
    wbi.is_active,
    wbi.created_at as integration_created_at,
    wbi.updated_at as integration_updated_at,
    wss.status as signup_status,
    wss.waba_id as signup_waba_id,
    wss.phone_number_id as signup_phone_number_id,
    wss.verification_status,
    wss.access_token,
    wss.token_expires_at,
    wss.discovery_attempts,
    wss.creation_strategy,
    wss.polling_attempts,
    wss.last_polling_at,
    -- Último log de sucesso
    (SELECT step FROM whatsapp_integration_logs 
     WHERE restaurant_id = r.id 
     AND success = true 
     ORDER BY created_at DESC 
     LIMIT 1) as last_successful_step,
    -- Último log de erro
    (SELECT error_message FROM whatsapp_integration_logs 
     WHERE restaurant_id = r.id 
     AND success = false 
     ORDER BY created_at DESC 
     LIMIT 1) as last_error_message,
    -- Contagem de tentativas de criação
    (SELECT COUNT(*) FROM whatsapp_integration_logs 
     WHERE restaurant_id = r.id 
     AND step = 'waba_creation' 
     AND success = false) as creation_failures,
    -- Contagem de tentativas de polling
    (SELECT COUNT(*) FROM whatsapp_integration_logs 
     WHERE restaurant_id = r.id 
     AND step = 'polling_verification' 
     AND success = false) as polling_failures
FROM restaurants r
LEFT JOIN whatsapp_business_integrations wbi ON r.id = wbi.restaurant_id AND wbi.is_active = true
LEFT JOIN whatsapp_signup_states wss ON r.id = wss.restaurant_id
ORDER BY r.name;

-- 10. Comentários para documentação
COMMENT ON TABLE whatsapp_integration_logs IS 'Logs detalhados de todas as operações de integração WhatsApp Business';
COMMENT ON TABLE whatsapp_connection_logs IS 'Auditoria de mudanças de status de conexão WhatsApp';
COMMENT ON VIEW whatsapp_integration_status IS 'Visão consolidada do status de integração WhatsApp para cada restaurante';

COMMENT ON COLUMN whatsapp_integration_logs.step IS 'Etapa do processo de integração';
COMMENT ON COLUMN whatsapp_integration_logs.strategy IS 'Estratégia utilizada (ex: existing_waba, client_whatsapp_applications)';
COMMENT ON COLUMN whatsapp_integration_logs.success IS 'Se a operação foi bem-sucedida';
COMMENT ON COLUMN whatsapp_integration_logs.details IS 'Detalhes adicionais em formato JSON';

-- 11. Inserir dados de exemplo para testes (opcional)
-- INSERT INTO whatsapp_integration_logs (restaurant_id, step, strategy, success, details) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'oauth', 'test', true, '{"test": true}');

-- 12. Verificar se as tabelas foram criadas corretamente
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('whatsapp_integration_logs', 'whatsapp_connection_logs')
ORDER BY table_name, ordinal_position; 