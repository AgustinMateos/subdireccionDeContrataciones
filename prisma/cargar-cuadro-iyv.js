// Carga la planilla "EXPEDIENTES INFORMATICA Y VARIOS" en el Cuadro de
// Informática y Varios (FilaCuadroIyV). Reemplaza TODAS las filas del
// cuadro (y su historial). Sin --confirmar solo muestra qué haría.
//   node --experimental-detect-module prisma/cargar-cuadro-iyv.js <planilla.xlsx> [--confirmar]
// Se hace en una sola transacción: si algo falla, no se borra nada.
//
// Cada hoja tiene sus columnas (COLUMNAS); las celdas combinadas (un grupo
// o un servicio con varios renglones) se copian a todas las filas que
// abarcan. Las columnas de días que calcula la planilla no se cargan: el
// sistema los calcula. "-" y "------" cuentan como vacío.

const { randomUUID } = require("crypto");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const { observacionesDeFila, USUARIO } = require("./migrar-observaciones-iyv.js");

const SALTEAR = null;
const VIGENTE = ["exp", "contratacion", "montoPesos", "montoUsd", "inicio", "vencimiento", "ocResol", "caratularRenovacion", "caratularProrroga", "adjudicatario", "prorrogaMeses"];
const SERVICIO = ["grupo", "tipoServicio", "agente", "fuero", "organismo", "domicilio", "objeto"];
const CONTINUIDAD = ["cExp", "cContratacion", "cMonto", "cInicio", "cVencimiento", "cOcResol", "cUltimoMov", "cSector", "cEstadoConvocatoria", SALTEAR, "cObservaciones"];

// Por hoja de la planilla: a qué hoja del cuadro va, desde qué fila
// empiezan los datos (0 = la primera) y la clave de cada columna.
const COLUMNAS = {
  "Servicios informatica y varios": {
    hoja: "servicios", desde: 2,
    claves: [...SERVICIO, ...VIGENTE, "ultimoMov", "sector", "estadoConvocatoria", "observaciones", ...CONTINUIDAD,
      "rExp", "rContratacion", "rMontoPesos", "rMontoUsd", "rInicio", "rVencimiento", "rOcResol", "rAdjudicatario", "rProrrogaMeses",
      "rUltimoMov", "rSector", "rEstadoConvocatoria", SALTEAR, "rObservaciones"],
  },
  "Prov. Informatica y Varios": {
    hoja: "provisiones", desde: 1,
    claves: ["tipoServicio", "agente", "exp", "fuero", "objeto", "destinatario", "montoPesos", "montoUsd", "encuadre", "oc",
      "ultimoMov", SALTEAR, "sector", "etapa", "observaciones", "salida", "estado"],
  },
  " Servicios Temporales": {
    hoja: "temporales", desde: 2,
    claves: ["tipoServicio", "agente", "fuero", "organismo", "domicilio", "objeto", "exp", "inicio", "vencimiento", "encuadre",
      "ocResol", "sector", "estadoConvocatoria", "entrada", "salida", "estado", "observaciones", "adjudicatario", "monto", "prorroga"],
  },
  // Sin encabezado y con dos columnas menos que Servicios (no tiene estado
  // de convocatoria en el vigente ni prórroga en la renovación); lo que
  // sobra a la derecha va a las observaciones de la renovación.
  "antedecentes": {
    hoja: "antecedentes", desde: 0,
    claves: [...SERVICIO, ...VIGENTE, "sector", "ultimoMov", "observaciones", ...CONTINUIDAD,
      "rExp", "rContratacion", "rMontoPesos", "rMontoUsd", "rInicio", "rVencimiento", "rOcResol", "rAdjudicatario",
      "rUltimoMov", "rSector", "rEstadoConvocatoria", SALTEAR, "rObservaciones", "rObservaciones", "rObservaciones", "rObservaciones", "rObservaciones"],
  },
};

// Con alguno de estos, la fila es un renglón; si no, es basura de la planilla.
const CLAVES_QUE_CUENTAN = ["objeto", "exp", "cExp", "rExp", "organismo", "adjudicatario", "rAdjudicatario", "observaciones", "destinatario"];

const vacio = v => !String(v ?? "").trim() || /^[-\s.,]+$/.test(String(v).trim());

