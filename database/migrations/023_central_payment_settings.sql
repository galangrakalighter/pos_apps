ALTER TABLE users
  ADD COLUMN IF NOT EXISTS central_qris_image_url TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(30);

