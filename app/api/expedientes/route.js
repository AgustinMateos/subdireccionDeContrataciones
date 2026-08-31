import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");
  const tipo = searchParams.get("tipo");
  const estadoGeneral = searchParams.get("estado");
  const organismo = searchParams.get("organismo");
  const q = searchParams.get("q");

  const where = {};
  if (area) where.area = area;
  if (tipo) where.tipo = tipo;
  if (estadoGeneral) where.estadoGeneral = estadoGeneral;
  if (organismo) where.organismo = organismo;
  if (q) {
    where.OR = [
      { exp: { contains: q, mode: "insensitive" } },
      { objeto: { contains: q, mode: "insensitive" } },
      { adjudicatario: { contains: q, mode: "insensitive" } },
      { organismo: { contains: q, mode: "insensitive" } },
    ];
  }

  const expedientes = await prisma.expediente.findMany({
    where,
    include: { observaciones: { orderBy: { fecha: "asc" } }, documentacion: { orderBy: { orden: "asc" } } },
    orderBy: { fechaVencimiento: "desc" },
  });

  return NextResponse.json({ expedientes });
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol === "lector") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const nuevo = await prisma.expediente.create({
    data: {
      cadenaId: body.cadenaId || "c" + Date.now(),
      rol: body.rol || "vigente",
      exp: body.exp,
      area: body.area,
      tipo: body.tipo,
      agente: body.agente,
      organismo: body.organismo,
      objeto: body.objeto,
      encuadre: body.encuadre || null,
      montoARS: Number(body.montoARS) || 0,
      montoUSD: Number(body.montoUSD) || 0,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaVencimiento: new Date(body.fechaVencimiento),
      ocResolucion: body.ocResolucion || null,
      adjudicatario: body.adjudicatario || null,
      sector: body.sector || null,
      etapa: body.etapa || null,
      estadoGeneral: body.estadoGeneral || "Vigente",
    },
  });

  return NextResponse.json({ expediente: nuevo }, { status: 201 });
}
