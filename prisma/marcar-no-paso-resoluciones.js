// Pone Resolución conv. = "No pasó por Resoluciones" a los expedientes de
// Licitaciones de una lista (un N° por renglón, tal como figura en el
// cuadro). Deja el cambio en el historial de cada expediente.
// Sin --confirmar solo muestra qué haría.
//   node prisma/marcar-no-paso-resoluciones.js prisma/datos/no-paso-resoluciones.txt [--confirmar] [--pisar]
// Sin --pisar no cambia los que ya tienen otra Resolución conv.
//
// Cómo busca cada renglón: primero el texto igual (sin distinguir
// mayúsculas, espacios ni punto final); si no, por los N° NN-NNNNN/AAAA que
// tenga (mismos N°, sin importar "Ref." u otro texto). Los renglones sin N°
// ("-", "(sin N°)", "7264") solo se aplican si en el cuadro hay exactamente
// tantas filas con ese texto como veces aparece en la lista.

const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const VALOR = "No pasó por Resoluciones";
const USUARIO = "Carga por lista";

const texto = s => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim().replace(/[.\s]+$/, "");
const numeros = s => [...String(s ?? "").matchAll(/(\d{1,2})\s*-\s*(\d{1,6})\s*\/\s*(\d{4})/g)]
  .map(m => m[1].padStart(2, "0") + "-" + m[2].padStart(5, "0") + "/" + m[3]).sort().join(" ");

async function main() {
  const args = process.argv.slice(2);
  const ruta = args.find(a => !a.startsWith("--"));
  const confirmar = args.includes("--confirmar");
  const pisar = args.includes("--pisar");
  if (!ruta) throw new Error("Falta la ruta de la lista");

  const lista = fs.readFileSync(ruta, "utf8").split(/\r?\n/).map(l => l.split("\t")[0].trim()).filter(Boolean);
  const veces = new Map();
  for (const l of lista) veces.set(texto(l), (veces.get(texto(l)) || 0) + 1);

  const prisma = new PrismaClient();
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log("Base:", url.hostname + url.pathname);
    const exps = await prisma.expedienteLicitacion.findMany({ select: { id: true, exp: true, resolucionConv: true } });

    const elegidos = new Map(); // id -> exp
    const sinEncontrar = [];
    const dudosos = [];
    const varias = [];
    for (const [clave, n] of veces) {
      let filas = exps.filter(e => texto(e.exp) === clave);
      const nums = numeros(clave);
      if (!filas.length && nums) filas = exps.filter(e => numeros(e.exp) === nums);
      if (!filas.length) { sinEncontrar.push(clave); continue; }
      if (!nums && filas.length !== n) { dudosos.push(`"${clave}": ${filas.length} filas en el cuadro, ${n} en la lista`); continue; }
      if (filas.length > n) varias.push(`"${clave}": ${filas.length} filas (${filas.map(f => f.exp).join(" | ")})`);
      for (const f of filas) elegidos.set(f.id, f);
    }

    const aCambiar = [];
    const conOtra = [];
    let yaEstaban = 0;
    for (const e of elegidos.values()) {
      if (e.resolucionConv === VALOR) yaEstaban++;
      else if (e.resolucionConv && !pisar) conOtra.push(`${e.exp} (tiene "${e.resolucionConv}")`);
      else aCambiar.push(e);
    }

    console.log(`Renglones en la lista: ${lista.length} (${veces.size} distintos)`);
    console.log(`Expedientes encontrados: ${elegidos.size}; ya tenían "${VALOR}": ${yaEstaban}; a cambiar: ${aCambiar.length}`);
    if (conOtra.length) console.log(`\nCon otra Resolución conv. (no se tocan; --pisar para cambiarlos):\n  ` + conOtra.join("\n  "));
    if (varias.length) console.log(`\nRenglones que coinciden con más de una fila (se marcan todas):\n  ` + varias.join("\n  "));
    if (sinEncontrar.length) console.log(`\nNo están en el cuadro:\n  ` + sinEncontrar.join("\n  "));
    if (dudosos.length) console.log(`\nSin N° y con distinta cantidad de filas (no se tocan, cargalos a mano):\n  ` + dudosos.join("\n  "));
    if (!confirmar) { console.log("\nNo se cambió nada. Para aplicarlo, agregá --confirmar."); return; }

    const ahora = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }) + "T00:00:00.000Z");
    await prisma.$transaction(aCambiar.flatMap(e => [
      prisma.expedienteLicitacion.update({ where: { id: e.id }, data: { resolucionConv: VALOR } }),
      prisma.movimientoLicitacion.create({ data: { expedienteId: e.id, fecha: ahora, campo: "Resolución conv.", anterior: e.resolucionConv || null, valor: VALOR, usuario: USUARIO } }),
    ]));
    console.log(`\nListo: ${aCambiar.length} expedientes con "${VALOR}".`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
