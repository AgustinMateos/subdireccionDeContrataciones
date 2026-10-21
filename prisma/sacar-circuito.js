// El estado general "Circuito" ya no existe: pasa a Tramitando los
// expedientes de Resoluciones que lo tengan guardado (la app ya los lee
// así; esto evita que al guardarlos quede en el historial un cambio que
// nadie hizo). El historial anterior queda como está. Sin --aplicar solo
// muestra lo que haría.
//   node prisma/sacar-circuito.js [--aplicar]

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  const enCircuito = await prisma.expedienteResolucion.findMany({
    where: { situacion: { equals: "CIRCUITO", mode: "insensitive" } },
    select: { id: true, exp: true, objeto: true },
    orderBy: { exp: "asc" },
  });
  console.log("En Circuito: " + enCircuito.length);
  for (const e of enCircuito) console.log("  " + e.exp + " - " + e.objeto);
  if (!enCircuito.length) return;
  if (!APLICAR) { console.log("\nNo se cambió nada. Para pasarlos a Tramitando, agregá --aplicar."); return; }
  const { count } = await prisma.expedienteResolucion.updateMany({
    where: { id: { in: enCircuito.map(e => e.id) } },
    data: { situacion: "TRAMITANDO" },
  });
  console.log("\nListo: " + count + " pasaron a Tramitando.");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
