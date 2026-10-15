// Sistema del Departamento de Órdenes de Compra (aparte del resto, como
// Resoluciones y Licitaciones). Se puede importar desde el cliente.
// Cada registro es una orden de compra: un expediente con varios
// proveedores tiene una por proveedor (así está en su planilla).

import { HOY } from "./constants";
import { EMAIL_JEFA_SUBDIRECCION, fechaISO } from "./resoluciones";
import { esFechaISO } from "./diasHabiles";

export const SLUG_ORDENES_COMPRA = "ordenes-compra";

export const AGENTES_ORDENES_COMPRA = ["SM", "MA", "JB", "ASK"];
// Quiénes controlan las OC (y firman cuando no está Sol). Se puede cargar
// otro nombre.
export const CONTROLADORES_ORDENES_COMPRA = ["CAROLINA", "DEVORA", "MARIANA", "MARINA", "MARISA", "MARU", "MELINA", "SABRINA", "VANESA"];
export const TIPOS_ORDEN_COMPRA = ["PROVISION", "SERVICIO"];
export const ESTADOS_ORDEN_COMPRA = ["EN TRAMITE", "COMPLETO"];
export const PASES_ORDEN_COMPRA = ["TECNICA", "LICITACIONES", "CONTABILIDAD", "SUBDIRECCION"];

// Días antes del vencimiento de la OC en que se avisa.
export const DIAS_AVISO_VENCIMIENTO_OC = 5;

// Circuito de la orden de compra, en orden: cada paso es una columna de la
// planilla y está hecho cuando tiene algo cargado.
export const PASOS_ORDEN_COMPRA = [
  { campo: "ingresoOC", etiqueta: "Ingreso a OC" },
  { campo: "notificacion44", etiqueta: "Notif. art. 44" },
  { campo: "contabilidad", etiqueta: "Contabilidad" },
  { campo: "controlada", etiqueta: "Controlada" },
  { campo: "firmaSol", etiqueta: "A la firma" },
  { campo: "notificada", etiqueta: "OC notificada" },
  { campo: "pase", etiqueta: "Pase" },
];

// "O/C controlada por y fecha" y "A la firma de Sol" son texto libre en la
// planilla ("14/01/2026 x Meli", "16/03/26 MELI X AUSENCIA DE SOL", "22/04
// CARO"): la fecha que tenga ("aaaa-mm-dd", o null; sin año, la de
// `anio`) y el resto, que es quién.
export function fechaYQuien(valor, anio = new Date().getFullYear()) {
  const t = String(valor ?? "").trim();
  const m = t.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?(?![\d/-])/);
  const a = !m ? null : !m[3] ? String(anio) : m[3].length === 2 ? "20" + m[3] : m[3];
  const iso = m && a + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  if (!m || !esFechaISO(iso)) return { fecha: null, quien: t };
  const quien = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length))
    .replace(/\s+/g, " ").trim()
    .replace(/^(X|A|POR)\s+/i, "").replace(/\s+(X|Y|-)$/i, "").replace(/^-\s*|\s*-$/g, "").trim();
  return { fecha: iso, quien };
}

// Lo inverso: "dd/mm/aaaa QUIÉN".
export function textoFechaYQuien(fecha, quien) {
  const dma = fecha ? fecha.slice(8, 10) + "/" + fecha.slice(5, 7) + "/" + fecha.slice(0, 4) : "";
  return [dma, String(quien || "").trim()].filter(Boolean).join(" ");
}

function texto(valor) {
  const t = String(valor ?? "").trim();
  return t || null;
}

function fecha(valor) {
  if (!valor) return null;
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? null : f;
}

