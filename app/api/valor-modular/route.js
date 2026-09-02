import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Devuelve el valor modular vigente (el registro más reciente). Cada modificación
// crea una fila nueva, así queda el histórico de valores aprobados por CAF.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const vigente = await prisma.valorModular.findFirst({
    orderBy: { vigenteDesde: "desc" },
  });

  return NextResponse.json({ valorModular: vigente });
}

export async function PUT(request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol !== "soporte") {
    return NextResponse.json({ error: "Solo Soporte puede modificar el valor modular" }, { status: 403 });
  }

  const body = await request.json();
  const valor = Number(body.valor);
  if (!valor || valor <= 0) {
    return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
  }

  const creado = await prisma.valorModular.create({
    data: { valor, actualizadoPor: session.user.name },
  });

  return NextResponse.json({ valorModular: creado });
}
