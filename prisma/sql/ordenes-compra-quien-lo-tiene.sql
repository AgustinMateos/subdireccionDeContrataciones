-- Órdenes de Compra: quién tiene el expediente (Deby, Mely, Caro, Vane, Subdirección, Órdenes de Compra). Idempotente.
-- Correr en producción ANTES de subir el código que lo usa a master.
ALTER TABLE "OrdenCompra" ADD COLUMN IF NOT EXISTS "quienLoTiene" TEXT;
