// Días hábiles del Poder Judicial y vencimientos de una resolución.
// Sirve en el cliente y en el servidor: los feriados se pasan como
// parámetro (los trae lib/feriados.js).
//
// Las fechas van como texto "aaaa-mm-dd" y se calculan en UTC, para que
// la zona horaria de la máquina no corra ningún día.

// Inhábiles propios del Poder Judicial ("mm-dd"): 24 y 31 de diciembre y
// 16 de noviembre (Día del Trabajador Judicial).
export const INHABILES_JUDICIALES = ["12-24", "12-31", "11-16"];

// Días hábiles para cada vencimiento.
export const DIAS_ART_44 = 3;
export const DIAS_OC = 10;

const aFecha = iso => new Date(iso + "T00:00:00.000Z");
const aISO = f => f.toISOString().slice(0, 10);

function diaSiguiente(iso) {
  const f = aFecha(iso);
  f.setUTCDate(f.getUTCDate() + 1);
  return aISO(f);
}

// Hábil: no es sábado ni domingo, ni feriado nacional (`feriados`: Set de
// "aaaa-mm-dd"), ni inhábil judicial.
export function esHabil(iso, feriados) {
  const dia = aFecha(iso).getUTCDay();
  if (dia === 0 || dia === 6) return false;
  if (feriados.has(iso)) return false;
  return !INHABILES_JUDICIALES.includes(iso.slice(5));
}

// El día en que se cumplen `dias` hábiles contados desde el día hábil
// siguiente a `iso` (ese día hábil es el primero).
export function sumarDiasHabiles(iso, dias, feriados) {
  let fecha = iso;
  for (let cuenta = 0; cuenta < dias;) {
    fecha = diaSiguiente(fecha);
    if (esHabil(fecha, feriados)) cuenta++;
  }
  return fecha;
}

// Años que puede tocar el cálculo desde esas fechas: el de cada una y el
// siguiente (13 días hábiles nunca llegan a cruzar dos años).
export function aniosDelCalculo(...fechas) {
  const anios = fechas.filter(Boolean).flatMap(f => [Number(f.slice(0, 4)), Number(f.slice(0, 4)) + 1]);
  return [...new Set(anios)].sort();
}

// "aaaa-mm-dd" de un día que existe (no 2026-02-30).
export function esFechaISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return false;
  const f = aFecha(iso);
  return !Number.isNaN(f.getTime()) && aISO(f) === iso;
}

// Art. 44: 3 días hábiles desde el hábil siguiente a la publicación. OC:
// 10 días hábiles desde el hábil siguiente al art. 44. Si el art. 44 ya
// se notificó (`fechaNotificacion44`, puede ser antes del vencimiento),
// los 10 días corren desde esa notificación, como en la planilla.
export function calcularVencimientos(fechaPublicacion, feriados, { fechaNotificacion44 } = {}) {
  if (!esFechaISO(fechaPublicacion)) throw new Error("Fecha de publicación inválida: " + fechaPublicacion);
  if (fechaNotificacion44 && !esFechaISO(fechaNotificacion44)) throw new Error("Fecha de notificación inválida: " + fechaNotificacion44);
  const fechaArt44 = sumarDiasHabiles(fechaPublicacion, DIAS_ART_44, feriados);
  const fechaLimiteOC = sumarDiasHabiles(fechaNotificacion44 || fechaArt44, DIAS_OC, feriados);
  return { fechaArt44, fechaLimiteOC };
}
