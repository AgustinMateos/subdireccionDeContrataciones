import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compararResoluciones, datosResolucion, soloCamposDeJefa } from "@/lib/resoluciones";
import { INCLUDE_RESOLUCION, aplicarRenovaciones, avisarSiEsJefa, conPlanObras, registrosDeCambios, sesionResoluciones } from "@/lib/resolucionesServidor";

// Expedientes del sector de Resoluciones (sistema aparte). Antes se
// aplican las renovaciones automáticas de vencimiento de ofertas.
export async function GET() {
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await aplicarRenovaciones(prisma);
  const expedientes = await conPlanObras(prisma, await prisma.expedienteResolucion.findMany({ include: INCLUDE_RESOLUCION }));
  return NextResponse.json({ expedientes: expedientes.sort(compararResoluciones) });
}

// Alta. Sector actual, tipo de resolución y estado cargados quedan como
// primeros registros del historial.
export async function POST(request) {
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const datos = soloCamposDeJefa(datosResolucion(await request.json()), session.user.email);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  const cambios = registrosDeCambios(null, datos, session.user.name);
  const expediente = await prisma.expedienteResolucion.create({
    data: { ...datos, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_RESOLUCION,
  });
  await avisarSiEsJefa(prisma, session, null, datos, expediente);
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente) });
}
