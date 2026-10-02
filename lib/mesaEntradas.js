// Lógica compartida de Mesa de Entradas (API y pantallas): normaliza lo que
// llega del formulario y calcula el estado actual a partir de los
// movimientos.

import { HOY, TIPOS_SERVICIOS, TIPOS_INFORMATICA_Y_VARIOS } from "./constants";

// Sectores que tramitan, para la carátula (lista cerrada).
export const SECTORES_TRAMITA = [
  "SERVICIOS",
  "ORDENES DE COMPRA",
  "LICITACIONES",
  "SERV.ESPECIALES",
  "RESOLUCIONES",
  "APERTURAS",
  "LOCACIONES",
  "SERV.VARIOS",
  "SUBDIRECCION",
  "COMPRAS LP",
];

// Tipos según el sector que tramita. Los sectores que todavía no tienen su
// lista cargan el tipo como texto libre.
export const TIPOS_POR_SECTOR_TRAMITA = {
  SERVICIOS: TIPOS_SERVICIOS,
  "SERV.VARIOS": TIPOS_INFORMATICA_Y_VARIOS,
};

// Qué departamento del sistema confirma lo que Mesa caratula para cada
// sector: al confirmarlo se crea su propio expediente.
export const SECTOR_TRAMITA_POR_DEPARTAMENTO = {
  servicios: "SERVICIOS",
  "informatica-y-varios": "SERV.VARIOS",
};
const NOMBRE_DEPARTAMENTO = { servicios: "Servicios", "informatica-y-varios": "Informática y Varios" };

// Si el sector que tramita lo confirma un departamento del sistema:
// { departamento, confirmado, por, fecha }; si no, null.
export function confirmacionMesa(exp) {
  const slug = Object.keys(SECTOR_TRAMITA_POR_DEPARTAMENTO).find(d => SECTOR_TRAMITA_POR_DEPARTAMENTO[d] === exp.sectorTramita);
  if (!slug && !exp.confirmadoEn) return null;
  return {
    departamento: NOMBRE_DEPARTAMENTO[slug] || "el departamento",
    confirmado: !!exp.confirmadoEn,
    por: exp.confirmadoPor,
    fecha: exp.confirmadoEn,
  };
}

// Sectores sugeridos para "Sector que tramita", "Viene del sector", "Sector"
// y "Subsector" (los de la planilla de control). Es texto libre: la lista es
// una ayuda y se le suman los valores ya cargados.
export const SECTORES_MESA = [
  "AG",
  "CIJ",
  "Contabilidad",
  "DAF",
  "Despacho",
  "Licitaciones",
  "Locaciones",
  "Órdenes de Compra",
  "Otros Gastos",
  "SAJ",
  "Servicios",
  "Servicios Especiales",
  "Subdirección",
  "Técnica",
  "UAI",
];

export const INCLUDE_MESA = {
  movimientos: { orderBy: [{ creadoEn: "asc" }] },
};

function lista(valor) {
  if (Array.isArray(valor)) return [...new Set(valor.map((v) => String(v).trim()).filter(Boolean))];
  return valor ? [String(valor).trim()].filter(Boolean) : [];
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

// Datos del expediente (carátula) — sin los movimientos.
export function datosExpedienteMesa(body) {
  return {
    exp: String(body.exp || "").trim(),
    objeto: String(body.objeto || "").trim(),
    agente: texto(body.agente),
    sectorTramita: texto(body.sectorTramita),
    tipo: texto(body.tipo),
    tipoContratacion: texto(body.tipoContratacion),
    zona: texto(body.zona),
    fuero: lista(body.fuero),
    organismos: lista(body.organismos),
    domiciliosRenglones: lista(body.domiciliosRenglones),
    fechaInicio: fecha(body.fechaInicio),
    fechaVencimiento: fecha(body.fechaVencimiento),
    ingresoSubdireccion: fecha(body.ingresoSubdireccion),
    wd: texto(body.wd),
    r: texto(body.r),
  };
}

export function datosMovimientoMesa(mov, usuario) {
  return {
    fecha: fecha(mov.fecha),
    vieneDe: texto(mov.vieneDe),
    sector: String(mov.sector || "").trim(),
    subsector: texto(mov.subsector),
    observacion: texto(mov.observacion),
    usuario,
  };
}

// El último movimiento registrado es el que dice dónde está hoy el
// expediente, de dónde vino y desde cuándo.
export function ultimoMovimiento(exp) {
  const movs = exp.movimientos || [];
  return movs.length > 0 ? movs[movs.length - 1] : null;
}

// "2025-07-16T00:00:00.000Z" → "2025-07-16" (las fechas se guardan como
// medianoche UTC del día cargado).
export function fechaISO(f) {
  return f ? String(f).slice(0, 10) : "";
}

// Días desde la fecha de ingreso al sector actual (último movimiento), o
// null si ese movimiento no tiene fecha.
export function diasFrenadoMesa(exp) {
  const fecha = fechaISO(ultimoMovimiento(exp)?.fecha);
  if (!fecha) return null;
  return Math.round((HOY - new Date(fecha + "T00:00:00")) / 86400000);
}

// Hoy como "YYYY-MM-DD" según el navegador (valor por defecto de los
// inputs de fecha).
export function hoyLocalISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
