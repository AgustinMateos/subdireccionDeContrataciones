// Una sola vez por base: deja listo el sistema de Órdenes de Compra.
//  1. Crea sus tablas si no están (sin `db push`, para no tocar columnas
//     de otras ramas que la base pueda tener).
//  2. Crea el departamento "ordenes-compra" y su usuario
//     (admin.ordenes@pj.gob.ar) si no están.
//  3. Si se le pasa la planilla (.xlsx o .csv) y todavía no hay órdenes,
//     las carga desde la fila de encabezados (EXP, ..., PROVEEDOR, ...).
//     También la hoja de notificaciones del art. 44 ("NOT. AÑO 2026"),
//     si esa tabla está vacía.
// Se puede volver a correr sin duplicar nada.
//   node prisma/cargar-ordenes-compra.js [ruta/a/la/planilla.xlsx] ["OC AÑO 2026"]
// Sin nombre de hoja, toma la del año más reciente.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");
const { randomUUID } = require("crypto");

const prisma = new PrismaClient();

const COLUMNAS_TEXTO = [
  "exp", "numeroOC", "ampliacionOC", "prorrogaOC", "agente", "organismo", "objeto", "tipo", "plazoEjecucion",
  "inicioServicio", "autoriza", "numeroResol", "proveedor", "montoResolucion", "montoAjustado", "vtoArt44",
  "notificacion44", "cbu", "informe", "contabilidad", "controlada", "firmaSol", "notificada", "itemPendiente",
  "pase", "estado", "fechaPublicacion", "observaciones",
];
const COLUMNAS_FECHA = ["fechaResol", "ingresoOC", "vencimientoOC"];

const CREAR_TABLAS = [
  `CREATE TABLE IF NOT EXISTS "OrdenCompra" (
    "id" TEXT NOT NULL,
    ${COLUMNAS_TEXTO.map(c => `"${c}" TEXT${c === "exp" || c === "objeto" ? " NOT NULL" : ""},`).join("\n    ")}
    ${COLUMNAS_FECHA.map(c => `"${c}" TIMESTAMP(3),`).join("\n    ")}
    "prioritario" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "OrdenCompra_exp_idx" ON "OrdenCompra"("exp")`,
  `CREATE TABLE IF NOT EXISTS "MovimientoOrdenCompra" (
    "id" TEXT NOT NULL,
    "ordenId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "campo" TEXT NOT NULL,
    "anterior" TEXT,
    "valor" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoOrdenCompra_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MovimientoOrdenCompra_ordenId_fkey" FOREIGN KEY ("ordenId")
      REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "MovimientoOrdenCompra_ordenId_idx" ON "MovimientoOrdenCompra"("ordenId")`,
  `CREATE TABLE IF NOT EXISTS "NotificacionArt44" (
    "id" TEXT NOT NULL,
    "exp" TEXT NOT NULL,
    ${["agente", "tipoContratacion", "fechaResol", "objeto", "organismo", "tipoResol", "numeroResol", "estadoActual", "art44",
      "notificacion", "partidaEspecial", "estado", "ultimoMovimiento", "pase", "observaciones"].map(c => `"${c}" TEXT,`).join("\n    ")}
    "fechaIngreso" TIMESTAMP(3),
    "prioritario" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NotificacionArt44_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "NotificacionArt44_exp_idx" ON "NotificacionArt44"("exp")`,
];

const USUARIO_CARGA = "Planilla anterior";

const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const texto = v => (String(v ?? "").trim() || null);
const razonable = f => (f && !Number.isNaN(f.getTime()) && f.getUTCFullYear() >= 2000 && f.getUTCFullYear() <= 2100 ? f : null);
const ddmmaaaa = f => String(f.getUTCDate()).padStart(2, "0") + "/" + String(f.getUTCMonth() + 1).padStart(2, "0") + "/" + f.getUTCFullYear();

// Celda de fecha de Excel (con cellDates llega como Date, a la hora local
// de la máquina) → fecha pura a medianoche UTC.
function deCeldaFecha(d) {
  return razonable(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
}

// Texto "d/m/aa(aa)": lo tipean a mano, así que es día/mes salvo que el
// segundo número no pueda ser un mes. Lo que no se entiende: null.
function deTextoFecha(v) {
  const m = String(v ?? "").trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!m) return null;
  let [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3].length === 2 ? "20" + m[3] : m[3])];
  if (mes > 12 && d <= 12) [d, mes] = [mes, d];
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCDate() === d && f.getUTCMonth() === mes - 1 ? razonable(f) : null;
}

