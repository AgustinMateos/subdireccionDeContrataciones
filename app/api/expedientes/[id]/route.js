import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE_EXPEDIENTE = {
  observaciones: { orderBy: { fecha: "asc" } },
  documentacion: { orderBy: { orden: "asc" } },
};

export async function GET(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const expediente = await prisma.expediente.findUnique({
    where: { id },
    include: INCLUDE_EXPEDIENTE,
  });
  if (!expediente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ expediente });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol === "lector") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();

  // ---------- Agregar una observación o un movimiento de sector ----------
  if (body.nuevaObservacion) {
    const esMovimiento = body.tipo === "movimiento";
    const actualizado = await prisma.expediente.update({
      where: { id },
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
      include: INCLUDE_EXPEDIENTE,
    });
    return NextResponse.json({ expediente: actualizado });
  }

  // ---------- Activar una renovación como nuevo vigente ----------
  // La renovación pasa a rol "vigente" y el vigente anterior de la misma cadena
  // se degrada a "antecedente" / "Finalizado". Lógica de negocio sobre dos registros.
  if (body.activarRenovacion) {
    const renovacion = await prisma.expediente.findUnique({ where: { id } });
    if (!renovacion) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const vigenteAnterior = await prisma.expediente.findFirst({
      where: { cadenaId: renovacion.cadenaId, rol: "vigente", NOT: { id: renovacion.id } },
    });

    const ops = [];
    if (vigenteAnterior) {
      ops.push(
        prisma.expediente.update({
          where: { id: vigenteAnterior.id },
          data: { rol: "antecedente", estadoGeneral: "Finalizado", etapa: "Finalizado" },
        })
      );
    }
    ops.push(
      prisma.expediente.update({
        where: { id },
        data: { rol: "vigente", estadoGeneral: "Vigente", etapa: "En ejecución" },
      })
    );
    await prisma.$transaction(ops);

    const actualizado = await prisma.expediente.findUnique({
      where: { id },
      include: INCLUDE_EXPEDIENTE,
    });
    return NextResponse.json({ expediente: actualizado });
  }

  // ---------- Toggle de un ítem de la checklist de documentación ----------
  // El cliente identifica el ítem por su índice en la lista que muestra. Si el
  // expediente todavía no tiene ítems persistidos, se crean todos a partir de
  // `items` (la checklist completa) con el índice tocado en el estado pedido.
  if (body.toggleDoc) {
    const { indice, cargado, items } = body.toggleDoc;
    const existentes = await prisma.documentacionItem.findMany({
      where: { expedienteId: id },
      orderBy: { orden: "asc" },
    });

    if (existentes.length === 0 && Array.isArray(items) && items.length > 0) {
      await prisma.documentacionItem.createMany({
        data: items.map((item, i) => ({
          expedienteId: id,
          item,
          orden: i,
          cargado: i === indice ? cargado : false,
        })),
      });
    } else if (existentes[indice]) {
      await prisma.documentacionItem.update({
        where: { id: existentes[indice].id },
        data: { cargado },
      });
    }

    const actualizado = await prisma.expediente.findUnique({
      where: { id },
      include: INCLUDE_EXPEDIENTE,
    });
    return NextResponse.json({ expediente: actualizado });
  }

  // ---------- Edición normal de campos del expediente ----------
  const actualizado = await prisma.expediente.update({
    where: { id },
    data: {
      exp: body.exp,
      area: body.area,
      tipo: body.tipo,
      agente: body.agente,
      organismo: body.organismo,
      objeto: body.objeto,
      encuadre: body.encuadre ?? undefined,
      montoARS: Number(body.montoARS) || 0,
      montoUSD: Number(body.montoUSD) || 0,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
      ocResolucion: body.ocResolucion ?? undefined,
      adjudicatario: body.adjudicatario ?? undefined,
      sector: body.sector ?? undefined,
      etapa: body.etapa ?? undefined,
      estadoGeneral: body.estadoGeneral,
    },
    include: INCLUDE_EXPEDIENTE,
  });

  return NextResponse.json({ expediente: actualizado });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || (session.user.rol !== "admin" && session.user.rol !== "operador")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await prisma.expediente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
