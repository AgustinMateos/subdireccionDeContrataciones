import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compararResoluciones, datosResolucion, soloCamposDeJefa } from "@/lib/resoluciones";
import { INCLUDE_RESOLUCION, sesionResoluciones } from "@/lib/resolucionesServidor";

// Expedientes del sector de Resoluciones (sistema aparte).
export async function GET() {
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const expedientes = await prisma.expedienteResolucion.findMany({ include: INCLUDE_RESOLUCION });
  return NextResponse.json({ expedientes: expedientes.sort(compararResoluciones) });
}

// Alta. Si se carga el sector actual, queda como primer movimiento.
export async function POST(request) {
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const datos = soloCamposDeJefa(datosResolucion(await request.json()), session.user.email);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  if (datos.sectorActual && !datos.fechaUltimoMov) datos.fechaUltimoMov = datos.fechaIngreso || new Date();
  const expediente = await prisma.expedienteResolucion.create({
    data: {
      ...datos,
      movimientos: datos.sectorActual
        ? { create: [{ fecha: datos.fechaUltimoMov, sector: datos.sectorActual, usuario: session.user.name }] }
        : undefined,
    },
    include: INCLUDE_RESOLUCION,
  });
  return NextResponse.json({ expediente });
}
