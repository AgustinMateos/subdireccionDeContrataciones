import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_JEFA_SUBDIRECCION } from "@/lib/resoluciones";
import { datosOrdenCompra, sinCamposDeOrdenesCompra, soloCamposDeJefaOrdenesCompra } from "@/lib/ordenesCompra";
import { INCLUDE_ORDEN_COMPRA, conPlanObras, registrosDeCambiosOrdenCompra, sesionOrdenesCompra } from "@/lib/ordenesCompraServidor";

// Edición. Si no es la jefa, agente y prioridad quedan como estaban; la
// jefa solo cambia agente, prioridad y observaciones.
export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const existente = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const email = session.user.email;
  const datos = sinCamposDeOrdenesCompra(soloCamposDeJefaOrdenesCompra(datosOrdenCompra(await request.json()), email), email);
  if (("exp" in datos && !datos.exp) || ("objeto" in datos && !datos.objeto)) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  const cambios = registrosDeCambiosOrdenCompra(existente, datos, session.user.name);
  const orden = await prisma.ordenCompra.update({
    where: { id },
    data: { ...datos, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_ORDEN_COMPRA,
  });
  return NextResponse.json({ expediente: await conPlanObras(prisma, orden) });
}

// Cambio rápido desde la tabla: `{ estado }` o `{ pase }` (el
// departamento; queda en el historial); `{ agente }` o `{ prioritario }`
// solo la jefa de la Subdirección.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json();
  const esJefa = session.user.email === EMAIL_JEFA_SUBDIRECCION;
  if (esJefa && ("estado" in body || "pase" in body)) {
    return NextResponse.json({ error: "Estado y pase los modifica Órdenes de Compra" }, { status: 403 });
  }
  if (("agente" in body || "prioritario" in body) && !esJefa) {
    return NextResponse.json({ error: "Solo la jefa de la Subdirección puede cambiar la asignación o la prioridad" }, { status: 403 });
  }
  const existente = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const data = {};
  for (const k of ["estado", "pase", "agente"]) {
    if (k in body) data[k] = String(body[k] || "").trim() || null;
  }
  if ("prioritario" in body) data.prioritario = body.prioritario === true;
  const cambios = registrosDeCambiosOrdenCompra(existente, data, session.user.name);
  const orden = await prisma.ordenCompra.update({
    where: { id },
    data: { ...data, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_ORDEN_COMPRA,
  });
  return NextResponse.json({ expediente: await conPlanObras(prisma, orden) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await sesionOrdenesCompra())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { count } = await prisma.ordenCompra.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
