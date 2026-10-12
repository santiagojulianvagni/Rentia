-- Día del mes en que se paga un gasto fijo (opcional), para el calendario de cashflow.
ALTER TABLE cost_rules ADD COLUMN IF NOT EXISTS due_day INTEGER CHECK (due_day BETWEEN 1 AND 31);
