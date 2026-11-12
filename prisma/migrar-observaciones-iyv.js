// Pasa las observaciones del Cuadro de Informática y Varios que todavía
// están como campo de la fila (como vinieron de la planilla) al historial
// de observaciones por N° de expediente (ObservacionIyV), y las saca de la
// fila. Sin --confirmar solo muestra qué haría. Se puede correr más de una
// vez: lo ya pasado no está más en las filas.
//   node --experimental-detect-module prisma/migrar-observaciones-iyv.js [--confirmar]

const { PrismaClient } = require("@prisma/client");

const USUARIO = "Planilla anterior";

// Las observaciones (como campo) de una fila: [{ clave, texto }], sin
// repetir la misma clave y texto.
function observacionesDeFila(lib, fila, datos) {
  const vistas = new Set();
  const salida = [];
  for (const campo of lib.camposObsIyV(fila.hoja)) {
    const texto = String(datos[campo.k] || "").trim();
    if (!texto) continue;
    const clave = lib.claveObsIyV(datos, fila.id, campo);
    if (vistas.has(clave + "\n" + texto)) continue;
    vistas.add(clave + "\n" + texto);
    salida.push({ clave, texto });
  }
  return salida;
}

async function main() {
  const confirmar = process.argv.includes("--confirmar");
  const lib = await import("../lib/cuadroIyV.js");
  const prisma = new PrismaClient();
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log("Base:", url.hostname + url.pathname);
    const filas = await prisma.filaCuadroIyV.findMany();
    const yaHay = new Set((await prisma.observacionIyV.findMany({ select: { clave: true, texto: true } })).map(o => o.clave + "\n" + o.texto));
    const nuevas = [];
    const cambios = [];
    for (const f of filas) {
      const obs = observacionesDeFila(lib, f, f.datos || {});
      const campos = lib.camposObsIyV(f.hoja).map(c => c.k).filter(k => k in (f.datos || {}));
      if (!campos.length) continue;
      for (const o of obs) if (!yaHay.has(o.clave + "\n" + o.texto)) { yaHay.add(o.clave + "\n" + o.texto); nuevas.push(o); }
      const datos = { ...f.datos };
      campos.forEach(k => delete datos[k]);
      cambios.push({ id: f.id, datos });
    }
    console.log(cambios.length + " filas con observaciones como campo → " + nuevas.length + " observaciones al historial");
    if (!confirmar) { console.log("No se cambió nada. Para hacerlo, agregá --confirmar."); return; }
    await prisma.$transaction([
      prisma.observacionIyV.createMany({ data: nuevas.map(o => ({ ...o, usuario: USUARIO })) }),
      ...cambios.map(c => prisma.filaCuadroIyV.update({ where: { id: c.id }, data: { datos: c.datos } })),
    ], { timeout: 120000 });
    console.log("Listo.");
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) main().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { observacionesDeFila, USUARIO };