// Copia el contenido de cada celda combinada a todas las celdas que abarca.
function completarCombinadas(ws) {
  for (const m of ws["!merges"] || []) {
    const origen = ws[XLSX.utils.encode_cell(m.s)];
    if (!origen) continue;
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
      if (r === m.s.r && c === m.s.c) continue;
      ws[XLSX.utils.encode_cell({ r, c })] = { ...origen };
    }
  }
}

function leerCuadro(ruta) {
  const wb = XLSX.readFile(ruta);
  const filas = [];
  const faltan = [];
  for (const [nombre, def] of Object.entries(COLUMNAS)) {
    const ws = wb.Sheets[nombre];
    if (!ws) { faltan.push(nombre); continue; }
    completarCombinadas(ws);
    // Desde la primera fila del rango, sea cual sea (antecedentes empieza en A2).
    const rango = XLSX.utils.decode_range(ws["!ref"]);
    const datos = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, range: { s: { r: 0, c: 0 }, e: rango.e } });
    datos.slice(def.desde).forEach((fila, i) => {
      const d = {};
      def.claves.forEach((k, col) => {
        if (!k) return;
        const v = String(fila[col] ?? "").replace(/\r\n/g, "\n").trim();
        if (vacio(v)) return;
        d[k] = d[k] ? d[k] + " // " + v : v;
      });
      if (!CLAVES_QUE_CUENTAN.some(k => d[k])) return;
      filas.push({ hoja: def.hoja, orden: i, datos: d });
    });
  }
  return { filas, faltan };
}

async function main() {
  const args = process.argv.slice(2);
  const ruta = args.find(a => !a.startsWith("--"));
  const confirmar = args.includes("--confirmar");
  if (!ruta) throw new Error("Falta la ruta de la planilla");

  const lib = await import("../lib/cuadroIyV.js");
  const { datosFilaIyV, ORDEN_HOJAS_IYV } = lib;
  const { filas: leidas, faltan } = leerCuadro(ruta);
  // Mismo filtro que el sistema: solo claves de la hoja, N° normalizados.
  // Las observaciones van al historial por N° de expediente.
  const observaciones = [];
  const vistas = new Set();
  const filas = leidas.map(f => {
    const id = randomUUID();
    const conExp = { ...f.datos, ...datosFilaIyV(f.hoja, f.datos) };
    for (const o of observacionesDeFila(lib, { id, hoja: f.hoja }, conExp)) {
      if (vistas.has(o.clave + "\n" + o.texto)) continue;
      vistas.add(o.clave + "\n" + o.texto);
      observaciones.push({ ...o, usuario: USUARIO });
    }
    return { id, hoja: f.hoja, orden: f.orden, datos: datosFilaIyV(f.hoja, f.datos) };
  });

  const prisma = new PrismaClient();
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log("Base:", url.hostname + url.pathname);
    if (faltan.length) console.log("No están estas hojas (no se cargan):", faltan.join(", "));
    for (const h of ORDEN_HOJAS_IYV) console.log("  " + h + ": " + filas.filter(f => f.hoja === h).length + " filas");
    console.log("  observaciones: " + observaciones.length);
    const antes = await prisma.filaCuadroIyV.count();
    const movAntes = await prisma.movimientoCuadroIyV.count();
    const obsAntes = await prisma.observacionIyV.count().catch(() => 0);
    console.log("En la base ahora: " + antes + " filas, " + movAntes + " registros de historial y " + obsAntes + " observaciones (se borran todos)");
    if (!confirmar) {
      console.log("\nEjemplo (primera fila de cada hoja):");
      for (const h of ORDEN_HOJAS_IYV) console.log(" ", h, JSON.stringify(filas.find(f => f.hoja === h)?.datos).slice(0, 300));
      console.log("\nNo se cambió nada. Para cargar, agregá --confirmar.");
      return;
    }
    await prisma.$transaction([
      prisma.observacionIyV.deleteMany({}),
      prisma.movimientoCuadroIyV.deleteMany({}),
      prisma.filaCuadroIyV.deleteMany({}),
      prisma.filaCuadroIyV.createMany({ data: filas }),
      prisma.observacionIyV.createMany({ data: observaciones }),
    ]);
    console.log("Listo: " + (await prisma.filaCuadroIyV.count()) + " filas cargadas.");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { leerCuadro };
