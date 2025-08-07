-- Create WhatsApp contacts table
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  phone_number VARCHAR(20) NOT NULL,
  name VARCHAR(100),
  email VARCHAR(255),
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_restaurant_id ON whatsapp_contacts(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone_number ON whatsapp_contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_created_at ON whatsapp_contacts(created_at);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_unique ON whatsapp_contacts(restaurant_id, phone_number);

-- Enable RLS
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own restaurant contacts"
  ON whatsapp_contacts FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own restaurant contacts"
  ON whatsapp_contacts FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own restaurant contacts"
  ON whatsapp_contacts FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own restaurant contacts"
  ON whatsapp_contacts FOR DELETE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_contacts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whatsapp_contacts_timestamp
  BEFORE UPDATE ON whatsapp_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_contacts_timestamp(); 