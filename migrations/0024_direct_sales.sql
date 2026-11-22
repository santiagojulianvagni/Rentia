-- Ventas directas (WhatsApp, Instagram, en persona…) cargadas a mano en Rentia. Se guardan como
-- órdenes con provider 'directa_<canal>'. Sus productos son los del catálogo de la tienda
-- (Tiendanube o Mercado Libre): source_provider dice de cuál, para tomar el costo de la variante.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS source_provider TEXT;
-- Cliente o nota que la tienda escribe al cargar la venta.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_note TEXT;
