-- Títulos del presupuesto asignados a mano (modelo TituloPresupuesto). Idempotente.
CREATE TABLE IF NOT EXISTS "TituloPresupuesto" (
  "id" TEXT NOT NULL,
  "cuadro" TEXT NOT NULL,
  "anio" INTEGER NOT NULL,
  "clave" TEXT NOT NULL,
  "renglonId" TEXT,
  "usuario" TEXT NOT NULL,
  "actualizadoEn" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TituloPresupuesto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TituloPresupuesto_cuadro_anio_clave_key" ON "TituloPresupuesto"("cuadro", "anio", "clave");
