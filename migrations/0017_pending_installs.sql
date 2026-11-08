-- Instalaciones que llegan desde la tienda de apps de Tiendanube antes de que la persona tenga
-- cuenta en Rentia: la conexión queda en espera (cifrada, una hora) hasta que crea su cuenta o
-- ingresa desde el mismo navegador. Se guarda solo el hash del código de la cookie.
CREATE TABLE IF NOT EXISTS pending_installs (
  token_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  store_id TEXT NOT NULL,
  store_name TEXT,
  encrypted_access_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  scopes TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_installs_expires ON pending_installs(expires_at);
