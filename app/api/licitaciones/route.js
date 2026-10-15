import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compararLicitaciones, datosLicitacion, soloCamposDeJefaLicitaciones } from "@/lib/licitaciones";
import { INCLUDE_LICITACION, conAgentePorJurisdiccion, conPlanObras, registrosDeCambiosLicitacion, sesionLicitaciones } from "@/lib/licitacionesServidor";

// Expedientes del departamento de Licitaciones (sistema aparte).
export async function GET() {
  if (!(await sesionLicitaciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const expedientes = await conPlanObras(prisma, await prisma.expedienteLicitacion.findMany({ include: INCLUDE_LICITACION }));
  return NextResponse.json({ expedientes: expedientes.sort(compararLicitaciones) });
}

// Alta. Sin agente elegido, va el que atiende la jurisdicción. Sector,
// estados y agente cargados quedan como primeros registros del historial.
export async function POST(request) {
  const session = await sesionLicitaciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const datos = conAgentePorJurisdiccion(soloCamposDeJefaLicitaciones(datosLicitacion(await request.json()), session.user.email));
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  const cambios = registrosDeCambiosLicitacion(null, datos, session.user.name);
  const expediente = await prisma.expedienteLicitacion.create({
    data: { ...datos, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_LICITACION,
  });
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente) });
}
