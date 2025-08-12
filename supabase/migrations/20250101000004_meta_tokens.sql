-- Create meta_tokens table
CREATE TABLE IF NOT EXISTS meta_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'user',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  business_accounts JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_meta_tokens_user_id ON meta_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_tokens_restaurant_id ON meta_tokens(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_meta_tokens_expires_at ON meta_tokens(expires_at);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_meta_tokens_user_restaurant ON meta_tokens(user_id, restaurant_id);

-- Enable RLS
ALTER TABLE meta_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own meta tokens" ON meta_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meta tokens" ON meta_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meta tokens" ON meta_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meta tokens" ON meta_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_meta_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_meta_tokens_updated_at
  BEFORE UPDATE ON meta_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_meta_tokens_updated_at(); 