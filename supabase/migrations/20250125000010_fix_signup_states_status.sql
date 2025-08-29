-- Migration para corrigir os status permitidos na tabela whatsapp_signup_states
-- Adiciona o status 'waba_detected' que estava faltando

-- Primeiro, remover a constraint existente
ALTER TABLE public.whatsapp_signup_states 
DROP CONSTRAINT IF EXISTS whatsapp_signup_states_status_check;

-- Adicionar a nova constraint com todos os status necessários
ALTER TABLE public.whatsapp_signup_states 
ADD CONSTRAINT whatsapp_signup_states_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text, 
  'oauth_completed'::text, 
  'awaiting_waba_creation'::text, 
  'waba_detected'::text,
  'waba_created'::text, 
  'phone_configured'::text, 
  'completed'::text, 
  'failed'::text
]));

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_signup_states.status IS 'Status do processo de signup: pending, oauth_completed, awaiting_waba_creation, waba_detected, waba_created, phone_configured, completed, failed'; 