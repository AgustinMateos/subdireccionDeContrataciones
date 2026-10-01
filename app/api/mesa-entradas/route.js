import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INCLUDE_MESA, SECTORES_TRAMITA, datosExpedienteMesa, datosMovimientoMesa } from "@/lib/mesaEntradas";

// Expedientes registrados por Mesa de Entradas (solo los del departamento
// del usuario).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const expedientes = await prisma.expedienteMesa.findMany({
    where: { departamentoId: session.user.departamentoId },
    include: INCLUDE_MESA,
    orderBy: { creadoEn: "desc" },
  });
  return NextResponse.json({ expedientes });
}

// Caratular: alta del expediente con su primer movimiento (el ingreso).
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.rol !== "admin" && session.user.rol !== "operador")) {
    return NextResponse.json({ error: "No tenés permiso para caratular" }, { status: 403 });
  }

  const body = await request.json();
  const datos = datosExpedienteMesa(body);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  if (!SECTORES_TRAMITA.includes(datos.sectorTramita)) {
    return NextResponse.json({ error: "Elegí el sector que tramita" }, { status: 400 });
  }
  const ingreso = datosMovimientoMesa(body.ingreso || {}, session.user.name);
  if (!ingreso.sector || !ingreso.fecha) {
    return NextResponse.json({ error: "Completá la fecha de ingreso y el sector" }, { status: 400 });
  }

  try {
    const expediente = await prisma.expedienteMesa.create({
      data: {
        ...datos,
        departamentoId: session.user.departamentoId,
        movimientos: { create: [ingreso] },
      },
      include: INCLUDE_MESA,
    });
    return NextResponse.json({ expediente });
  } catch (e) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya hay un expediente " + datos.exp + " registrado en Mesa de Entradas" }, { status: 400 });
    }
    throw e;
  }
}
