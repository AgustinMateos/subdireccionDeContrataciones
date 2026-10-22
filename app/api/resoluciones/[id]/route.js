import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CAMPOS_DE_RESOLUCIONES, EMAIL_JEFA_SUBDIRECCION, datosResolucion, faltaDelDictamen, sinCamposDeResoluciones, soloCamposDeJefa } from "@/lib/resoluciones";
import { INCLUDE_RESOLUCION, avisarSiActivaRenovacion, avisarSiEsJefa, marcarAsignado, conPlanObras, conPrestamo, conReingreso, conUltimoMovPorSector, registrosDeCambios, sesionResoluciones } from "@/lib/resolucionesServidor";

// Edición. Los cambios de sector actual, tipo de resolución, estado y
// estado general quedan en el historial; el último movimiento pasa a ser
// hoy si cambia el sector o si un finalizado vuelve a otro estado general
// (o lo que se cargue a mano).
export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const existente = await prisma.expedienteResolucion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Si no es la jefa, la asignación y la prioridad quedan como estaban.
  // La jefa no cambia tipo de resolución, estado, sector actual ni los
  // datos del expediente (solo agente y prioridad).
  // Si cambia el sector, el último movimiento pasa a ser hoy. La fecha de
  // ingreso al sector queda como se cargó (de ahí corre el semáforo), salvo
  // en un reingreso: un finalizado que vuelve a trámite, donde `reingreso`
  // dice si reingresó o fue un error de clic (ver conReingreso).
  const body = await request.json();
  const { fechaIngreso, ...editables } = sinCamposDeResoluciones(soloCamposDeJefa(datosResolucion(body), session.user.email), session.user.email);
  const datos = conPrestamo(existente, conUltimoMovPorSector(existente, await conReingreso(prisma, existente, editables, body.reingreso)));
  if (("exp" in datos && !datos.exp) || ("objeto" in datos && !datos.objeto)) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  if (faltaDelDictamen(datos)) return NextResponse.json({ error: faltaDelDictamen(datos) }, { status: 400 });
  const cambios = registrosDeCambios(existente, datos, session.user.name);
  const expediente = await prisma.expedienteResolucion.update({
    where: { id },
    data: { ...datos, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_RESOLUCION,
  });
  await avisarSiEsJefa(prisma, session, existente, datos, expediente);
  await avisarSiActivaRenovacion(prisma, session, existente, expediente);
  await marcarAsignado(prisma, expediente);
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente) });
}

// Cambio rápido desde la tabla: `{ sectorActual }`, `{ tipoResolucion }`
// o `{ estado }` (cualquier usuario de Resoluciones, queda en el
// historial); `{ situacion }` (estado general: Resoluciones y la jefa);
// `{ agente }` o `{ prioritario }` solo la jefa de la Subdirección.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json();
  if (session.user.email === EMAIL_JEFA_SUBDIRECCION && CAMPOS_DE_RESOLUCIONES.some(k => k in body)) {
    return NextResponse.json({ error: "Tipo de resolución, estado y sector actual los modifica Resoluciones" }, { status: 403 });
  }
  if (("agente" in body || "prioritario" in body) && session.user.email !== EMAIL_JEFA_SUBDIRECCION) {
    return NextResponse.json({ error: "Solo la jefa de la Subdirección puede cambiar la asignación o la prioridad" }, { status: 403 });
  }
  const existente = await prisma.expedienteResolucion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  let data = {};
  for (const k of ["sectorActual", "tipoResolucion", "estado", "agente"]) {
    if (k in body) data[k] = String(body[k] || "").trim() || null;
  }
  if ("prioritario" in body) data.prioritario = body.prioritario === true;
  if ("situacion" in body) data.situacion = datosResolucion({ situacion: body.situacion }).situacion;
  data = conUltimoMovPorSector(existente, await conReingreso(prisma, existente, data, body.reingreso));
  const cambios = registrosDeCambios(existente, data, session.user.name);
  const expediente = await prisma.expedienteResolucion.update({
    where: { id },
    data: { ...data, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_RESOLUCION,
  });
  await avisarSiEsJefa(prisma, session, existente, data, expediente);
  await marcarAsignado(prisma, expediente);
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { count } = await prisma.expedienteResolucion.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
