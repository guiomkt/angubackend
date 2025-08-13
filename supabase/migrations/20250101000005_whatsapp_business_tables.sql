-- Create WhatsApp Business tables
-- This migration creates the necessary tables for WhatsApp Business integration

-- WhatsApp Integrations table (updated structure)
CREATE TABLE IF NOT EXISTS whatsapp_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  business_account_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Tokens table
CREATE TABLE IF NOT EXISTS whatsapp_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT DEFAULT '',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Contacts table
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  name TEXT,
  email TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  to TEXT NOT NULL,
  from TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'template', 'media', 'location', 'contact')),
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp Media table
CREATE TABLE IF NOT EXISTS whatsapp_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_restaurant_id ON whatsapp_integrations(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_business_account_id ON whatsapp_integrations(business_account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_is_active ON whatsapp_integrations(is_active);

CREATE INDEX IF NOT EXISTS idx_whatsapp_tokens_business_id ON whatsapp_tokens(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_tokens_expires_at ON whatsapp_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_restaurant_id ON whatsapp_contacts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone_number ON whatsapp_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_created_at ON whatsapp_contacts(created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_restaurant_id ON whatsapp_messages(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON whatsapp_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_whatsapp_media_restaurant_id ON whatsapp_media(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_media_id ON whatsapp_media(media_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_created_at ON whatsapp_media(created_at);

-- Create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_integrations_unique ON whatsapp_integrations(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_tokens_unique ON whatsapp_tokens(business_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_unique ON whatsapp_contacts(restaurant_id, phone_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_unique ON whatsapp_messages(restaurant_id, message_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_media_unique ON whatsapp_media(restaurant_id, media_id);

-- Enable Row Level Security
ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_integrations
CREATE POLICY "Users can view their own whatsapp integrations" ON whatsapp_integrations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp integrations" ON whatsapp_integrations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp integrations" ON whatsapp_integrations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp integrations" ON whatsapp_integrations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_integrations.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for whatsapp_tokens
CREATE POLICY "Users can view their own whatsapp tokens" ON whatsapp_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM whatsapp_integrations
      JOIN restaurants ON restaurants.id = whatsapp_integrations.restaurant_id
      WHERE whatsapp_integrations.business_account_id = whatsapp_tokens.business_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp tokens" ON whatsapp_tokens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_integrations
      JOIN restaurants ON restaurants.id = whatsapp_integrations.restaurant_id
      WHERE whatsapp_integrations.business_account_id = whatsapp_tokens.business_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp tokens" ON whatsapp_tokens
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM whatsapp_integrations
      JOIN restaurants ON restaurants.id = whatsapp_integrations.restaurant_id
      WHERE whatsapp_integrations.business_account_id = whatsapp_tokens.business_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp tokens" ON whatsapp_tokens
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM whatsapp_integrations
      JOIN restaurants ON restaurants.id = whatsapp_integrations.restaurant_id
      WHERE whatsapp_integrations.business_account_id = whatsapp_tokens.business_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for whatsapp_contacts
CREATE POLICY "Users can view their own whatsapp contacts" ON whatsapp_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp contacts" ON whatsapp_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp contacts" ON whatsapp_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp contacts" ON whatsapp_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_contacts.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for whatsapp_messages
CREATE POLICY "Users can view their own whatsapp messages" ON whatsapp_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp messages" ON whatsapp_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp messages" ON whatsapp_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp messages" ON whatsapp_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_messages.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- RLS Policies for whatsapp_media
CREATE POLICY "Users can view their own whatsapp media" ON whatsapp_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own whatsapp media" ON whatsapp_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own whatsapp media" ON whatsapp_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own whatsapp media" ON whatsapp_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM restaurants
      WHERE restaurants.id = whatsapp_media.restaurant_id
      AND restaurants.user_id = auth.uid()
    )
  );

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_whatsapp_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_integrations_updated_at
  BEFORE UPDATE ON whatsapp_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_tokens_updated_at
  BEFORE UPDATE ON whatsapp_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON whatsapp_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at();

CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_tables_updated_at(); 