-- Datos del negocio que se piden en el onboarding: rubro, órdenes por mes aproximadas,
-- condición fiscal y objetivo principal. Sirven para sugerir el plan, abrir el panel en lo que
-- más le importa a la tienda y, más adelante, para la factura (condición fiscal).
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS business_category TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS monthly_orders TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tax_condition TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS main_goal TEXT;
