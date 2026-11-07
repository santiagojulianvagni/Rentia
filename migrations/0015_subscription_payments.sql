-- Cobros de la suscripción de Rentia (Mercado Pago): historial que ve cada tienda y fecha
-- desde la que corre el período de gracia si un cobro falla.
CREATE TABLE IF NOT EXISTS subscription_payments (
  user_id TEXT NOT NULL REFERENCES accounts(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_payment_id TEXT NOT NULL,
  preapproval_id TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ARS',
  status TEXT NOT NULL,
  paid_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (provider, provider_payment_id)
);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_user ON subscription_payments(user_id, paid_at DESC);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS past_due_since TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_amount DOUBLE PRECISION;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider_status TEXT;
