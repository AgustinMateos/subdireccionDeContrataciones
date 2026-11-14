// Una sola vez por base: agrega a los expedientes de Resoluciones la
// columna del motivo de no adjudicación (motivoNoAdjudicacion: uno o varios
// motivos cuando el tipo de resolución no adjudica). Solo agrega la
// columna, sin `db push`, para no tocar columnas de otras ramas que la base
// pueda tener. Se puede volver a correr sin cambiar nada. Hay que correrlo
// en producción ANTES de subir el código que la usa a master.
//   node prisma/agregar-motivo-no-adjudicacion.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ExpedienteResolucion" ADD COLUMN IF NOT EXISTS "motivoNoAdjudicacion" TEXT`);
  const columnas = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'ExpedienteResolucion' AND column_name = 'motivoNoAdjudicacion'`
  );
  console.log(columnas.length ? "La columna motivoNoAdjudicacion está en la base." : "No se encontró la columna.");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
