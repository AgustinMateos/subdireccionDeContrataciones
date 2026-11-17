// Una sola vez por base: crea la tabla de agentes de Resoluciones
// (AgenteResolucion) y la carga con los que pasaron por el depto.: los
// activos (a los que se les puede asignar) y, como inactivos, el resto de
// la lista histórica. Lo que haya escrito a mano en el campo agente de los
// expedientes (p. ej. "JC/LP", "PRORROGA") no se carga: se sigue viendo en
// esos expedientes, pero no es un agente al que asignar.
// Solo crea la tabla, sin `db push`, para no tocar columnas de otras ramas
// que la base pueda tener. Se puede volver a correr: no pisa lo que Soporte
// ya haya cambiado. Hay que correrlo en producción ANTES de subir el código
// que la usa a master.
//   node prisma/crear-agentes-resoluciones.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const ACTIVOS = ["LRB", "MLA", "JC", "SR", "AUG"];
const HISTORICOS = ["MQR", "CG", "LT", "CAR", "AM"];

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AgenteResolucion" (
      "id" TEXT NOT NULL,
      "sigla" TEXT NOT NULL,
      "nombre" TEXT,
      "activo" BOOLEAN NOT NULL DEFAULT true,
      "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AgenteResolucion_pkey" PRIMARY KEY ("id")
    )`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "AgenteResolucion_sigla_key" ON "AgenteResolucion"("sigla")`);

  for (const sigla of ACTIVOS) {
    await prisma.agenteResolucion.upsert({ where: { sigla }, update: {}, create: { sigla, activo: true } });
  }
  for (const sigla of HISTORICOS) {
    await prisma.agenteResolucion.upsert({ where: { sigla }, update: {}, create: { sigla, activo: false } });
  }

  const todos = await prisma.agenteResolucion.findMany({ orderBy: { sigla: "asc" } });
  console.log("Activos:  ", todos.filter(a => a.activo).map(a => a.sigla).join(", "));
  console.log("Inactivos:", todos.filter(a => !a.activo).map(a => a.sigla).join(", "));
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
