import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const expediente = await prisma.expediente.findUnique({
    where: { id: params.id },
    include: { observaciones: { orderBy: { fecha: "asc" } }, documentacion: { orderBy: { orden: "asc" } } },
  });
  if (!expediente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ expediente });
}

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol === "lector") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();

  // Agregar una observación o un movimiento de sector (mismo patrón que ya usabas en el cliente).
  if (body.nuevaObservacion) {
    const esMovimiento = body.tipo === "movimiento";
    const actualizado = await prisma.expediente.update({
      where: { id: params.id },
      data: {
        ...(esMovimiento ? { sector: body.sectorNuevo, etapa: "En " + body.sectorNuevo } : {}),
        observaciones: {
          create: {
            usuario: session.user.name,
            tipo: body.tipo || "general",
            texto: body.nuevaObservacion,
            sectorAnterior: esMovimiento ? body.sectorAnterior : null,
            sectorNuevo: esMovimiento ? body.sectorNuevo : null,
          },
        },
      },
      include: { observaciones: true, documentacion: true },
    });
    return NextResponse.json({ expediente: actualizado });
  }

  // Edición normal de campos del expediente.
  const actualizado = await prisma.expediente.update({
    where: { id: params.id },
    data: {
      exp: body.exp,
      area: body.area,
      tipo: body.tipo,
      agente: body.agente,
      organismo: body.organismo,
      objeto: body.objeto,
      encuadre: body.encuadre,
      montoARS: Number(body.montoARS) || 0,
      montoUSD: Number(body.montoUSD) || 0,
      fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
      estadoGeneral: body.estadoGeneral,
    },
  });

  return NextResponse.json({ expediente: actualizado });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.rol !== "admin" && session.user.rol !== "operador")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.expediente.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
