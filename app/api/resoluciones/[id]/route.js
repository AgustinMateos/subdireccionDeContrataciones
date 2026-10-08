import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_JEFA_SUBDIRECCION, datosResolucion, soloCamposDeJefa } from "@/lib/resoluciones";
import { INCLUDE_RESOLUCION, sesionResoluciones } from "@/lib/resolucionesServidor";

// Edición. Si cambia el sector actual (o la fecha del último movimiento),
// queda un movimiento nuevo en el historial.
export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const existente = await prisma.expedienteResolucion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Si no es la jefa, la asignación y la prioridad quedan como estaban.
  const datos = soloCamposDeJefa(datosResolucion(await request.json()), session.user.email);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  const cambioSector = (datos.sectorActual || null) !== (existente.sectorActual || null);
  const cambioFecha = (datos.fechaUltimoMov?.getTime() ?? null) !== (existente.fechaUltimoMov?.getTime() ?? null);
  if (cambioSector && datos.sectorActual && !datos.fechaUltimoMov) datos.fechaUltimoMov = new Date();

  const expediente = await prisma.expedienteResolucion.update({
    where: { id },
    data: {
      ...datos,
      movimientos: datos.sectorActual && (cambioSector || cambioFecha)
        ? {
          create: [{
            fecha: datos.fechaUltimoMov,
            sectorAnterior: cambioSector ? existente.sectorActual : null,
            sector: datos.sectorActual,
            usuario: session.user.name,
          }],
        }
        : undefined,
    },
    include: INCLUDE_RESOLUCION,
  });
  return NextResponse.json({ expediente });
}

// Cambio rápido desde la tabla, solo de la jefa de la Subdirección:
// `{ agente }` (asignación) y/o `{ prioritario }`.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const session = await sesionResoluciones();
  if (session?.user.email !== EMAIL_JEFA_SUBDIRECCION) {
    return NextResponse.json({ error: "Solo la jefa de la Subdirección puede cambiar la asignación o la prioridad" }, { status: 403 });
  }
  const body = await request.json();
  const data = {};
  if ("agente" in body) data.agente = String(body.agente || "").trim() || null;
  if ("prioritario" in body) data.prioritario = body.prioritario === true;
  try {
    const expediente = await prisma.expedienteResolucion.update({ where: { id }, data, include: INCLUDE_RESOLUCION });
    return NextResponse.json({ expediente });
  } catch (e) {
    if (e.code === "P2025") return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    throw e;
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { count } = await prisma.expedienteResolucion.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
