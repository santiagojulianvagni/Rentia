-- Quién le escribió al comprador de un carrito, cuándo y por dónde, para no repetir el mensaje.
ALTER TABLE abandoned_checkouts ADD COLUMN IF NOT EXISTS contacted_at TEXT;
ALTER TABLE abandoned_checkouts ADD COLUMN IF NOT EXISTS contacted_by TEXT;
ALTER TABLE abandoned_checkouts ADD COLUMN IF NOT EXISTS contacted_via TEXT;
