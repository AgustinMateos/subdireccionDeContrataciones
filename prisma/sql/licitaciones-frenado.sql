-- Licitaciones: Resolución conv. "Frenado", con dónde y desde cuándo. Idempotente.
-- Correr en producción ANTES de subir el código que lo usa a master.
ALTER TABLE "ExpedienteLicitacion" ADD COLUMN IF NOT EXISTS "frenadoDonde" TEXT;
ALTER TABLE "ExpedienteLicitacion" ADD COLUMN IF NOT EXISTS "frenadoDesde" TIMESTAMP(3);
