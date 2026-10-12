-- Umbrales de alertas y preferencias de aviso por email de cada tienda.
CREATE TABLE IF NOT EXISTS alert_settings (
  user_id TEXT PRIMARY KEY REFERENCES accounts(user_id) ON DELETE CASCADE,
  margin_min DOUBLE PRECISION NOT NULL DEFAULT 10,
  margin_drop DOUBLE PRECISION NOT NULL DEFAULT 5,
  sales_drop DOUBLE PRECISION NOT NULL DEFAULT 30,
  stock_days INTEGER NOT NULL DEFAULT 14,
  campaign_min_spend DOUBLE PRECISION NOT NULL DEFAULT 0,
  alert_email BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_email BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TEXT NOT NULL
);
