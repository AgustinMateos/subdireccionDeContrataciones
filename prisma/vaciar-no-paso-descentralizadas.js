// Las contrataciones descentralizadas no pasan por Resoluciones: a las que
// tienen Resolución conv. = "No pasó por Resoluciones" se la vacía, para
// que en el análisis cuenten como "Sin resolución cargada" hasta que se
// cargue si se adjudicaron o no. Deja el cambio en el historial.
// Sin --confirmar solo muestra qué haría.
//   node prisma/vaciar-no-paso-descentralizadas.js [--confirmar]

const { PrismaClient } = require("@prisma/client");

const VALOR = "No pasó por Resoluciones";
const USUARIO = "Corrección (descentralizadas)";
const esDescentralizada = e => /DESCENT/.test(String(e.encuadre || "").normalize("NFD").toUpperCase().replace(/[^A-Z]/g, ""));

async function main() {
  const confirmar = process.argv.includes("--confirmar");
  const prisma = new PrismaClient();
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log("Base:", url.hostname + url.pathname);
    const conValor = await prisma.expedienteLicitacion.findMany({ where: { resolucionConv: VALOR }, select: { id: true, exp: true, encuadre: true } });
    const aVaciar = conValor.filter(esDescentralizada);
    console.log(`Con "${VALOR}": ${conValor.length}; descentralizadas (se vacían): ${aVaciar.length}`);
    console.log("Encuadres encontrados: " + [...new Set(aVaciar.map(e => e.encuadre))].join(", "));
    for (const e of aVaciar) console.log("  " + e.exp);
    if (!confirmar) { console.log("\nNo se cambió nada. Para aplicarlo, agregá --confirmar."); return; }

    const hoy = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) + "T00:00:00.000Z");
    await prisma.$transaction(aVaciar.flatMap(e => [
      prisma.expedienteLicitacion.update({ where: { id: e.id }, data: { resolucionConv: null, motivoResolucion: null, motivoDetalle: null } }),
      prisma.movimientoLicitacion.create({ data: { expedienteId: e.id, fecha: hoy, campo: "Resolución conv.", anterior: VALOR, valor: "Sin definir", usuario: USUARIO } }),
    ]));
    console.log(`\nListo: ${aVaciar.length} descentralizadas quedaron sin resolución cargada.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
