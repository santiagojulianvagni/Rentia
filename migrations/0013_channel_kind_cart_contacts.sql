-- Los "locales" pasan a ser canales de venta propios: local, mayorista, showroom, feria, etc.
ALTER TABLE physical_stores ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'local';
-- Contacto de los carritos abandonados para recuperar la venta. Va cifrado y se borra a los
-- 90 días (igual que Tiendanube); el resumen del carrito se conserva.
ALTER TABLE abandoned_checkouts ADD COLUMN IF NOT EXISTS contact_encrypted TEXT;
ALTER TABLE abandoned_checkouts ADD COLUMN IF NOT EXISTS contact_iv TEXT;
