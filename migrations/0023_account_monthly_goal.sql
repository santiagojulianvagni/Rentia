-- Meta de facturación que el dueño pone para un mes (por ejemplo "$ 50M en noviembre").
-- Vale solo para ese mes: sin meta propia, el panel usa el punto de equilibrio.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS goal_month TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS goal_amount NUMERIC;
