-- Aceptación de términos al elegir un plan y baja de la suscripción por el propio cliente.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS terms_accepted_at TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_at TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS canceled_by TEXT;
