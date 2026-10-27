// Para un expediente de Resoluciones que vino en préstamo, volvió a
// Aperturas y después entró a Resoluciones antes de que la app lo
// registrara como ingreso efectivo (ver conPrestamo): la fecha de ingreso
// al sector pasa a ser el día en que entró a Resoluciones después del
// préstamo, y queda en el historial la misma constancia que pone la app
// ("INGRESO AL SECTOR - Después del préstamo..."). Sin --aplicar solo
// muestra lo que haría.
//   node prisma/ingreso-tras-prestamo.js 13-05573/2026 [--aplicar]

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const [exp] = process.argv.slice(2).filter(a => !a.startsWith("--"));
const APLICAR = process.argv.includes("--aplicar");
const PREFIJO_FIN_PRESTAMO = "ESTUVO EN PRÉSTAMO";
const PREFIJO_INGRESO = "INGRESO AL SECTOR";
const corta = f => (f ? f.toISOString().slice(0, 10) : "sin fecha");
const legible = f => (f ? f.toISOString().slice(0, 10).split("-").reverse().join("/") : "-");

async function main() {
  if (!exp) {
    console.log("Uso: node prisma/ingreso-tras-prestamo.js <N° de expediente> [--aplicar]");
    process.exitCode = 1;
    return;
  }
  // El N° puede estar cargado con el año corto o largo (13-05573/26 o /2026).
  const variantes = [...new Set([exp.trim(), exp.trim().replace(/\/(\d{2})$/, "/20$1"), exp.trim().replace(/\/20(\d{2})$/, "/$1")])];
  const encontrados = await prisma.expedienteResolucion.findMany({
    where: { exp: { in: variantes } },
    include: { movimientos: { orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }] } },
  });
  if (encontrados.length !== 1) {
    console.log(encontrados.length ? "Hay " + encontrados.length + " expedientes con ese N°: no se cambió nada." : "No hay ningún expediente con el N° " + exp + ".");
    process.exitCode = 1;
    return;
  }
  const [e] = encontrados;
  console.log(e.exp + " - " + e.objeto);
  console.log("\nHistorial:");
  for (const m of e.movimientos) console.log("  " + corta(m.fecha) + "  " + m.campo + ": " + (m.sectorAnterior ? m.sectorAnterior + " → " : "") + m.sector.split("\n")[0]);

  const fin = e.movimientos.filter(m => m.campo === "Observaciones" && m.sector.startsWith(PREFIJO_FIN_PRESTAMO)).at(-1);
  const despues = fin ? e.movimientos.slice(e.movimientos.indexOf(fin) + 1) : [];
  const entrada = despues.find(m => m.campo === "Sector actual" && m.sector.trim().toUpperCase() === "RESOLUCIONES");
  const yaHecho = despues.some(m => m.campo === "Observaciones" && m.sector.startsWith(PREFIJO_INGRESO));
  if (e.enPrestamo || !fin || !entrada || yaHecho) {
    console.log("\n" + (e.enPrestamo ? "Sigue en préstamo"
      : !fin ? "No tiene un préstamo terminado en el historial"
      : !entrada ? "No volvió a entrar a Resoluciones después del préstamo"
      : "Ya tiene la constancia de ingreso después del préstamo") + ": no se cambió nada.");
    process.exitCode = 1;
    return;
  }

  const dictamen = fin.sector.match(/Dictamen N° ([^,.\s]+)/)?.[1];
  const constancia = PREFIJO_INGRESO + " - Después del préstamo" + (dictamen && dictamen !== "-" ? " (Dictamen N° " + dictamen + ")" : "")
    + ". Ingreso al sector: " + legible(e.fechaIngreso) + " → " + legible(entrada.fecha);
  console.log("\nFecha de ingreso: " + corta(e.fechaIngreso) + " → " + corta(entrada.fecha));
  console.log("Constancia en el historial (" + corta(entrada.fecha) + "): " + constancia);
  console.log("Las observaciones del expediente quedan como están.");

  if (!APLICAR) { console.log("\nNo se cambió nada. Para aplicarlo, agregá --aplicar."); return; }
  await prisma.$transaction([
    prisma.expedienteResolucion.update({ where: { id: e.id }, data: { fechaIngreso: entrada.fecha } }),
    prisma.movimientoResolucion.create({
      data: { expedienteId: e.id, fecha: entrada.fecha, campo: "Observaciones", sectorAnterior: e.observaciones || null, sector: constancia, usuario: entrada.usuario },
    }),
  ]);
  console.log("\nListo: la fecha de ingreso quedó en " + corta(entrada.fecha) + ".");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
