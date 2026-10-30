import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compararResoluciones, datosResolucion, faltaDelDictamen, faltaDelEscrito, soloCamposDeJefa } from "@/lib/resoluciones";
import { INCLUDE_RESOLUCION, anotarEscritoEnExpediente, conConstanciaDeEscrito, aplicarRenovaciones, avisarDictamenesVencidos, avisarJefaParaAsignar, avisarSiActivaRenovacion, avisarSiEsJefa, conPlanObras, conPrestamo, hoy, registrosDeCambios, sesionResoluciones } from "@/lib/resolucionesServidor";

// Expedientes del sector de Resoluciones (sistema aparte). Antes se
// aplican las renovaciones automáticas de vencimiento de ofertas y se
// avisan los dictámenes que vencen.
export async function GET() {
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await aplicarRenovaciones(prisma);
  await avisarDictamenesVencidos(prisma);
  const expedientes = await conPlanObras(prisma, await prisma.expedienteResolucion.findMany({ include: INCLUDE_RESOLUCION }));
  return NextResponse.json({ expedientes: expedientes.sort(compararResoluciones) });
}

// Alta. Sector actual, tipo de resolución y estado cargados quedan como
// primeros registros del historial. Si es un escrito, `anotados`: los
// registros de su expediente que sumaron la observación.
export async function POST(request) {
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  // El último movimiento de un expediente nuevo es el día en que se crea.
  const datos = await conPrestamo(prisma, null, { ...soloCamposDeJefa(datosResolucion(await request.json()), session.user.email), fechaUltimoMov: hoy() });
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  if (faltaDelDictamen(datos)) return NextResponse.json({ error: faltaDelDictamen(datos) }, { status: 400 });
  if (faltaDelEscrito(datos)) return NextResponse.json({ error: faltaDelEscrito(datos) }, { status: 400 });
  // Un escrito deja constancia en sus observaciones y en las de su expediente.
  const conConstancia = conConstanciaDeEscrito(datos);
  const cambios = registrosDeCambios(null, conConstancia, session.user.name);
  const expediente = await prisma.expedienteResolucion.create({
    data: { ...conConstancia, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_RESOLUCION,
  });
  await avisarSiEsJefa(prisma, session, null, datos, expediente);
  await avisarSiActivaRenovacion(prisma, session, null, expediente);
  await avisarJefaParaAsignar(prisma, session, expediente);
  const anotados = await anotarEscritoEnExpediente(prisma, expediente, session.user.name);
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente), anotados: await conPlanObras(prisma, anotados) });
}
