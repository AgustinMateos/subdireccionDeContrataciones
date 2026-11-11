// Reemplaza TODOS los expedientes de Licitaciones (y su historial) por los
// de la planilla. Sin --confirmar solo muestra qué haría.
//   node --experimental-detect-module prisma/reemplazar-licitaciones.js <planilla.xlsx> [--hoja "TRABAJO DIARIO"] [--confirmar]
// Se hace en una sola transacción: si algo falla, no se borra nada.
// El N° de expediente pasa al formato del sistema (NN-NNNNN/AAAA). Si en la
// columna EXP quedó un texto largo (una observación pegada ahí), se carga
// como "(sin N°)" para corregirlo desde el sistema.

const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { leerPlanilla } = require("./cargar-licitaciones.js");

const USUARIO_CARGA = "Planilla anterior";
const SIN_NUMERO = "(sin N°)";

async function main() {
  const args = process.argv.slice(2);
  const ruta = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--hoja");
  const hoja = args.includes("--hoja") ? args[args.indexOf("--hoja") + 1] : "TRABAJO DIARIO";
  const confirmar = args.includes("--confirmar");
  if (!ruta) throw new Error("Falta la ruta de la planilla");

  const { normalizarExp } = await import("../lib/numeroExpediente.js");
  const raros = [];
  const expedientes = leerPlanilla(ruta, hoja).map(({ paseFirmaIlegible, ...e }) => {
    let exp = normalizarExp(e.exp);
    if (exp.length > 80 && !/\d{2}-\d{5}\/\d{4}/.test(exp)) { raros.push("EXP con texto (va como " + SIN_NUMERO + "): " + exp.slice(0, 70) + "…"); exp = SIN_NUMERO; }
    else if (/^\d+$/.test(exp)) raros.push("EXP solo con un número: " + exp);
    return { ...e, exp, id: randomUUID() };
  });

  const prisma = new PrismaClient();
  try {
    const antes = await prisma.expedienteLicitacion.count();
    const movAntes = await prisma.movimientoLicitacion.count();
    const url = new URL(process.env.DATABASE_URL);
    console.log("Base:", url.hostname + url.pathname);
    console.log("Hoja «" + hoja + "»: " + expedientes.length + " expedientes");
    console.log("En la base ahora: " + antes + " expedientes y " + movAntes + " registros de historial (se borran todos)");
    raros.forEach(r => console.log("  · " + r));
    const sinFecha = expedientes.filter(e => !e.fechaUltimoMov).length;
    if (sinFecha) console.log("  · Sin fecha de último movimiento legible: " + sinFecha);
    if (!confirmar) { console.log("\nNo se cambió nada. Para hacerlo, agregá --confirmar."); return; }

    // Las observaciones de la planilla quedan como primer registro del historial.
    const movimientos = expedientes.filter(e => e.observaciones).map(e => ({
      id: randomUUID(), expedienteId: e.id, fecha: e.fechaUltimoMov || new Date(),
      campo: "Observaciones", valor: e.observaciones, usuario: USUARIO_CARGA,
    }));
    await prisma.$transaction([
      prisma.movimientoLicitacion.deleteMany({}),
      prisma.expedienteLicitacion.deleteMany({}),
      prisma.expedienteLicitacion.createMany({ data: expedientes }),
      prisma.movimientoLicitacion.createMany({ data: movimientos }),
    ], { timeout: 120000 });
    console.log("\nListo: " + (await prisma.expedienteLicitacion.count()) + " expedientes y " + (await prisma.movimientoLicitacion.count()) + " registros de historial.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
