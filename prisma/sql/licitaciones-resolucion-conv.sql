-- Licitaciones: resolución de la convocatoria (Adjudicada, Adjudicación
-- parcial, Sin efecto, Desierta, Fracasada). Se puede correr más de una vez.
ALTER TABLE "ExpedienteLicitacion" ADD COLUMN IF NOT EXISTS "resolucionConv" TEXT;