// Datos editables de una orden de compra, tal como llegan del formulario.
export function datosOrdenCompra(body) {
  return {
    exp: String(body.exp || "").trim(),
    numeroOC: texto(body.numeroOC),
    ampliacionOC: texto(body.ampliacionOC),
    prorrogaOC: texto(body.prorrogaOC),
    agente: texto(body.agente),
    organismo: texto(body.organismo),
    objeto: String(body.objeto || "").trim(),
    tipo: texto(body.tipo),
    plazoEjecucion: texto(body.plazoEjecucion),
    inicioServicio: texto(body.inicioServicio),
    autoriza: texto(body.autoriza),
    numeroResol: texto(body.numeroResol),
    fechaResol: fecha(body.fechaResol),
    proveedor: texto(body.proveedor),
    montoResolucion: texto(body.montoResolucion),
    montoAjustado: texto(body.montoAjustado),
    ingresoOC: fecha(body.ingresoOC),
    vtoArt44: texto(body.vtoArt44),
    vencimientoOC: fecha(body.vencimientoOC),
    notificacion44: texto(body.notificacion44),
    cbu: texto(body.cbu),
    informe: texto(body.informe),
    contabilidad: texto(body.contabilidad),
    controlada: texto(body.controlada),
    firmaSol: texto(body.firmaSol),
    notificada: texto(body.notificada),
    itemPendiente: texto(body.itemPendiente),
    pase: texto(body.pase),
    estado: texto(body.estado),
    fechaPublicacion: texto(body.fechaPublicacion),
    observaciones: texto(body.observaciones),
    prioritario: body.prioritario === true,
  };
}

// Agente y prioridad solo los decide la jefa de la Subdirección: para el
// departamento se descartan del pedido.
export function soloCamposDeJefaOrdenesCompra(datos, email) {
  if (email === EMAIL_JEFA_SUBDIRECCION) return datos;
  const { agente, prioritario, ...resto } = datos;
  return resto;
}

// Al editar, la jefa solo cambia agente y prioridad (y puede dejar una
// observación): todo lo demás es trabajo del departamento.
const CAMPOS_DE_LA_JEFA = ["agente", "prioritario", "observaciones"];

export function sinCamposDeOrdenesCompra(datos, email) {
  if (email !== EMAIL_JEFA_SUBDIRECCION) return datos;
  return Object.fromEntries(Object.entries(datos).filter(([k]) => CAMPOS_DE_LA_JEFA.includes(k)));
}

// Terminada: estado COMPLETO / COMPLETA (en la planilla también aparece
// "CMPLETO").
export function esCompleta(e) {
  return /^C\w*M?PLET/i.test(String(e.estado || "").trim());
}

// CBU cargado: la planilla lo anota a mano ("OK", "SI", "SE CARGO CBU",
// la fecha en que se cargó...). Pendiente: vacío, "NO" o pedido ("PEDIR",
// "PEDIDO 9/2/26", "SE PIDIO").
export function cbuCargado(e) {
  const t = String(e.cbu || "").trim().toUpperCase();
  return !!t && t !== "NO" && !/PEDI/.test(t);
}

// Prioritaria: la marca la jefa, o el expediente está en su Plan de Obras
// (`enPlanObras`, lo agrega el servidor).
export function esPrioritariaOC(e) {
  return !!e.prioritario || !!e.enPlanObras;
}

// Pasos del circuito hechos (0 a PASOS_ORDEN_COMPRA.length) y el último.
export function avanceOC(e) {
  let hechos = 0;
  PASOS_ORDEN_COMPRA.forEach((p, i) => { if (texto(e[p.campo] instanceof Date ? "x" : e[p.campo])) hechos = i + 1; });
  if (esCompleta(e)) hechos = PASOS_ORDEN_COMPRA.length;
  return { hechos, etapa: esCompleta(e) ? "Completa" : hechos ? PASOS_ORDEN_COMPRA[hechos - 1].etiqueta : "Sin ingreso" };
}

// Etapa para agrupar: el paso que sigue (lo que se está esperando).
export function etapaOC(e) {
  if (esCompleta(e)) return "Completa";
  const { hechos } = avanceOC(e);
  return hechos >= PASOS_ORDEN_COMPRA.length ? "Para cerrar" : "Esperando: " + PASOS_ORDEN_COMPRA[hechos].etiqueta.toLowerCase();
}

export const ETAPAS_ORDEN_COMPRA = [
  ...PASOS_ORDEN_COMPRA.map(p => "Esperando: " + p.etiqueta.toLowerCase()), "Para cerrar", "Completa",
];

const dias = f => Math.round((HOY - new Date(f + "T00:00:00")) / 86400000);

