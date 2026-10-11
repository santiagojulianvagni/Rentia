-- Errores inesperados del servidor y del navegador, agrupados por tipo.
CREATE TABLE IF NOT EXISTS error_reports (
  fingerprint TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  detail TEXT,
  user_id TEXT,
  count BIGINT NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS error_reports_by_last_seen ON error_reports (last_seen_at DESC);
