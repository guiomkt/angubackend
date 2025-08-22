-- =====================================================
-- FIX OAUTH DATABASE STRUCTURE
-- Resolve problema de foreign key constraint definitivamente
-- =====================================================

-- 1. BACKUP: Criar backup da tabela meta_tokens atual
CREATE TABLE IF NOT EXISTS meta_tokens_backup AS 
SELECT * FROM meta_tokens;

-- 2. REMOVER: Constraints problemáticas da tabela meta_tokens
ALTER TABLE meta_tokens 
DROP CONSTRAINT IF EXISTS meta_tokens_user_id_fkey,
DROP CONSTRAINT IF EXISTS meta_tokens_restaurant_id_fkey;

-- 3. MODIFICAR: Estrutura da tabela meta_tokens para ser mais flexível
ALTER TABLE meta_tokens 
ALTER COLUMN user_id DROP NOT NULL,
ALTER COLUMN restaurant_id DROP NOT NULL,
ADD COLUMN IF NOT EXISTS business_id TEXT,
ADD COLUMN IF NOT EXISTS integration_type TEXT DEFAULT 'whatsapp_business',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. CRIAR: Nova tabela otimizada para OAuth (sem constraints problemáticas)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'meta',
  business_id TEXT NOT NULL,
  restaurant_id UUID,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT NOT NULL DEFAULT 'long_lived',
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT[],
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CRIAR: Índices para performance
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_business_id ON oauth_tokens(business_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_restaurant_id ON oauth_tokens(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at);

-- 6. MIGRAR: Dados existentes da tabela meta_tokens para oauth_tokens
INSERT INTO oauth_tokens (
  provider,
  business_id,
  restaurant_id,
  access_token,
  token_type,
  expires_at,
  metadata
)
SELECT 
  'meta' as provider,
  COALESCE(restaurant_id::TEXT, 'unknown') as business_id,
  restaurant_id,
  access_token,
  token_type,
  expires_at,
  jsonb_build_object(
    'business_accounts', business_accounts,
    'legacy_user_id', user_id
  ) as metadata
FROM meta_tokens 
WHERE access_token IS NOT NULL;

-- 7. CRIAR: Tabela de integrações WhatsApp (mais robusta)
CREATE TABLE IF NOT EXISTS whatsapp_business_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL,
  business_account_id TEXT NOT NULL,
  phone_number_id TEXT,
  phone_number TEXT,
  business_name TEXT,
  verification_status TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  webhook_url TEXT,
  webhook_verify_token TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_webhook_trigger TIMESTAMPTZ,
  connection_status TEXT DEFAULT 'connected',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints mais flexíveis
  CONSTRAINT unique_restaurant_business UNIQUE(restaurant_id, business_account_id)
);

-- 8. CRIAR: Índices para integrações
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_restaurant ON whatsapp_business_integrations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_business ON whatsapp_business_integrations(business_account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_status ON whatsapp_business_integrations(connection_status);

-- 9. FUNÇÃO: Atualizar timestamp automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. TRIGGERS: Para atualizar updated_at automaticamente
CREATE TRIGGER update_oauth_tokens_updated_at 
    BEFORE UPDATE ON oauth_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_integrations_updated_at 
    BEFORE UPDATE ON whatsapp_business_integrations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. VIEW: Para facilitar consultas de OAuth
CREATE OR REPLACE VIEW oauth_status AS
SELECT 
  ot.provider,
  ot.business_id,
  ot.restaurant_id,
  r.name as restaurant_name,
  ot.access_token,
  ot.token_type,
  ot.expires_at,
  ot.is_active,
  CASE 
    WHEN ot.expires_at > NOW() THEN 'valid'
    ELSE 'expired'
  END as token_status,
  ot.created_at,
  ot.updated_at
FROM oauth_tokens ot
LEFT JOIN restaurants r ON ot.restaurant_id = r.id
WHERE ot.is_active = TRUE;

-- 12. FUNÇÃO: Para obter token válido
CREATE OR REPLACE FUNCTION get_valid_oauth_token(
  p_restaurant_id UUID,
  p_provider TEXT DEFAULT 'meta'
)
RETURNS TABLE(
  access_token TEXT,
  expires_at TIMESTAMPTZ,
  token_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ot.access_token,
    ot.expires_at,
    ot.token_type
  FROM oauth_tokens ot
  WHERE ot.restaurant_id = p_restaurant_id
    AND ot.provider = p_provider
    AND ot.is_active = TRUE
    AND ot.expires_at > NOW()
  ORDER BY ot.expires_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 13. COMENTÁRIOS: Documentar a nova estrutura
COMMENT ON TABLE oauth_tokens IS 'Tokens OAuth para diferentes provedores (Meta, Google, etc.)';
COMMENT ON TABLE whatsapp_business_integrations IS 'Integrações específicas do WhatsApp Business';
COMMENT ON VIEW oauth_status IS 'Status atual de todos os tokens OAuth ativos';
COMMENT ON FUNCTION get_valid_oauth_token IS 'Obtém token OAuth válido para um restaurante';

-- 14. VERIFICAÇÃO: Confirmar que tudo foi criado
SELECT 
  'oauth_tokens' as table_name,
  COUNT(*) as record_count
FROM oauth_tokens
UNION ALL
SELECT 
  'whatsapp_business_integrations' as table_name,
  COUNT(*) as record_count
FROM whatsapp_business_integrations;

-- =====================================================
-- RESULTADO: 
-- - Tabela oauth_tokens sem constraints problemáticas
-- - Tabela whatsapp_business_integrations para dados específicos
-- - Funções e views para facilitar o uso
-- - Migração automática dos dados existentes
-- ===================================================== 