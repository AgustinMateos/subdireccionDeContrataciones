-- Licitaciones: N° de orden de compra en la ficha. Idempotente.
-- Correr en producción ANTES de subir el código que lo usa a master.
ALTER TABLE "ExpedienteLicitacion" ADD COLUMN IF NOT EXISTS "ordenCompra" TEXT;
