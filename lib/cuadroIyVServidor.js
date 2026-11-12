// Solo servidor: acceso y cambios del Cuadro de Informática y Varios.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { EMAIL_JEFA_SUBDIRECCION } from "./resoluciones";
import { SLUG_IYV, etiquetaCampoIyV, puedeEditarIyV, puedeEliminarIyV, campoIyV, fechaDeTexto } from "./cuadroIyV";

export const INCLUDE_FILA_IYV = { movimientos: { orderBy: { fecha: "asc" } } };

// La sesión si es de Informática y Varios o de la jefa de la Subdirección
// (ella solo consulta); si no, null.
export async function sesionCuadroIyV() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session.user.departamentoSlug === SLUG_IYV || session.user.email === EMAIL_JEFA_SUBDIRECCION ? session : null;
}
export const puedeEditar = session => puedeEditarIyV(session?.user);
export const puedeEliminar = session => puedeEliminarIyV(session?.user);

// Un registro por cada campo que cambia entre `anterior` y `nuevos` (los
// datos completos de la fila). En un alta (anterior null), uno solo.
export function registrosDeCambiosIyV(hoja, anterior, nuevos, usuario) {
  if (!anterior) return [{ campo: "Alta", valor: "Fila cargada", usuario }];
  const claves = [...new Set([...Object.keys(anterior), ...Object.keys(nuevos)])];
  return claves
    .filter(k => (anterior[k] || "") !== (nuevos[k] || ""))
    .map(k => ({ campo: etiquetaCampoIyV(hoja, k), anterior: anterior[k] || null, valor: nuevos[k] || "(vacío)", usuario }));
}

// ---------- Últimos movimientos desde Resoluciones ----------
// Para cada N° de expediente del cuadro (vigente, continuidad, renovación;
// en Provisiones, el exp.), si en Resoluciones tiene un movimiento más
// nuevo que el del cuadro (o el cuadro no tiene), se completan el último
// movimiento y el sector con los de Resoluciones. Lo que no es una fecha
// (un texto cargado a mano) no se pisa. Devuelve las filas que cambiaron.
export const USUARIO_SINCRONIZACION_IYV = "Resoluciones (automático)";
const BLOQUES_MOV = [["exp", "ultimoMov", "sector"], ["cExp", "cUltimoMov", "cSector"], ["rExp", "rUltimoMov", "rSector"]];
const numerosExp = t => String(t || "").match(/\d{2}-\d{4,6}\/\d{4}/g) || [];
const ddmmaaaa = f => f.toISOString().slice(0, 10).split("-").reverse().join("/");

export async function sincronizarConResoluciones(prisma) {
  const [filas, resoluciones] = await Promise.all([
    prisma.filaCuadroIyV.findMany(),
    prisma.expedienteResolucion.findMany({ where: { fechaUltimoMov: { not: null } }, select: { exp: true, fechaUltimoMov: true, sectorActual: true } }),
  ]);
  // El movimiento más nuevo de cada N° en Resoluciones.
  const ultimo = new Map();
  for (const r of resoluciones) for (const n of numerosExp(r.exp)) {
    const actual = ultimo.get(n);
    if (!actual || r.fechaUltimoMov > actual.fechaUltimoMov) ultimo.set(n, r);
  }
  const cambios = [];
  for (const fila of filas) {
    const hoja = fila.hoja;
    const d = fila.datos || {};
    const nuevos = { ...d };
    for (const [kExp, kMov, kSector] of BLOQUES_MOV) {
      if (!d[kExp] || !campoIyV(hoja, kMov)) continue;
      const r = numerosExp(d[kExp]).map(n => ultimo.get(n)).filter(Boolean).sort((a, b) => b.fechaUltimoMov - a.fechaUltimoMov)[0];
      if (!r) continue;
      const enCuadro = fechaDeTexto(d[kMov]);
      if (String(d[kMov] || "").trim() && !enCuadro) continue; // texto a mano: no se pisa
      if (enCuadro && enCuadro >= r.fechaUltimoMov.toISOString().slice(0, 10)) continue;
      nuevos[kMov] = ddmmaaaa(r.fechaUltimoMov);
      if (r.sectorActual && campoIyV(hoja, kSector)) nuevos[kSector] = r.sectorActual;
    }
    const registros = registrosDeCambiosIyV(hoja, d, nuevos, USUARIO_SINCRONIZACION_IYV);
    if (registros.length) cambios.push({ id: fila.id, datos: nuevos, registros });
  }
  if (!cambios.length) return [];
  return prisma.$transaction(cambios.map(c => prisma.filaCuadroIyV.update({
    where: { id: c.id },
    data: { datos: c.datos, movimientos: { create: c.registros } },
    include: INCLUDE_FILA_IYV,
  })), { timeout: 60000 });
}
