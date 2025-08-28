-- Migration: Create whatsapp_signup_states table for Embedded Signup flow
-- Description: Tabela para controlar o estado do processo de configuração do WhatsApp Business via Embedded Signup da Meta

CREATE TABLE IF NOT EXISTS public.whatsapp_signup_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'waba_created', 'phone_configured', 'completed', 'failed')),
  waba_id TEXT,
  phone_number_id TEXT,
  phone_number TEXT,
  business_name TEXT,
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT whatsapp_signup_states_user_restaurant_unique UNIQUE (user_id, restaurant_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_signup_states_user_id ON public.whatsapp_signup_states(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_signup_states_restaurant_id ON public.whatsapp_signup_states(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_signup_states_status ON public.whatsapp_signup_states(status);

-- Add trigger to update the updated_at column
CREATE TRIGGER update_whatsapp_signup_states_modtime
  BEFORE UPDATE ON public.whatsapp_signup_states
  FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Enable Row Level Security (RLS)
ALTER TABLE public.whatsapp_signup_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own signup states
CREATE POLICY "Users can view own signup states" ON public.whatsapp_signup_states
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own signup states
CREATE POLICY "Users can insert own signup states" ON public.whatsapp_signup_states
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own signup states
CREATE POLICY "Users can update own signup states" ON public.whatsapp_signup_states
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own signup states
CREATE POLICY "Users can delete own signup states" ON public.whatsapp_signup_states
  FOR DELETE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON public.whatsapp_signup_states TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated; 