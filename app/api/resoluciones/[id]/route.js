import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { datosResolucion } from "@/lib/resoluciones";
import { INCLUDE_RESOLUCION, sesionResoluciones } from "@/lib/resolucionesServidor";

// Edición. Si cambia el sector actual (o la fecha del último movimiento),
// queda un movimiento nuevo en el historial.
export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const existente = await prisma.expedienteResolucion.findUnique({ where: { id } });
  if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const datos = datosResolucion(await request.json());
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

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await sesionResoluciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { count } = await prisma.expedienteResolucion.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
