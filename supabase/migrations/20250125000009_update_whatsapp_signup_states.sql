-- Migration: Update whatsapp_signup_states table to include state field
-- Description: Adiciona campo state para controlar o fluxo de Embedded Signup com validação

-- Adicionar campo state para validação do callback OAuth
ALTER TABLE public.whatsapp_signup_states 
ADD COLUMN IF NOT EXISTS state TEXT;

-- Adicionar campos para suporte completo ao fluxo Embedded Signup
ALTER TABLE public.whatsapp_signup_states 
ADD COLUMN IF NOT EXISTS business_id TEXT;

ALTER TABLE public.whatsapp_signup_states 
ADD COLUMN IF NOT EXISTS access_token TEXT;

ALTER TABLE public.whatsapp_signup_states 
ADD COLUMN IF NOT EXISTS refresh_token TEXT;

ALTER TABLE public.whatsapp_signup_states 
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Adicionar índice para o campo state para busca rápida
CREATE INDEX IF NOT EXISTS idx_whatsapp_signup_states_state ON public.whatsapp_signup_states(state);

-- Atualizar verificação de status para incluir novos estados
ALTER TABLE public.whatsapp_signup_states 
DROP CONSTRAINT IF EXISTS whatsapp_signup_states_status_check;

ALTER TABLE public.whatsapp_signup_states 
ADD CONSTRAINT whatsapp_signup_states_status_check 
CHECK (status IN ('pending', 'oauth_completed', 'waba_created', 'phone_configured', 'completed', 'failed'));

-- Comentário na tabela
COMMENT ON TABLE public.whatsapp_signup_states IS 'Controla o estado do processo de configuração do WhatsApp Business via Embedded Signup da Meta';
COMMENT ON COLUMN public.whatsapp_signup_states.state IS 'String única para validação do callback OAuth';
COMMENT ON COLUMN public.whatsapp_signup_states.business_id IS 'ID do Business Manager (Meta)';
COMMENT ON COLUMN public.whatsapp_signup_states.access_token IS 'Token de acesso OAuth do usuário';
COMMENT ON COLUMN public.whatsapp_signup_states.refresh_token IS 'Token de renovação OAuth';
COMMENT ON COLUMN public.whatsapp_signup_states.token_expires_at IS 'Data de expiração do token OAuth'; 