const aFecha = v => (v instanceof Date ? deCeldaFecha(v) : deTextoFecha(v));

// Una columna de texto puede traer una fecha de Excel: queda dd/mm/aaaa.
function aTexto(v) {
  if (v instanceof Date) { const f = deCeldaFecha(v); return f ? ddmmaaaa(f) : null; }
  return texto(v);
}

// Un monto que Excel guarda como número vuelve al formato de la planilla.
function aMonto(v) {
  if (typeof v === "number") return "$ " + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return texto(v)?.replace(/\s+/g, " ") || null;
}

// Errores de tipeo frecuentes en la planilla: "COMPLWTO", "XOMPLETO",
// "TECMICA", "TÉCNICA", "´MA"... Se cargan con la forma correcta para que
// cuenten bien (completas, pase a Técnica, carga por agente).
const soloLetras = t => norm(t).replace(/[^A-Z]/g, "");
function corregirEstado(t) {
  const l = soloLetras(t);
  return l.length >= 6 && l.length <= 10 && /^[CX]/.test(l) && /MP|PL/.test(l) ? "COMPLETO" : texto(t);
}
function corregirPase(t) {
  const l = soloLetras(t);
  return l.length >= 5 && l.length <= 9 && l.startsWith("T") && /CN|TEC|NIC/.test(l) ? "TECNICA" : texto(t);
}
const corregirAgente = t => texto(norm(t).replace(/[^A-Z/]/g, ""));
const corregirTipo = t => (/^(PROVISION|SERVICIO)$/.test(norm(t)) ? norm(t) : texto(t));

// Columna de cada campo según el encabezado de la planilla.
const COLUMNAS = {
  exp: c => c === "EXP",
  ampliacionOC: c => c.startsWith("AMPLIACION"),
  prorrogaOC: c => c.startsWith("PRORROGA"),
  agente: c => c === "AGENTE",
  fechaResol: c => c === "FECHA RESOL",
  ingresoOC: c => c.startsWith("INGRESO A OC"),
  vtoArt44: c => c.startsWith("VTO") && c.includes("44"),
  vencimientoOC: c => c.startsWith("VENCIMIENTO"),
  organismo: c => c === "ORGANISMO",
  objeto: c => c === "OBJETO",
  plazoEjecucion: c => c.startsWith("PLAZO"),
  tipo: c => /^P[OR]{2}V/.test(c) && c.includes("SERVICIO"),
  autoriza: c => c === "AG",
  numeroResol: c => c.includes("RESOL") && c.startsWith("N"),
  numeroOC: c => c === "OC",
  proveedor: c => c === "PROVEEDOR",
  montoResolucion: c => c.startsWith("MONTO"),
  montoAjustado: c => /^TO[LT]AL/.test(c),
  notificacion44: c => c.includes("44") && c.includes("NOTIF"),
  cbu: c => c === "CBU",
  informe: c => c === "INFORME",
  contabilidad: c => c === "CONTABILIDAD",
  controlada: c => c.includes("CONTROLADA"),
  firmaSol: c => c.includes("FIRMA"),
  notificada: c => c.includes("NOTIFICADA"),
  itemPendiente: c => c.startsWith("ITEM"),
  pase: c => c === "PASE",
  estado: c => c === "ESTADO",
  inicioServicio: c => c.startsWith("INICIO"),
  observaciones: c => c.startsWith("OBSERVACION"),
  fechaPublicacion: c => c.includes("PUBLICACION"),
};

// Hoja a cargar: la pedida, o la del año más reciente ("OC AÑO 2026");
// sin año en el nombre, la primera que tenga los encabezados.
function hojasEnOrden(libro, pedida) {
  if (pedida) {
    if (!libro.SheetNames.includes(pedida)) throw new Error("No hay una hoja \"" + pedida + "\". Hojas: " + libro.SheetNames.join(", "));
    return [pedida];
  }
  const anio = n => Number((n.match(/20\d\d/) || [0])[0]);
  return [...libro.SheetNames].sort((a, b) => anio(b) - anio(a));
}

