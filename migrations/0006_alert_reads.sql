-- Alertas vistas u ocultadas por cada persona del equipo (se sincroniza entre dispositivos).
CREATE TABLE IF NOT EXISTS alert_reads (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL,
  alert_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('seen','dismissed')),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, viewer_id, alert_key)
);
