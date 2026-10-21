import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PREFIJO_REINGRESO, sesionResoluciones } from "@/lib/resolucionesServidor";

const DATOS_INGRESO = { id: true, exp: true, objeto: true, fuero: true, organismo: true, tipoContratacion: true, numero: true, tipoResolucion: true, agente: true };

// Informe del día: los movimientos del historial de Resoluciones de una
// fecha (`?fecha=AAAA-MM-DD`; sin fecha, hoy en Argentina), con su
// expediente (`alta`: se cargó ese mismo día), y los que ingresaron ese
// día (`ingresos`): los que se cargaron y los reingresos, con quién.
export async function GET(request) {
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const pedida = new URL(request.url).searchParams.get("fecha");
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(pedida || "") ? pedida : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  // La fecha del movimiento es fecha pura (medianoche UTC); el alta, un
  // instante real: el día de Argentina (UTC-3) va de las 03:00Z a las 03:00Z.
  const desde = new Date(dia + "T00:00:00.000Z");
  const hasta = new Date(desde.getTime() + 24 * 3600e3);
  const movimientos = await prisma.movimientoResolucion.findMany({
    where: { fecha: { gte: desde, lt: hasta } },
    orderBy: { creadoEn: "asc" },
    include: { expediente: { select: { id: true, exp: true, objeto: true, agente: true, creadoEn: true } } },
  });
  const inicioDia = desde.getTime() + 3 * 3600e3;
  const cargados = await prisma.expedienteResolucion.findMany({
    where: { creadoEn: { gte: new Date(inicioDia), lt: new Date(inicioDia + 24 * 3600e3) } },
    orderBy: { creadoEn: "asc" },
    select: { ...DATOS_INGRESO, creadoEn: true, movimientos: { orderBy: { creadoEn: "asc" }, take: 1, select: { usuario: true } } },
  });
  const reingresos = movimientos.filter(m => m.campo === "Observaciones" && m.sector.startsWith(PREFIJO_REINGRESO));
  const datosDe = await prisma.expedienteResolucion.findMany({ where: { id: { in: reingresos.map(m => m.expedienteId) } }, select: DATOS_INGRESO });
  const ingresos = [
    ...cargados.map(({ movimientos: [primero], creadoEn, ...e }) => ({ ...e, tipo: "alta", creadoEn, usuario: primero?.usuario || null })),
    ...reingresos.map(m => ({ ...datosDe.find(e => e.id === m.expedienteId), tipo: "reingreso", creadoEn: m.creadoEn, usuario: m.usuario, detalle: m.sector })),
  ].sort((a, b) => a.creadoEn - b.creadoEn);
  return NextResponse.json({
    fecha: dia,
    ingresos,
    movimientos: movimientos.map(({ expediente: e, ...m }) => ({
      ...m,
      expediente: { id: e.id, exp: e.exp, objeto: e.objeto, agente: e.agente, alta: e.creadoEn.getTime() >= inicioDia && e.creadoEn.getTime() < inicioDia + 24 * 3600e3 },
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