function leerPlanilla(ruta, hoja) {
  const libro = XLSX.readFile(ruta, { cellDates: true });
  for (const nombre of hojasEnOrden(libro, hoja)) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, raw: true, defval: "" });
    const iEnc = filas.findIndex(f => norm(f[0]) === "EXP" && f.some(c => norm(c) === "PROVEEDOR"));
    if (iEnc < 0) continue;
    const enc = filas[iEnc].map(norm);
    const col = Object.fromEntries(Object.entries(COLUMNAS).map(([k, es]) => [k, enc.findIndex(es)]));
    const faltan = Object.entries(col).filter(([, i]) => i < 0).map(([k]) => k);
    if (faltan.length) console.log("Columnas que no encontré (quedan vacías): " + faltan.join(", "));
    const v = (fila, k) => (col[k] >= 0 ? fila[col[k]] : "");
    const ilegibles = [];
    const ordenes = filas.slice(iEnc + 1)
      .filter(f => texto(v(f, "exp")) || texto(v(f, "objeto")) || texto(v(f, "proveedor")))
      .map((f, n) => {
        const o = {};
        for (const k of COLUMNAS_TEXTO) o[k] = aTexto(v(f, k));
        for (const k of ["montoResolucion", "montoAjustado"]) o[k] = aMonto(v(f, k));
        o.numeroOC = typeof v(f, "numeroOC") === "number" ? String(v(f, "numeroOC")) : o.numeroOC;
        o.exp = o.exp?.replace(/\s+/g, " ") || "(sin N°)";
        o.objeto = o.objeto || "(sin objeto)";
        o.agente = corregirAgente(o.agente);
        o.estado = corregirEstado(o.estado);
        o.pase = corregirPase(o.pase);
        o.tipo = corregirTipo(o.tipo);
        // Fechas que no se entienden ("sacar hasta 19/1/26") no se pierden:
        // van a las observaciones.
        const notas = [];
        for (const k of COLUMNAS_FECHA) {
          const crudo = v(f, k);
          o[k] = aFecha(crudo);
          if (!o[k] && texto(crudo)) {
            notas.push({ fechaResol: "Fecha resol.", ingresoOC: "Ingreso a OC", vencimientoOC: "Vencimiento OC" }[k] + ": " + aTexto(crudo));
            ilegibles.push((o.numeroOC ? "OC " + o.numeroOC : "fila " + (iEnc + n + 2)) + " (" + k + ": " + aTexto(crudo) + ")");
          }
        }
        if (notas.length) o.observaciones = [o.observaciones, ...notas].filter(Boolean).join(" · ");
        return o;
      });
    return { ordenes, ilegibles, hoja: nombre };
  }
  throw new Error("No encontré la fila de encabezados (EXP, ..., PROVEEDOR, ...) en " + ruta);
}

// Hoja de los expedientes que solo llevan la notificación del art. 44
// ("NOT. AÑO 2026"): la del año más reciente cuyo nombre diga NOT.
const COLUMNAS_NOTIFICACION = {
  exp: c => c === "EXP",
  agente: c => c === "AGENTE",
  tipoContratacion: c => c.startsWith("TIPO CONTRATACION"),
  fechaResol: c => c.startsWith("FECHA RESOL"),
  fechaIngreso: c => c.startsWith("FECHA INGRESO"),
  objeto: c => c === "OBJETO",
  organismo: c => c === "ORGANISMO",
  tipoResol: c => c.startsWith("TIPO RESOL"),
  numeroResol: c => c.startsWith("N") && c.includes("RESOL"),
  estadoActual: c => c === "ESTADO ACTUAL",
  art44: c => c === "44",
  notificacion: c => c === "NOTIFICACION",
  partidaEspecial: c => c.includes("PARTIDA"),
  estado: c => c === "ESTADO",
  ultimoMovimiento: c => c.startsWith("ULTIMO MOV"),
  pase: c => c === "PASE",
};

