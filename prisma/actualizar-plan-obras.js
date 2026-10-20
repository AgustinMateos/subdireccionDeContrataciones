// Pone el Plan de Obras 2026 de la base igual a la planilla actualizada
// (prisma/plan-obras-2026.json): actualiza las obras que ya estaban (por
// N° de expediente o, si no tienen, por cámara y objeto), agrega las nuevas
// y borra las que ya no figuran. El orden queda el de la planilla.
// Sin --aplicar solo muestra lo que haría.
//   node prisma/actualizar-plan-obras.js [--aplicar]

const { PrismaClient } = require("@prisma/client");
const obras = require("./plan-obras-2026.json");

const prisma = new PrismaClient();
const ANIO = 2026;
const APLICAR = process.argv.includes("--aplicar");

// "2026-09-29" → medianoche UTC, como las demás fechas puras.
const fecha = f => (f ? new Date(f + "T00:00:00.000Z") : null);
const clave = o => (o.expediente ? "exp:" + o.expediente.trim() : "obj:" + o.camara.trim() + "|" + o.objeto.trim());
const CAMPOS = ["orden", "expediente", "camara", "destino", "objeto", "monto", "encuadre", "estado", "fechaUltimoMov",
  "dependenciaActual", "ordenCompra", "fechaNotificacionOC", "plazoEjecucion", "observaciones"];
const valor = v => (v instanceof Date ? v.toISOString().slice(0, 10) : v ?? null);

async function main() {
  const actuales = await prisma.obraPlan.findMany({ where: { anio: ANIO } });
  const porClave = new Map(actuales.map(o => [clave(o), o]));
  const nuevas = obras.map(o => ({ ...o, fechaUltimoMov: fecha(o.fechaUltimoMov), fechaNotificacionOC: fecha(o.fechaNotificacionOC) }));
  const claves = new Set(nuevas.map(clave));

  const actualizar = [], agregar = [];
  for (const o of nuevas) {
    const antes = porClave.get(clave(o));
    if (!antes) { agregar.push(o); continue; }
    const cambios = CAMPOS.filter(k => valor(antes[k]) !== valor(o[k]));
    if (cambios.length) actualizar.push({ id: antes.id, o, cambios });
  }
  const borrar = actuales.filter(o => !claves.has(clave(o)));

  console.log("En la base: " + actuales.length + " obras. En la planilla: " + nuevas.length + ".");
  console.log("\nA actualizar (" + actualizar.length + "):");
  for (const { o, cambios } of actualizar) console.log("  " + (o.expediente || o.objeto) + ": " + cambios.join(", "));
  console.log("\nA agregar (" + agregar.length + "):");
  for (const o of agregar) console.log("  " + (o.expediente || "-") + " " + o.objeto);
  console.log("\nA borrar (" + borrar.length + "):");
  for (const o of borrar) console.log("  " + (o.expediente || "-") + " " + o.objeto);

  if (!APLICAR) { console.log("\nNo se cambió nada. Para aplicarlo: node prisma/actualizar-plan-obras.js --aplicar"); return; }
  await prisma.$transaction([
    ...actualizar.map(({ id, o }) => prisma.obraPlan.update({ where: { id }, data: o })),
    prisma.obraPlan.createMany({ data: agregar.map(o => ({ ...o, anio: ANIO })) }),
    prisma.obraPlan.deleteMany({ where: { id: { in: borrar.map(o => o.id) } } }),
  ]);
  console.log("\nListo: el Plan de Obras " + ANIO + " quedó igual a la planilla.");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
