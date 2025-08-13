-- Update WhatsApp tables for OAuth flow and message control
-- This migration updates existing WhatsApp tables and adds new functionality

-- 1. Update whatsapp_credentials table to support OAuth tokens
ALTER TABLE public.whatsapp_credentials 
ADD COLUMN IF NOT EXISTS oauth_access_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_token_type TEXT DEFAULT 'long_lived',
ADD COLUMN IF NOT EXISTS is_oauth_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_oauth_refresh TIMESTAMP WITH TIME ZONE;

-- 2. Update whatsapp_integrations table for better OAuth support
ALTER TABLE public.whatsapp_integrations 
ADD COLUMN IF NOT EXISTS oauth_access_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_token_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS oauth_token_type TEXT DEFAULT 'long_lived',
ADD COLUMN IF NOT EXISTS is_oauth_connected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_oauth_refresh TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS business_verification_status TEXT,
ADD COLUMN IF NOT EXISTS phone_verification_status TEXT;

-- 3. Create whatsapp_messages table for message control
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  to_phone TEXT NOT NULL,
  from_phone TEXT NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'template', 'media', 'location', 'contact', 'interactive')),
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'pending')),
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound')),
  conversation_id TEXT,
  reply_to_message_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create whatsapp_contacts table for contact management
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  email TEXT,
  profile_picture_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create whatsapp_media table for media management
CREATE TABLE IF NOT EXISTS public.whatsapp_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create whatsapp_conversations table for conversation tracking
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.whatsapp_contacts(id) ON DELETE SET NULL,
  conversation_id TEXT UNIQUE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'archived')),
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_count INTEGER DEFAULT 0,
  assigned_to UUID,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create whatsapp_templates table for message templates
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_id TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  language TEXT DEFAULT 'pt_BR',
  content JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Create whatsapp_webhooks table for webhook management
