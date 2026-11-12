import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOJAS_IYV, datosFilaIyV } from "@/lib/cuadroIyV";
import { INCLUDE_FILA_IYV, puedeEditar, registrosDeCambiosIyV, sesionCuadroIyV } from "@/lib/cuadroIyVServidor";

// Todas las filas del cuadro (las cuatro solapas), en el orden de la planilla.
export async function GET() {
  if (!(await sesionCuadroIyV())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const filas = await prisma.filaCuadroIyV.findMany({ include: INCLUDE_FILA_IYV, orderBy: [{ hoja: "asc" }, { orden: "asc" }, { creadoEn: "asc" }] });
  return NextResponse.json({ filas });
}

// Alta de una fila al final de su solapa.
export async function POST(request) {
  const session = await sesionCuadroIyV();
  if (!session || !puedeEditar(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await request.json();
  const hoja = body.hoja;
  if (!HOJAS_IYV[hoja]) return NextResponse.json({ error: "Solapa desconocida" }, { status: 400 });
  const datos = datosFilaIyV(hoja, body.datos);
  if (!datos.objeto && !datos.exp) return NextResponse.json({ error: "Completá al menos el objeto o el N° de expediente" }, { status: 400 });
  const ultima = await prisma.filaCuadroIyV.findFirst({ where: { hoja }, orderBy: { orden: "desc" }, select: { orden: true } });
  const fila = await prisma.filaCuadroIyV.create({
    data: { hoja, orden: (ultima?.orden ?? -1) + 1, datos, movimientos: { create: registrosDeCambiosIyV(hoja, null, datos, session.user.name) } },
    include: INCLUDE_FILA_IYV,
  });
  return NextResponse.json({ fila });
}
