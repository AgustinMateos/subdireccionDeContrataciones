// Corrige la fecha de ingreso al sector de un expediente de Resoluciones
// (la app no la deja cambiar al editar: solo un reingreso la pone en hoy).
// Sin --aplicar solo muestra lo que haría. Si el N° está en más de un
// expediente, no cambia nada.
//   node prisma/cambiar-fecha-ingreso.js 14-08885/2026 2026-10-16 [--aplicar]

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const [exp, dia] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const APLICAR = process.argv.includes("--aplicar");

async function main() {
  if (!exp || !/^\d{4}-\d{2}-\d{2}$/.test(dia || "")) {
    console.log("Uso: node prisma/cambiar-fecha-ingreso.js <N° de expediente> <AAAA-MM-DD> [--aplicar]");
    process.exitCode = 1;
    return;
  }
  // Fecha pura (medianoche UTC), como las que se cargan desde la app.
  const fecha = new Date(dia + "T00:00:00.000Z");
  const encontrados = await prisma.expedienteResolucion.findMany({ where: { exp: exp.trim() } });
  if (encontrados.length !== 1) {
    console.log(encontrados.length ? "Hay " + encontrados.length + " expedientes con ese N°: no se cambió nada." : "No hay ningún expediente con el N° " + exp + ".");
    for (const e of encontrados) console.log("  " + e.id + " - " + e.objeto);
    process.exitCode = 1;
    return;
  }
  const [e] = encontrados;
  const antes = e.fechaIngreso ? e.fechaIngreso.toISOString().slice(0, 10) : "sin fecha";
  console.log(e.exp + " - " + e.objeto);
  console.log("Fecha de ingreso: " + antes + " → " + dia);
  if (!APLICAR) { console.log("\nNo se cambió nada. Para aplicarlo, agregá --aplicar."); return; }
  await prisma.expedienteResolucion.update({ where: { id: e.id }, data: { fechaIngreso: fecha } });
  console.log("\nListo: la fecha de ingreso quedó en " + dia + ".");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
