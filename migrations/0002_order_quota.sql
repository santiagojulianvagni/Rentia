-- Órdenes que no se importaron porque la tienda alcanzó el límite mensual de su plan.
-- Se recuperan automáticamente cuando la tienda pasa a un plan con más capacidad.
CREATE TABLE IF NOT EXISTS skipped_orders (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  source_created_at TEXT,
  skipped_at TEXT NOT NULL,
  PRIMARY KEY (user_id, provider, external_order_id),
  FOREIGN KEY (user_id) REFERENCES accounts(user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS skipped_orders_by_month ON skipped_orders (user_id, source_created_at);
CREATE INDEX IF NOT EXISTS orders_by_created_month ON orders (user_id, (left(source_created_at, 7)));
