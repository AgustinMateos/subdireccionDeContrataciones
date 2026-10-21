// Pasa el último reingreso de un expediente de Resoluciones a otra fecha
// (cuando se marcó en la app un día después del real): el registro
// "REINGRESO ..." del historial y los cambios que se guardaron junto con él
// (mismo guardado), la fecha de ingreso al sector y, si quedó en el día
// del reingreso, el último movimiento. Sin --aplicar solo muestra lo que
// haría.
//   node prisma/corregir-fecha-reingreso.js 14-08885/2026 2026-10-16 [--aplicar]

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const [exp, dia] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const APLICAR = process.argv.includes("--aplicar");
const PREFIJO_REINGRESO = "REINGRESO ";
const MISMO_GUARDADO_MS = 5000;
const corta = f => (f ? f.toISOString().slice(0, 10) : "sin fecha");

async function main() {
  if (!exp || !/^\d{4}-\d{2}-\d{2}$/.test(dia || "")) {
    console.log("Uso: node prisma/corregir-fecha-reingreso.js <N° de expediente> <AAAA-MM-DD> [--aplicar]");
    process.exitCode = 1;
    return;
  }
  // Fecha pura (medianoche UTC), como las que guarda la app.
  const fecha = new Date(dia + "T00:00:00.000Z");
  const encontrados = await prisma.expedienteResolucion.findMany({
    where: { exp: exp.trim() },
    include: { movimientos: { orderBy: { creadoEn: "asc" } } },
  });
  if (encontrados.length !== 1) {
    console.log(encontrados.length ? "Hay " + encontrados.length + " expedientes con ese N°: no se cambió nada." : "No hay ningún expediente con el N° " + exp + ".");
    process.exitCode = 1;
    return;
  }
  const [e] = encontrados;
  const reingreso = e.movimientos.filter(m => m.campo === "Observaciones" && m.sector.startsWith(PREFIJO_REINGRESO)).at(-1);
  if (!reingreso) {
    console.log(e.exp + " no tiene ningún reingreso en el historial: no se cambió nada.");
    process.exitCode = 1;
    return;
  }
  const delGuardado = e.movimientos.filter(m => Math.abs(m.creadoEn - reingreso.creadoEn) <= MISMO_GUARDADO_MS && m.fecha.getTime() === reingreso.fecha.getTime());
  const cambiarUltimoMov = e.fechaUltimoMov?.getTime() === reingreso.fecha.getTime();

  console.log(e.exp + " - " + e.objeto);
  console.log("\nHistorial (" + corta(reingreso.fecha) + " → " + dia + "):");
  for (const m of delGuardado) console.log("  " + m.campo + ": " + (m.sectorAnterior ? m.sectorAnterior + " → " : "") + m.sector.split("\n")[0]);
  console.log("\nFecha de ingreso: " + corta(e.fechaIngreso) + " → " + dia);
  console.log("Último movimiento: " + corta(e.fechaUltimoMov) + (cambiarUltimoMov ? " → " + dia : " (queda igual)"));

  if (!APLICAR) { console.log("\nNo se cambió nada. Para aplicarlo, agregá --aplicar."); return; }
  await prisma.$transaction([
    prisma.movimientoResolucion.updateMany({ where: { id: { in: delGuardado.map(m => m.id) } }, data: { fecha } }),
    prisma.expedienteResolucion.update({ where: { id: e.id }, data: { fechaIngreso: fecha, ...(cambiarUltimoMov ? { fechaUltimoMov: fecha } : {}) } }),
  ]);
  console.log("\nListo: el reingreso quedó el " + dia + ".");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
