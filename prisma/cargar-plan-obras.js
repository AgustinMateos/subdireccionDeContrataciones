// Una sola vez por base: crea la tabla del Plan de Obras (si no está) y le
// carga la planilla del Plan 2026 (prisma/plan-obras-2026.json) si todavía
// no tiene obras de ese año. Crea solo esa tabla, sin `db push`, para no
// tocar columnas de otras ramas que la base pueda tener. Se puede volver
// a correr sin duplicar nada.
//   node prisma/cargar-plan-obras.js

const { PrismaClient } = require("@prisma/client");
const obras = require("./plan-obras-2026.json");

const prisma = new PrismaClient();

const CREAR_TABLA = `
CREATE TABLE IF NOT EXISTS "ObraPlan" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL DEFAULT 2026,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "expediente" TEXT,
    "camara" TEXT NOT NULL,
    "destino" TEXT,
    "objeto" TEXT NOT NULL,
    "monto" TEXT,
    "encuadre" TEXT,
    "estado" TEXT,
    "fechaUltimoMov" TIMESTAMP(3),
    "dependenciaActual" TEXT,
    "ordenCompra" TEXT,
    "fechaNotificacionOC" TIMESTAMP(3),
    "plazoEjecucion" TEXT,
    "observaciones" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ObraPlan_pkey" PRIMARY KEY ("id")
)`;

// "2026-09-29" → medianoche UTC, como las demás fechas puras.
const fecha = f => (f ? new Date(f + "T00:00:00.000Z") : null);

async function main() {
  await prisma.$executeRawUnsafe(CREAR_TABLA);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ObraPlan_anio_idx" ON "ObraPlan"("anio")`);

  if (await prisma.obraPlan.count({ where: { anio: 2026 } })) {
    console.log("El Plan de Obras 2026 ya estaba cargado: no se tocó.");
    return;
  }
  const { count } = await prisma.obraPlan.createMany({
    data: obras.map(o => ({
      ...o,
      anio: 2026,
      fechaUltimoMov: fecha(o.fechaUltimoMov),
      fechaNotificacionOC: fecha(o.fechaNotificacionOC),
    })),
  });
  console.log("Obras del Plan 2026 cargadas: " + count);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
