// Una sola vez por base: agrega a los expedientes de Resoluciones las
// columnas del préstamo (enPrestamo, dictamenNumero, dictamenVence,
// dictamenAvisado). Solo agrega columnas, sin `db push`, para no tocar
// columnas de otras ramas que la base pueda tener. Se puede volver a correr
// sin cambiar nada. Hay que correrlo en producción ANTES de subir el código
// que las usa a master.
//   node prisma/agregar-prestamo-dictamen.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const COLUMNAS = [
  `ADD COLUMN IF NOT EXISTS "enPrestamo" BOOLEAN NOT NULL DEFAULT false`,
  `ADD COLUMN IF NOT EXISTS "dictamenNumero" TEXT`,
  `ADD COLUMN IF NOT EXISTS "dictamenVence" TIMESTAMP(3)`,
  `ADD COLUMN IF NOT EXISTS "dictamenAvisado" TIMESTAMP(3)`,
];

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ExpedienteResolucion" ` + COLUMNAS.join(", "));
  const columnas = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'ExpedienteResolucion' AND column_name IN ('enPrestamo', 'dictamenNumero', 'dictamenVence', 'dictamenAvisado') ORDER BY column_name`
  );
  console.log("Columnas del préstamo en la base: " + columnas.map(c => c.column_name).join(", "));
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
