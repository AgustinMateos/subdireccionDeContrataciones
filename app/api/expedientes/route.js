import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const INCLUDE_EXPEDIENTE = {
  observaciones: { orderBy: { fecha: "asc" } },
  documentacion: { orderBy: { orden: "asc" } },
};

// Acepta `organismos` (array) del cliente nuevo o `organismo` (string) por compatibilidad.
function normalizarOrganismos(body) {
  if (Array.isArray(body.organismos)) {
    return body.organismos.map((o) => String(o).trim()).filter(Boolean);
  }
  return body.organismo ? [String(body.organismo).trim()].filter(Boolean) : [];
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");
  const tipo = searchParams.get("tipo");
  const estadoGeneral = searchParams.get("estado");
  const organismo = searchParams.get("organismo");
  const nombreCorto = searchParams.get("nombreCorto");
  const q = searchParams.get("q");

  const where = {};
  if (area) where.area = area;
  if (tipo) where.tipo = tipo;
  if (estadoGeneral) where.estadoGeneral = estadoGeneral;
  if (organismo) where.organismos = { has: organismo };
  if (nombreCorto) where.nombreCorto = { contains: nombreCorto, mode: "insensitive" };
  if (q) {
    where.OR = [
      { exp: { contains: q, mode: "insensitive" } },
      { nombreCorto: { contains: q, mode: "insensitive" } },
      { objeto: { contains: q, mode: "insensitive" } },
      { adjudicatario: { contains: q, mode: "insensitive" } },
      { organismos: { has: q } },
    ];
  }

  const expedientes = await prisma.expediente.findMany({
    where,
    include: INCLUDE_EXPEDIENTE,
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

  // ---------- Crear renovación vinculada a un expediente vigente ----------
  // Genera un expediente nuevo con el mismo cadenaId y rol "renovacion" copiando
  // los datos del vigente de origen, y pasa a ese vigente a "En trámite de renovación".
  // Es lógica de negocio (toca dos registros), no un alta simple.
  if (body.renovarDeId) {
    const vigente = await prisma.expediente.findUnique({ where: { id: body.renovarDeId } });
    if (!vigente) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }

    let nuevo = null;
    for (let intento = 0; intento < 6 && !nuevo; intento++) {
      const expTentativo = "13-0" + (Math.floor(Math.random() * 9000) + 1000) + "/26";
      try {
        nuevo = await prisma.expediente.create({
          data: {
            cadenaId: vigente.cadenaId,
            rol: "renovacion",
            exp: expTentativo,
            nombreCorto: vigente.nombreCorto,
            nroContratacion: vigente.nroContratacion,
            nroResolucion: vigente.nroResolucion,
            area: vigente.area,
            tipo: vigente.tipo,
            agente: vigente.agente,
            organismos: vigente.organismos,
            destinatario: vigente.destinatario,
            domicilio: vigente.domicilio,
            objeto: vigente.objeto,
            encuadre: vigente.encuadre,
            presupuestoOficial: vigente.presupuestoOficial,
            montoARS: vigente.montoARS,
            montoUSD: vigente.montoUSD,
            fechaInicio: vigente.fechaInicio,
            fechaVencimiento: vigente.fechaVencimiento,
            ocResolucion: vigente.ocResolucion,
            adjudicatario: vigente.adjudicatario,
            sector: vigente.sector,
            etapa: "En trámite - carátula inicial",
            estadoGeneral: "En trámite de renovación",
          },
          include: INCLUDE_EXPEDIENTE,
        });
      } catch (e) {
        // P2002 = colisión del campo único "exp": reintenta con otro número.
        if (e.code !== "P2002") throw e;
      }
    }
    if (!nuevo) {
      return NextResponse.json({ error: "No se pudo generar el número de expediente" }, { status: 500 });
    }

    await prisma.expediente.update({
      where: { id: vigente.id },
      data: { estadoGeneral: "En trámite de renovación" },
    });

    return NextResponse.json({ expediente: nuevo }, { status: 201 });
  }

  // ---------- Alta normal de expediente ----------
  const nuevo = await prisma.expediente.create({
    data: {
      cadenaId: body.cadenaId || "c" + Date.now(),
      rol: body.rol || "vigente",
      exp: body.exp,
      nombreCorto: body.nombreCorto || null,
      nroContratacion: body.nroContratacion || null,
      nroResolucion: body.nroResolucion || null,
      area: body.area,
      tipo: body.tipo,
      agente: body.agente,
      organismos: normalizarOrganismos(body),
      objeto: body.objeto,
      encuadre: body.encuadre || null,
      presupuestoOficial: Number(body.presupuestoOficial) || 0,
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
    include: INCLUDE_EXPEDIENTE,
  });

  // Si el alta corresponde a la renovación/prórroga de un vigente existente,
  // ese vigente pasa a "En trámite de renovación" (el rol/cadena ya vienen resueltos).
  if (body.idVigenteAActualizar) {
    await prisma.expediente.update({
      where: { id: body.idVigenteAActualizar },
      data: { estadoGeneral: "En trámite de renovación" },
    });
  }

  return NextResponse.json({ expediente: nuevo }, { status: 201 });
}
