import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_JEFA_SUBDIRECCION } from "@/lib/resoluciones";
import { datosNotificacion44, soloCamposDeJefaOrdenesCompra } from "@/lib/ordenesCompra";
import { sesionOrdenesCompra } from "@/lib/ordenesCompraServidor";

// Edición. El departamento cambia todo menos agente y prioridad; la jefa
// solo esos dos.
export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!(await prisma.notificacionArt44.findUnique({ where: { id } }))) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  let datos = soloCamposDeJefaOrdenesCompra(datosNotificacion44(await request.json()), session.user.email);
  if (session.user.email === EMAIL_JEFA_SUBDIRECCION) datos = { agente: datos.agente, prioritario: datos.prioritario };
  else if (!datos.exp) return NextResponse.json({ error: "Completá el N° de expediente" }, { status: 400 });
  return NextResponse.json({ expediente: await prisma.notificacionArt44.update({ where: { id }, data: datos }) });
}

// Cambio rápido desde la tabla: `{ agente }` o `{ prioritario }`, solo la jefa.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.email !== EMAIL_JEFA_SUBDIRECCION) {
    return NextResponse.json({ error: "Solo la jefa de la Subdirección puede cambiar la asignación o la prioridad" }, { status: 403 });
  }
  const body = await request.json();
  const data = {};
  if ("agente" in body) data.agente = String(body.agente || "").trim() || null;
  if ("prioritario" in body) data.prioritario = body.prioritario === true;
  const { count } = await prisma.notificacionArt44.updateMany({ where: { id }, data });
  if (count === 0) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ expediente: await prisma.notificacionArt44.findUnique({ where: { id } }) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await sesionOrdenesCompra())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { count } = await prisma.notificacionArt44.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
