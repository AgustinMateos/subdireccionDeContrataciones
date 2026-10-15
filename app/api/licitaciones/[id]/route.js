import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_JEFA_SUBDIRECCION } from "@/lib/resoluciones";
import { CAMPOS_DE_LICITACIONES, datosLicitacion, sinCamposDeLicitaciones, soloCamposDeJefaLicitaciones } from "@/lib/licitaciones";
import { INCLUDE_LICITACION, conPlanObras, registrosDeCambiosLicitacion, sesionLicitaciones } from "@/lib/licitacionesServidor";

// Edición. Si no es la jefa, agente y prioridad quedan como estaban; la
// jefa solo cambia agente, prioridad, último movimiento y observaciones.
export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await sesionLicitaciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const existente = await prisma.expedienteLicitacion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const email = session.user.email;
  const datos = sinCamposDeLicitaciones(soloCamposDeJefaLicitaciones(datosLicitacion(await request.json()), email), email);
  if (("exp" in datos && !datos.exp) || ("objeto" in datos && !datos.objeto)) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  const cambios = registrosDeCambiosLicitacion(existente, datos, session.user.name);
  const expediente = await prisma.expedienteLicitacion.update({
    where: { id },
    data: { ...datos, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_LICITACION,
  });
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente) });
}

// Cambio rápido desde la tabla: `{ sector }`, `{ estadoInterno }` o
// `{ estadoConvocatoria }` (el departamento; queda en el historial);
// `{ agente }` o `{ prioritario }` solo la jefa de la Subdirección.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const session = await sesionLicitaciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json();
  const esJefa = session.user.email === EMAIL_JEFA_SUBDIRECCION;
  if (esJefa && CAMPOS_DE_LICITACIONES.some(k => k in body)) {
    return NextResponse.json({ error: "Sector y estados los modifica Licitaciones" }, { status: 403 });
  }
  if (("agente" in body || "prioritario" in body) && !esJefa) {
    return NextResponse.json({ error: "Solo la jefa de la Subdirección puede cambiar la asignación o la prioridad" }, { status: 403 });
  }
  const existente = await prisma.expedienteLicitacion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const data = {};
  for (const k of [...CAMPOS_DE_LICITACIONES, "agente"]) {
    if (k in body) data[k] = String(body[k] || "").trim() || null;
  }
  if ("prioritario" in body) data.prioritario = body.prioritario === true;
  const cambios = registrosDeCambiosLicitacion(existente, data, session.user.name);
  const expediente = await prisma.expedienteLicitacion.update({
    where: { id },
    data: { ...data, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_LICITACION,
  });
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await sesionLicitaciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { count } = await prisma.expedienteLicitacion.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
