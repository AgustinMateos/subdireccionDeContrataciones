// Una sola vez por base: agrega a los expedientes de Resoluciones las
// columnas de los escritos (esEscrito, escritoMotivo: un escrito referido a
// un expediente y por qué se generó). Solo agrega columnas, sin `db push`,
// para no tocar columnas de otras ramas que la base pueda tener. Se puede
// volver a correr sin cambiar nada. Hay que correrlo en producción ANTES
// de subir el código que las usa a master.
//   node prisma/agregar-escritos.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const COLUMNAS = [
  `ADD COLUMN IF NOT EXISTS "esEscrito" BOOLEAN NOT NULL DEFAULT false`,
  `ADD COLUMN IF NOT EXISTS "escritoMotivo" TEXT`,
];

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ExpedienteResolucion" ` + COLUMNAS.join(", "));
  const columnas = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'ExpedienteResolucion' AND column_name IN ('esEscrito', 'escritoMotivo') ORDER BY column_name`
  );
  console.log("Columnas de los escritos en la base: " + columnas.map(c => c.column_name).join(", "));
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