function leerNotificaciones(ruta) {
  const libro = XLSX.readFile(ruta, { cellDates: true });
  const anio = n => Number((n.match(/20\d\d/) || [0])[0]);
  const hoja = libro.SheetNames.filter(n => /NOT/i.test(n)).sort((a, b) => anio(b) - anio(a))[0];
  if (!hoja) return null;
  const filas = XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, raw: true, defval: "" });
  const iEnc = filas.findIndex(f => norm(f[0]) === "EXP" && f.some(c => norm(c).startsWith("TIPO RESOL")));
  if (iEnc < 0) return null;
  const enc = filas[iEnc].map(norm);
  const col = Object.fromEntries(Object.entries(COLUMNAS_NOTIFICACION).map(([k, es]) => [k, enc.findIndex(es)]));
  const v = (fila, k) => (col[k] >= 0 ? fila[col[k]] : "");
  // Después de PASE la hoja tiene una columna sin título con el destino
  // ("LICITACIONES 13/05/26"): va junto al pase.
  const iDestino = col.pase >= 0 && !enc[col.pase + 1] ? col.pase + 1 : -1;
  const notificaciones = filas.slice(iEnc + 1)
    .filter(f => f.slice(0, enc.length).some(c => texto(aTexto(c))))
    .map(f => {
      const n = {};
      for (const k of Object.keys(COLUMNAS_NOTIFICACION)) n[k] = aTexto(v(f, k));
      n.agente = corregirAgente(n.agente);
      const crudo = v(f, "fechaIngreso");
      n.fechaIngreso = aFecha(crudo);
      if (!n.fechaIngreso && texto(crudo)) n.observaciones = "Fecha ingreso: " + aTexto(crudo);
      const destino = iDestino >= 0 ? aTexto(f[iDestino]) : null;
      if (destino) n.pase = [n.pase, destino].filter(Boolean).join(" → ");
      n.exp = n.exp?.replace(/\s+/g, " ") || "(sin N°)";
      return n;
    });
  return { hoja, notificaciones };
}

async function main() {
  for (const sql of CREAR_TABLAS) await prisma.$executeRawUnsafe(sql);
  console.log("Tablas de Órdenes de Compra: listas");

  const depto = await prisma.departamento.upsert({
    where: { slug: "ordenes-compra" },
    update: {},
    create: { nombre: "Órdenes de Compra", slug: "ordenes-compra" },
  });
  await prisma.usuario.upsert({
    where: { email: "admin.ordenes@pj.gob.ar" },
    update: {},
    create: {
      nombre: "Jefe de Departamento de Órdenes de Compra",
      email: "admin.ordenes@pj.gob.ar",
      passwordHash: await bcrypt.hash("admin123", 10),
      rol: "admin",
      departamentoId: depto.id,
    },
  });
  console.log("Departamento y usuario de Órdenes de Compra: listos");

  const ruta = process.argv[2];
  if (!ruta) { console.log("Sin planilla: no se cargaron órdenes."); return; }

  if (await prisma.notificacionArt44.count()) {
    console.log("Ya había notificaciones del art. 44: no se cargaron.");
  } else {
    const leidas = leerNotificaciones(ruta);
    if (!leidas) console.log("No encontré la hoja de notificaciones del art. 44.");
    else {
      await prisma.notificacionArt44.createMany({ data: leidas.notificaciones.map(n => ({ id: randomUUID(), ...n, actualizadoEn: new Date() })) });
      console.log("Notificaciones del art. 44 cargadas (hoja " + leidas.hoja + "): " + leidas.notificaciones.length);
      const sinFecha = leidas.notificaciones.filter(n => !n.fechaIngreso).map(n => n.exp);
      if (sinFecha.length) console.log("Sin fecha de ingreso legible (" + sinFecha.length + "): " + sinFecha.join(", "));
    }
  }

  if (await prisma.ordenCompra.count()) {
    console.log("Ya había órdenes de compra: no se cargó la planilla.");
    return;
  }
  const { ordenes, ilegibles, hoja } = leerPlanilla(ruta, process.argv[3]);
  console.log("Hoja: " + hoja);
  // Todo o nada y en dos tandas (una consulta por fila es muy lento contra
  // Neon): las órdenes y, con sus ids, las observaciones como historial.
  const conId = ordenes.map(o => ({ id: randomUUID(), ...o, actualizadoEn: new Date() }));
  await prisma.$transaction([
    prisma.ordenCompra.createMany({ data: conId }),
    prisma.movimientoOrdenCompra.createMany({
      data: conId.filter(o => o.observaciones).map(o => ({
        id: randomUUID(), ordenId: o.id, fecha: o.ingresoOC || new Date(), campo: "Observaciones", valor: o.observaciones, usuario: USUARIO_CARGA,
      })),
    }),
  ]);
  console.log("Órdenes de compra cargadas: " + ordenes.length);
  if (ilegibles.length) console.log("Fechas que no se entendieron (quedaron en observaciones): " + ilegibles.join("; "));
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
