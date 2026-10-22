// Pone en préstamo un expediente de Resoluciones con su N° de dictamen y
// cuándo vence, y deja la constancia en las observaciones y el historial
// ("EN PRÉSTAMO - Dictamen N° ..., vence el ..."), como la app. Sin
// --aplicar solo muestra lo que haría.
//   node prisma/marcar-prestamo.js 13-05573/2026 416/2026 2026-10-26 [--aplicar]

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const [exp, dictamen, dia] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const APLICAR = process.argv.includes("--aplicar");
const corta = f => (f ? f.toISOString().slice(0, 10) : "sin fecha");
const legible = f => { const [a, m, d] = corta(f).split("-"); return Number(d) + "/" + Number(m) + "/" + a; };

async function main() {
  const m = String(dictamen || "").match(/^(\d+)\/(\d{4})$/);
  if (!exp || !m || !/^\d{4}-\d{2}-\d{2}$/.test(dia || "")) {
    console.log("Uso: node prisma/marcar-prestamo.js <N° de expediente> <NNN/AAAA> <AAAA-MM-DD> [--aplicar]");
    process.exitCode = 1;
    return;
  }
  const dictamenNumero = Number(m[1]) + "/" + m[2];
  // Fecha pura (medianoche UTC), como las que guarda la app.
  const dictamenVence = new Date(dia + "T00:00:00.000Z");
  const encontrados = await prisma.expedienteResolucion.findMany({ where: { exp: exp.trim() } });
  if (encontrados.length !== 1) {
    console.log(encontrados.length ? "Hay " + encontrados.length + " expedientes con ese N°: no se cambió nada." : "No hay ningún expediente con el N° " + exp + ".");
    process.exitCode = 1;
    return;
  }
  const [e] = encontrados;
  const observaciones = "EN PRÉSTAMO - Dictamen N° " + dictamenNumero + ", vence el " + legible(dictamenVence);

  console.log(e.exp + " - " + e.objeto);
  console.log("En préstamo: " + (e.enPrestamo ? "Sí (" + (e.dictamenNumero || "-") + ", " + corta(e.dictamenVence) + ")" : "No") + " → Sí (" + dictamenNumero + ", " + dia + ")");
  console.log("Observaciones: " + (e.observaciones || "vacío") + " → " + observaciones);

  if (!APLICAR) { console.log("\nNo se cambió nada. Para aplicarlo, agregá --aplicar."); return; }
  const hoy = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) + "T00:00:00.000Z");
  await prisma.expedienteResolucion.update({
    where: { id: e.id },
    data: {
      enPrestamo: true, dictamenNumero, dictamenVence, observaciones,
      movimientos: { create: { fecha: hoy, campo: "Observaciones", sectorAnterior: e.observaciones || null, sector: observaciones, usuario: "Script" } },
    },
  });
  console.log("\nListo: " + e.exp + " quedó en préstamo.");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
