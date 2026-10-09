import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { datosObra } from "@/lib/planObras";
import { sesionJefa } from "@/lib/planObrasServidor";

export async function PUT(request, { params }) {
  const { id } = await params;
  if (!(await sesionJefa())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const datos = datosObra(await request.json());
  if (!datos.camara || !datos.objeto) return NextResponse.json({ error: "Completá cámara y objeto" }, { status: 400 });
  const { count } = await prisma.obraPlan.updateMany({ where: { id }, data: datos });
  if (count === 0) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ obra: await prisma.obraPlan.findUnique({ where: { id } }) });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  if (!(await sesionJefa())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { count } = await prisma.obraPlan.deleteMany({ where: { id } });
  if (count === 0) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
