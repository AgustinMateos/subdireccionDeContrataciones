import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compararOrdenesCompra, datosOrdenCompra, soloCamposDeJefaOrdenesCompra } from "@/lib/ordenesCompra";
import { INCLUDE_ORDEN_COMPRA, conPlanObras, hoy, registrosDeCambiosOrdenCompra, sesionOrdenesCompra } from "@/lib/ordenesCompraServidor";

// Órdenes de compra del departamento (sistema aparte).
export async function GET() {
  if (!(await sesionOrdenesCompra())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const ordenes = await conPlanObras(prisma, await prisma.ordenCompra.findMany({ include: INCLUDE_ORDEN_COMPRA }));
  return NextResponse.json({ expedientes: ordenes.sort(compararOrdenesCompra) });
}

// Alta (el ingreso a OC es hoy si no viene). Estado, pasos, agente y
// observaciones cargados quedan como primeros registros del historial.
export async function POST(request) {
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const datos = soloCamposDeJefaOrdenesCompra(datosOrdenCompra(await request.json()), session.user.email);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  datos.ingresoOC = datos.ingresoOC || hoy();
  const cambios = registrosDeCambiosOrdenCompra(null, datos, session.user.name);
  const orden = await prisma.ordenCompra.create({
    data: { ...datos, movimientos: cambios.length ? { create: cambios } : undefined },
    include: INCLUDE_ORDEN_COMPRA,
  });
  return NextResponse.json({ expediente: await conPlanObras(prisma, orden) });
}
