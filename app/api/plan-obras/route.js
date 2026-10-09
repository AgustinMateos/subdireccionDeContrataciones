import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ANIO_PLAN_OBRAS, datosObra } from "@/lib/planObras";
import { sesionJefa } from "@/lib/planObrasServidor";

// El Plan de Obras es solo de la jefa de la Subdirección.

export async function GET() {
  if (!(await sesionJefa())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const obras = await prisma.obraPlan.findMany({ where: { anio: ANIO_PLAN_OBRAS }, orderBy: [{ orden: "asc" }, { creadoEn: "asc" }] });
  return NextResponse.json({ obras });
}

// Alta: va al final de la planilla.
export async function POST(request) {
  if (!(await sesionJefa())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const datos = datosObra(await request.json());
  if (!datos.camara || !datos.objeto) return NextResponse.json({ error: "Completá cámara y objeto" }, { status: 400 });
  const ultima = await prisma.obraPlan.aggregate({ where: { anio: ANIO_PLAN_OBRAS }, _max: { orden: true } });
  const obra = await prisma.obraPlan.create({ data: { ...datos, anio: ANIO_PLAN_OBRAS, orden: (ultima._max.orden || 0) + 1 } });
  return NextResponse.json({ obra });
}
