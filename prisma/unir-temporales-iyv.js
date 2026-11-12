// Pasa las filas de Servicios temporales del Cuadro de Informática y
// Varios a la solapa Provisiones (con las claves de Provisiones: organismo
// → destinatario, monto → monto $, OC/Resol. → OC, estado → etapa), al
// final de la lista. Las observaciones no se tocan (van por N° de
// expediente). Sin --confirmar solo muestra qué haría.
//   node --experimental-detect-module prisma/unir-temporales-iyv.js [--confirmar]

const { PrismaClient } = require("@prisma/client");

async function main() {
  const confirmar = process.argv.includes("--confirmar");
  const { datosTemporalAProvision } = await import("../lib/cuadroIyV.js");
  const prisma = new PrismaClient();
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log("Base:", url.hostname + url.pathname);
    const temporales = await prisma.filaCuadroIyV.findMany({ where: { hoja: "temporales" }, orderBy: [{ orden: "asc" }, { creadoEn: "asc" }] });
    const ultima = await prisma.filaCuadroIyV.findFirst({ where: { hoja: "provisiones" }, orderBy: { orden: "desc" }, select: { orden: true } });
    let orden = (ultima?.orden ?? -1) + 1;
    console.log(temporales.length + " filas de Servicios temporales → Provisiones");
    if (temporales.length) console.log("Ejemplo:", JSON.stringify(datosTemporalAProvision(temporales[0].datos)).slice(0, 250));
    if (!confirmar) { console.log("No se cambió nada. Para hacerlo, agregá --confirmar."); return; }
    await prisma.$transaction(temporales.map(f => prisma.filaCuadroIyV.update({
      where: { id: f.id },
      data: {
        hoja: "provisiones", orden: orden++, datos: datosTemporalAProvision(f.datos),
        movimientos: { create: [{ campo: "Solapa", anterior: "Servicios temporales", valor: "Provisiones", usuario: "Sistema" }] },
      },
    })), { timeout: 120000 });
    console.log("Listo.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
