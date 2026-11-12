-- Tablas del Cuadro de Informática y Varios (FilaCuadroIyV, MovimientoCuadroIyV).
-- Se puede correr más de una vez: no rompe nada si ya existen.
-- CreateTable
CREATE TABLE IF NOT EXISTS "FilaCuadroIyV" (
    "id" TEXT NOT NULL,
    "hoja" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "datos" JSONB NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FilaCuadroIyV_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MovimientoCuadroIyV" (
    "id" TEXT NOT NULL,
    "filaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "campo" TEXT NOT NULL,
    "anterior" TEXT,
    "valor" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,

    CONSTRAINT "MovimientoCuadroIyV_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FilaCuadroIyV_hoja_idx" ON "FilaCuadroIyV"("hoja");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MovimientoCuadroIyV_filaId_idx" ON "MovimientoCuadroIyV"("filaId");

-- AddForeignKey
DO $$ BEGIN ALTER TABLE "MovimientoCuadroIyV" ADD CONSTRAINT "MovimientoCuadroIyV_filaId_fkey" FOREIGN KEY ("filaId") REFERENCES "FilaCuadroIyV"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;


