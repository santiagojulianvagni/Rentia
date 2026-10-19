-- Datos para la sección Clientes: un código anónimo del cliente (hash, sin nombre ni email),
-- dónde recibe, cómo se envía y por qué canal de la tienda entró la orden. Y las categorías
-- de cada producto para ver ventas por categoría.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_key TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_province TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS ship_city TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS storefront TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(user_id, customer_key);
ALTER TABLE products ADD COLUMN IF NOT EXISTS categories TEXT;
