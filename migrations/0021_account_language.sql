-- Idioma en el que el dueño usa Rentia (es, en o pt): con él se mandan los mails de la cuenta.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es';
