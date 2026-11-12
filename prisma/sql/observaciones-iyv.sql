-- Observaciones del Cuadro de Informática y Varios (ObservacionIyV).
-- Se puede correr más de una vez: no rompe nada si ya existe.
CREATE TABLE IF NOT EXISTS "ObservacionIyV" (
    "id" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacionIyV_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ObservacionIyV_clave_idx" ON "ObservacionIyV"("clave");
