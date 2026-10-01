import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INCLUDE_MESA, datosExpedienteMesa, datosMovimientoMesa } from "@/lib/mesaEntradas";
import { conDatosDelSector } from "@/lib/mesaEntradasServidor";

async function buscar(id, session) {
  const exp = await prisma.expedienteMesa.findUnique({ where: { id } });
  return exp && exp.departamentoId === session.user.departamentoId ? exp : null;
}

// Dos usos: `{ movimiento }` registra una entrada/salida; si no, edita los
// datos de la carátula.
export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user.rol !== "admin" && session.user.rol !== "operador")) {
    return NextResponse.json({ error: "No tenés permiso para modificar expedientes" }, { status: 403 });
  }
  if (!(await buscar(id, session))) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await request.json();

  if (body.movimiento) {
    const mov = datosMovimientoMesa(body.movimiento, session.user.name);
    if (!mov.sector || !mov.fecha) {
      return NextResponse.json({ error: "Completá la fecha y el sector" }, { status: 400 });
    }
    const expediente = await prisma.expedienteMesa.update({
      where: { id },
      data: { movimientos: { create: [mov] } },
      include: INCLUDE_MESA,
    });
    return NextResponse.json({ expediente: (await conDatosDelSector([expediente]))[0] });
  }

  const datos = datosExpedienteMesa(body);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  try {
    const expediente = await prisma.expedienteMesa.update({
      where: { id },
      data: datos,
      include: INCLUDE_MESA,
    });
    return NextResponse.json({ expediente: (await conDatosDelSector([expediente]))[0] });
  } catch (e) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya hay un expediente " + datos.exp + " registrado en Mesa de Entradas" }, { status: 400 });
    }
    throw e;
  }
}

// Igual que en el resto: el jefe y Soporte pueden eliminar.
export async function DELETE(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user.rol !== "admin" && session.user.rol !== "soporte")) {
    return NextResponse.json({ error: "Solo el jefe o Soporte pueden eliminar expedientes" }, { status: 403 });
  }
  const { count } = await prisma.expedienteMesa.deleteMany({
    where: { id, departamentoId: session.user.departamentoId },
  });
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
