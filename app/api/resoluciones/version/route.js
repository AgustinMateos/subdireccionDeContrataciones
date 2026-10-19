import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionResoluciones } from "@/lib/resolucionesServidor";

// "Versión" de la planilla de Resoluciones: cuántos expedientes hay y
// cuándo cambió el último (y el Plan de Obras, que marca prioritarios). Es
// una consulta liviana: el panel la pide cada tanto y recarga la lista solo
// si cambió, así se ven los cambios de otros sin apretar F5.
export async function GET() {
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [exp, obras] = await Promise.all([
    prisma.expedienteResolucion.aggregate({ _count: true, _max: { actualizadoEn: true } }),
    prisma.obraPlan.aggregate({ _count: true, _max: { actualizadoEn: true } }),
  ]);
  const version = [exp._count, exp._max.actualizadoEn?.toISOString(), obras._count, obras._max.actualizadoEn?.toISOString()].join("|");
  return NextResponse.json({ version }, { headers: { "Cache-Control": "no-store" } });
}