CREATE TABLE IF NOT EXISTS public.whatsapp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  events TEXT[] DEFAULT '{}',
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_restaurant_id ON public.whatsapp_credentials(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_oauth_connected ON public.whatsapp_credentials(is_oauth_connected);
CREATE INDEX IF NOT EXISTS idx_whatsapp_credentials_token_expires ON public.whatsapp_credentials(oauth_token_expires_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_restaurant_id ON public.whatsapp_integrations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_oauth_connected ON public.whatsapp_integrations(is_oauth_connected);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_business_account ON public.whatsapp_integrations(whatsapp_business_account_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_restaurant_id ON public.whatsapp_messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON public.whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON public.whatsapp_messages(direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON public.whatsapp_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_restaurant_id ON public.whatsapp_contacts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone_number ON public.whatsapp_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_status ON public.whatsapp_contacts(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_last_message ON public.whatsapp_contacts(last_message_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_media_restaurant_id ON public.whatsapp_media(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_media_id ON public.whatsapp_media(media_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_message_id ON public.whatsapp_media(message_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_restaurant_id ON public.whatsapp_conversations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_contact_id ON public.whatsapp_conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_status ON public.whatsapp_conversations(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message ON public.whatsapp_conversations(last_message_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_restaurant_id ON public.whatsapp_templates(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_status ON public.whatsapp_templates(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_category ON public.whatsapp_templates(category);

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhooks_restaurant_id ON public.whatsapp_webhooks(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_webhooks_active ON public.whatsapp_webhooks(is_active);

-- 10. Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_credentials_restaurant_unique ON public.whatsapp_credentials(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_integrations_restaurant_unique ON public.whatsapp_integrations(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_restaurant_phone_unique ON public.whatsapp_contacts(restaurant_id, phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_unique ON public.whatsapp_messages(restaurant_id, message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_media_media_unique ON public.whatsapp_media(restaurant_id, media_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_id_unique ON public.whatsapp_conversations(conversation_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_templates_name_restaurant_unique ON public.whatsapp_templates(restaurant_id, template_name);

-- 11. Enable Row Level Security
ALTER TABLE public.whatsapp_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_webhooks ENABLE ROW LEVEL SECURITY;

-- 12. Create RLS policies for whatsapp_credentials
CREATE POLICY "Users can view their own whatsapp credentials" ON public.whatsapp_credentials
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_credentials.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp credentials" ON public.whatsapp_credentials
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_credentials.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp credentials" ON public.whatsapp_credentials
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_credentials.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp credentials" ON public.whatsapp_credentials
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_credentials.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 13. Create RLS policies for whatsapp_integrations
CREATE POLICY "Users can view their own whatsapp integrations" ON public.whatsapp_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp integrations" ON public.whatsapp_integrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp integrations" ON public.whatsapp_integrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp integrations" ON public.whatsapp_integrations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 14. Create RLS policies for whatsapp_messages
CREATE POLICY "Users can view their own whatsapp messages" ON public.whatsapp_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp messages" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp messages" ON public.whatsapp_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp messages" ON public.whatsapp_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 15. Create RLS policies for whatsapp_contacts
CREATE POLICY "Users can view their own whatsapp contacts" ON public.whatsapp_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp contacts" ON public.whatsapp_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp contacts" ON public.whatsapp_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp contacts" ON public.whatsapp_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 16. Create RLS policies for whatsapp_media
CREATE POLICY "Users can view their own whatsapp media" ON public.whatsapp_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp media" ON public.whatsapp_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp media" ON public.whatsapp_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp media" ON public.whatsapp_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 17. Create RLS policies for whatsapp_conversations
CREATE POLICY "Users can view their own whatsapp conversations" ON public.whatsapp_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_conversations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp conversations" ON public.whatsapp_conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_conversations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp conversations" ON public.whatsapp_conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_conversations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp conversations" ON public.whatsapp_conversations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_conversations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 18. Create RLS policies for whatsapp_templates
CREATE POLICY "Users can view their own whatsapp templates" ON public.whatsapp_templates
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_templates.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp templates" ON public.whatsapp_templates
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_templates.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp templates" ON public.whatsapp_templates
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_templates.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp templates" ON public.whatsapp_templates
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_templates.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 19. Create RLS policies for whatsapp_webhooks
CREATE POLICY "Users can view their own whatsapp webhooks" ON public.whatsapp_webhooks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_webhooks.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp webhooks" ON public.whatsapp_webhooks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_webhooks.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp webhooks" ON public.whatsapp_webhooks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_webhooks.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp webhooks" ON public.whatsapp_webhooks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.restaurants
      WHERE restaurants.id = whatsapp_webhooks.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- 20. Create updated_at triggers
CREATE OR REPLACE FUNCTION update_whatsapp_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_credentials_updated_at
  BEFORE UPDATE ON public.whatsapp_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_integrations_updated_at
  BEFORE UPDATE ON public.whatsapp_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_webhooks_updated_at
  BEFORE UPDATE ON public.whatsapp_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

-- 21. Create function to disconnect WhatsApp (clean up all data)
CREATE OR REPLACE FUNCTION disconnect_whatsapp(restaurant_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Delete all WhatsApp related data for the restaurant
  DELETE FROM public.whatsapp_messages WHERE restaurant_id = restaurant_uuid;
  DELETE FROM public.whatsapp_contacts WHERE restaurant_id = restaurant_uuid;
  DELETE FROM public.whatsapp_media WHERE restaurant_id = restaurant_uuid;
  DELETE FROM public.whatsapp_conversations WHERE restaurant_id = restaurant_uuid;
  DELETE FROM public.whatsapp_templates WHERE restaurant_id = restaurant_uuid;
  DELETE FROM public.whatsapp_webhooks WHERE restaurant_id = restaurant_uuid;
  
  -- Update credentials and integrations to disconnected state
  UPDATE public.whatsapp_credentials 
  SET is_oauth_connected = FALSE, 
      oauth_access_token = NULL, 
      oauth_token_expires_at = NULL,
      disconnected_at = NOW(),
      disconnect_reason = 'Manual disconnect'
  WHERE restaurant_id = restaurant_uuid;
  
  UPDATE public.whatsapp_integrations 
  SET is_oauth_connected = FALSE, 
      oauth_access_token = NULL, 
      oauth_token_expires_at = NULL,
      status = 'disconnected'
  WHERE restaurant_id = restaurant_uuid;
  
  -- Log the disconnection
  INSERT INTO public.whatsapp_connection_logs (restaurant_id, action, details)
  VALUES (restaurant_uuid, 'disconnect', '{"reason": "Manual disconnect", "timestamp": "' || NOW() || '"}');
  
  result := json_build_object(
    'success', true,
    'message', 'WhatsApp desconectado com sucesso',
    'disconnected_at', NOW(),
    'restaurant_id', restaurant_uuid
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 22. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION disconnect_whatsapp(UUID) TO authenticated;

-- 23. Create function to get WhatsApp status
CREATE OR REPLACE FUNCTION get_whatsapp_status(restaurant_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
  creds_record RECORD;
  integration_record RECORD;
BEGIN
  -- Get credentials
  SELECT * INTO creds_record 
  FROM public.whatsapp_credentials 
  WHERE restaurant_id = restaurant_uuid;
  
  -- Get integration
  SELECT * INTO integration_record 
  FROM public.whatsapp_integrations 
  WHERE restaurant_id = restaurant_uuid;
  
  IF creds_record IS NULL AND integration_record IS NULL THEN
    result := json_build_object(
      'isConnected', false,
      'message', 'WhatsApp não conectado',
      'restaurant_id', restaurant_uuid
    );
  ELSE
    result := json_build_object(
      'isConnected', COALESCE(creds_record.is_oauth_connected, integration_record.is_oauth_connected, false),
      'credentials', creds_record,
      'integration', integration_record,
      'restaurant_id', restaurant_uuid,
      'message', CASE 
        WHEN COALESCE(creds_record.is_oauth_connected, integration_record.is_oauth_connected, false) THEN 'WhatsApp conectado e funcionando'
        ELSE 'WhatsApp não conectado ou token expirado'
      END
    );
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 24. Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_whatsapp_status(UUID) TO authenticated; 