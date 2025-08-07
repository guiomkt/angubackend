-- Create WhatsApp media table
CREATE TABLE IF NOT EXISTS whatsapp_media (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  media_id VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_restaurant_id ON whatsapp_media(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_media_id ON whatsapp_media(media_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_media_created_at ON whatsapp_media(created_at);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_media_unique ON whatsapp_media(restaurant_id, media_id);

-- Enable RLS
ALTER TABLE whatsapp_media ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own restaurant media"
  ON whatsapp_media FOR SELECT
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own restaurant media"
  ON whatsapp_media FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own restaurant media"
  ON whatsapp_media FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own restaurant media"
  ON whatsapp_media FOR DELETE
  USING (
    restaurant_id IN (
      SELECT id FROM restaurants WHERE user_id = auth.uid()
    )
  ); 