import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compararNotificaciones44, datosNotificacion44, soloCamposDeJefaOrdenesCompra } from "@/lib/ordenesCompra";
import { sesionOrdenesCompra } from "@/lib/ordenesCompraServidor";

// Expedientes que Órdenes de Compra solo notifica por el art. 44.
export async function GET() {
  if (!(await sesionOrdenesCompra())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const notificaciones = await prisma.notificacionArt44.findMany();
  return NextResponse.json({ expedientes: notificaciones.sort(compararNotificaciones44) });
}

export async function POST(request) {
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const datos = soloCamposDeJefaOrdenesCompra(datosNotificacion44(await request.json()), session.user.email);
  if (!datos.exp) return NextResponse.json({ error: "Completá el N° de expediente" }, { status: 400 });
  return NextResponse.json({ expediente: await prisma.notificacionArt44.create({ data: datos }) });
}
