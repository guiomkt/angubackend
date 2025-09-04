-- Create a function to get whatsapp conversations with details
CREATE OR REPLACE FUNCTION get_whatsapp_conversations_with_details(p_restaurant_id UUID, p_phone_number_id TEXT DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  restaurant_id UUID,
  conversation_id TEXT,
  contact_id UUID,
  phone_number_id TEXT,
  status TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  contact JSONB,
  last_message JSONB
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.restaurant_id,
    c.conversation_id,
    c.contact_id,
    c.phone_number_id,
    c.status,
    c.last_message_at,
    c.created_at,
    jsonb_build_object(
      'id', wc.id,
      'name', wc.name,
      'phone_number', wc.phone_number,
      'status', wc.status
    ) AS contact,
    (
      SELECT jsonb_build_object(
        'id', m.id,
        'content', m.content,
        'message_type', m.message_type,
        'direction', m.direction,
        'created_at', m.created_at
      )
      FROM whatsapp_messages m
      WHERE m.conversation_id = c.conversation_id
      ORDER BY m.created_at DESC
      LIMIT 1
    ) AS last_message
  FROM 
    whatsapp_conversations c
  LEFT JOIN 
    whatsapp_contacts wc ON c.contact_id = wc.id
  WHERE 
    c.restaurant_id = p_restaurant_id
    AND (p_phone_number_id IS NULL OR c.phone_number_id = p_phone_number_id)
  ORDER BY 
    c.last_message_at DESC;
END;
$$; 