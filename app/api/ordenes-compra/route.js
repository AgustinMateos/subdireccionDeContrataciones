import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compararOrdenesCompra, datosOrdenCompra, datosProveedorOC, soloCamposDeJefaOrdenesCompra } from "@/lib/ordenesCompra";
import { INCLUDE_ORDEN_COMPRA, conPlanObras, hoy, registrosDeCambiosOrdenCompra, sesionOrdenesCompra } from "@/lib/ordenesCompraServidor";

// Órdenes de compra del departamento (sistema aparte).
export async function GET() {
  if (!(await sesionOrdenesCompra())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const ordenes = await conPlanObras(prisma, await prisma.ordenCompra.findMany({ include: INCLUDE_ORDEN_COMPRA }));
  return NextResponse.json({ expedientes: ordenes.sort(compararOrdenesCompra) });
}

// Alta (el ingreso a OC es hoy si no viene). Estado, pasos, agente y
// observaciones cargados quedan como primeros registros del historial.
// Con `proveedores` se da de alta una OC por proveedor (cada una en su
// fila), todas con los mismos datos del expediente.
export async function POST(request) {
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json();
  const datos = soloCamposDeJefaOrdenesCompra(datosOrdenCompra(body), session.user.email);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  datos.ingresoOC = datos.ingresoOC || hoy();
  const filas = Array.isArray(body.proveedores) && body.proveedores.length
    ? body.proveedores.map(p => ({ ...datos, ...datosProveedorOC(p) }))
    : [datos];
  const numeros = filas.map(d => d.numeroOC).filter(Boolean);
  if (new Set(numeros).size !== numeros.length) {
    return NextResponse.json({ error: "Hay dos proveedores con el mismo N° de OC" }, { status: 400 });
  }
  const ordenes = await prisma.$transaction(filas.map(d => {
    const cambios = registrosDeCambiosOrdenCompra(null, d, session.user.name);
    return prisma.ordenCompra.create({
      data: { ...d, movimientos: cambios.length ? { create: cambios } : undefined },
      include: INCLUDE_ORDEN_COMPRA,
    });
  }));
  return NextResponse.json({ expedientes: await conPlanObras(prisma, ordenes) });
}
