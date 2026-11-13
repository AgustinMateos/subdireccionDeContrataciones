-- Licitaciones: motivo de la no adjudicación (Resolución conv.). Idempotente.
ALTER TABLE "ExpedienteLicitacion" ADD COLUMN IF NOT EXISTS "motivoResolucion" TEXT;
ALTER TABLE "ExpedienteLicitacion" ADD COLUMN IF NOT EXISTS "motivoDetalle" TEXT;
