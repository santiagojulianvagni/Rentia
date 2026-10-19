-- Regla de nombres de campañas de cada tienda (separador y partes), para revisar los anuncios.
CREATE TABLE IF NOT EXISTS ad_naming_rules (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  separator TEXT NOT NULL,
  segments_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