// Días desde que ingresó a Órdenes de Compra. Una completa no cuenta.
export function diasEnOC(e) {
  if (esCompleta(e)) return null;
  const f = fechaISO(e.ingresoOC);
  return f ? dias(f) : null;
}

// Días que faltan para el vencimiento de la OC (negativo: vencida). Sin
// fecha o completa: null.
export function diasParaVencerOC(e) {
  if (esCompleta(e)) return null;
  const f = fechaISO(e.vencimientoOC);
  return f ? -dias(f) : null;
}

export function porVencerOC(e) {
  const d = diasParaVencerOC(e);
  return d != null && d <= DIAS_AVISO_VENCIMIENTO_OC;
}

// Orden de la planilla: las completas al final; primero las prioritarias;
// después por vencimiento de la OC (la más próxima primero, sin fecha al
// final) y por número de OC.
export function compararOrdenesCompra(a, b) {
  if (esCompleta(a) !== esCompleta(b)) return esCompleta(a) ? 1 : -1;
  if (esPrioritariaOC(a) !== esPrioritariaOC(b)) return esPrioritariaOC(a) ? -1 : 1;
  const va = a.vencimientoOC && !esCompleta(a) ? new Date(a.vencimientoOC).getTime() : Infinity;
  const vb = b.vencimientoOC && !esCompleta(b) ? new Date(b.vencimientoOC).getTime() : Infinity;
  if (va !== vb) return va - vb;
  return (Number(b.numeroOC) || 0) - (Number(a.numeroOC) || 0);
}

// Número para una OC nueva: el que sigue a la última cargada.
export function siguienteNumeroOC(ordenes) {
  return String(Math.max(0, ...ordenes.map(e => Number(e.numeroOC) || 0)) + 1);
}

// De la última OC a la primera, sin importar estado ni prioridad.
export function compararPorNumeroOC(a, b) {
  return (Number(b.numeroOC) || 0) - (Number(a.numeroOC) || 0);
}

// ---- Notificaciones del art. 44 (expedientes que no llevan OC) ----

// Columnas en el orden de la hoja "NOT. AÑO 2026", sin "Tiene partida
// especial" ni "Último movimiento" (no se usan; lo cargado queda en la base).
export const CAMPOS_NOTIFICACION_44 = [
  ["exp", "Exp."], ["agente", "Agente"], ["tipoContratacion", "Tipo contratación"], ["fechaResol", "Fecha resol."],
  ["fechaIngreso", "Fecha ingreso"], ["objeto", "Objeto"], ["organismo", "Organismo"], ["tipoResol", "Tipo resol."],
  ["numeroResol", "N° resol."], ["estadoActual", "Estado actual"], ["art44", "44"], ["notificacion", "Notificación"],
  ["estado", "Estado"], ["pase", "Pase"],
];

export function datosNotificacion44(body) {
  const datos = {};
  for (const [k] of CAMPOS_NOTIFICACION_44) datos[k] = k === "fechaIngreso" ? fecha(body[k]) : texto(body[k]);
  datos.exp = String(body.exp || "").trim();
  datos.observaciones = texto(body.observaciones);
  datos.prioritario = body.prioritario === true;
  return datos;
}

// Notificada: tiene cargada la fecha del art. 44 (o la de notificación).
export function estaNotificada44(n) {
  return !!(texto(n.art44) || texto(n.notificacion));
}

// Días desde que ingresó, mientras no esté notificada.
export function diasSinNotificar44(n) {
  if (estaNotificada44(n)) return null;
  const f = fechaISO(n.fechaIngreso);
  return f ? dias(f) : null;
}

// Primero las pendientes (la más antigua arriba), después las notificadas
// (la más reciente arriba).
export function compararNotificaciones44(a, b) {
  if (estaNotificada44(a) !== estaNotificada44(b)) return estaNotificada44(a) ? 1 : -1;
  const fa = a.fechaIngreso ? new Date(a.fechaIngreso).getTime() : 0;
  const fb = b.fechaIngreso ? new Date(b.fechaIngreso).getTime() : 0;
  return estaNotificada44(a) ? fb - fa : fa - fb;
}
