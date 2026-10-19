-- Carritos abandonados de Tiendanube. Tiendanube los muestra solo 30 días: Rentia los guarda
-- para tener el historial completo. Sin datos de contacto del comprador: fecha, importe y productos.
CREATE TABLE IF NOT EXISTS abandoned_checkouts (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  total DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ARS',
  units BIGINT NOT NULL DEFAULT 0,
  items_json TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider, external_id)
);
CREATE INDEX IF NOT EXISTS idx_abandoned_checkouts_created ON abandoned_checkouts(user_id, created_at);
