import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { INCLUDE_RESOLUCION, conPlanObras, sesionResoluciones } from "@/lib/resolucionesServidor";

// Corregir una observación del historial (texto) o borrar cualquier
// registro del historial (null). Borrar un cambio automático (sector,
// estado...) solo lo saca del historial: el expediente queda como está.
// Si se toca una observación, la del expediente (la columna de la
// planilla) pasa a ser la última que quede.
async function cambiarMovimiento(params, texto) {
  const { id, movId } = await params;
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const mov = await prisma.movimientoResolucion.findFirst({ where: { id: movId, expedienteId: id } });
  if (!mov) return NextResponse.json({ error: "No se encontró el registro" }, { status: 404 });
  if (texto !== null && mov.campo !== "Observaciones") {
    return NextResponse.json({ error: "Solo se pueden corregir las observaciones" }, { status: 400 });
  }

  const expediente = await prisma.$transaction(async tx => {
    if (texto === null) await tx.movimientoResolucion.delete({ where: { id: movId } });
    else await tx.movimientoResolucion.update({ where: { id: movId }, data: { sector: texto } });
    let data = { actualizadoEn: new Date() };
    if (mov.campo === "Observaciones") {
      const ultima = await tx.movimientoResolucion.findFirst({
        where: { expedienteId: id, campo: "Observaciones" },
        orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
      });
      data.observaciones = ultima?.sector || null;
    }
    // Se actualiza siempre: así cambia la versión y los demás lo ven.
    return tx.expedienteResolucion.update({ where: { id }, data, include: INCLUDE_RESOLUCION });
  });
  return NextResponse.json({ expediente: await conPlanObras(prisma, expediente) });
}

export async function PATCH(request, { params }) {
  const body = await request.json().catch(() => ({}));
  const texto = String(body.texto || "").trim();
  if (!texto) return NextResponse.json({ error: "La observación no puede quedar vacía: para sacarla, eliminala" }, { status: 400 });
  return cambiarMovimiento(params, texto);
}

export async function DELETE(request, { params }) {
  return cambiarMovimiento(params, null);
}
