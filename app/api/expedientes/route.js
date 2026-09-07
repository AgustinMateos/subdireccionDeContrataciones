import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ENCUADRE_INTERADMINISTRATIVO } from "@/lib/constants";

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

  const where = { departamentoId: session.user.departamentoId };
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
  // La contratación de policía adicional es exclusiva de Informática y Varios.
  const puedePoliciaAdicional = session.user.departamentoSlug === "informatica-y-varios";

  // ---------- Crear renovación vinculada a un expediente vigente ----------
  // Genera un expediente nuevo con el mismo cadenaId y rol "renovacion" copiando
  // los datos del vigente de origen. El vigente NO cambia de estado: ya fue
  // adjudicado y sigue en ejecución tal cual — es la renovación la que entra
  // "En trámite de renovación", no él.
  if (body.renovarDeId) {
    if (!body.exp || !body.exp.trim()) {
      return NextResponse.json({ error: "Cargá el N° de expediente de la renovación" }, { status: 400 });
    }
    const vigente = await prisma.expediente.findUnique({ where: { id: body.renovarDeId } });
    if (!vigente || vigente.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }

    // El período de la renovación es correlativo al que cubre hoy la cadena:
    // arranca al día siguiente del vencimiento del vigente, o del parche más
    // tardío si hay alguno cubriendo más adelante.
    const parchesOrigen = await prisma.expediente.findMany({ where: { cadenaId: vigente.cadenaId, rol: "parche" } });
    const finCobertura = [vigente, ...parchesOrigen].reduce(
      (max, e) => (!max || e.fechaVencimiento > max ? e.fechaVencimiento : max),
      null
    );
    const nuevaFechaInicio = new Date(finCobertura);
    nuevaFechaInicio.setDate(nuevaFechaInicio.getDate() + 1);
    const duracionMs = vigente.fechaInicio ? new Date(vigente.fechaVencimiento) - new Date(vigente.fechaInicio) : 0;
    const nuevaFechaVencimiento = new Date(nuevaFechaInicio.getTime() + duracionMs);

    let nuevo;
    try {
      nuevo = await prisma.expediente.create({
        data: {
          cadenaId: vigente.cadenaId,
          rol: "renovacion",
          exp: body.exp.trim(),
          nombreCorto: vigente.nombreCorto,
          // La renovación arranca su propio trámite: sin N° de contratación,
          // presupuesto ni monto adjudicado todavía (se cargan al adjudicarla).
          nroContratacion: null,
          nroResolucion: vigente.nroResolucion,
          departamentoId: session.user.departamentoId,
          area: vigente.area,
          tipo: vigente.tipo,
          agente: vigente.agente,
          organismos: vigente.organismos,
          destinatario: vigente.destinatario,
          domicilio: vigente.domicilio,
          objeto: vigente.objeto,
          encuadre: vigente.encuadre,
          presupuestoOficial: 0,
          montoARS: 0,
          montoUSD: 0,
          esPoliciaAdicional: vigente.esPoliciaAdicional,
          fuerzaSeguridad: vigente.fuerzaSeguridad,
          cotizacionPolicia: vigente.cotizacionPolicia ?? undefined,
          fechaInicio: nuevaFechaInicio,
          fechaVencimiento: nuevaFechaVencimiento,
          ocResolucion: vigente.ocResolucion,
          adjudicatario: vigente.adjudicatario,
          sector: vigente.sector,
          etapa: "En trámite - carátula inicial",
          estadoGeneral: "En trámite de renovación",
        },
        include: INCLUDE_EXPEDIENTE,
      });
    } catch (e) {
      // P2002 = colisión del campo único "exp": ya existe un expediente con ese número.
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Ya existe un expediente con ese número" }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({ expediente: nuevo }, { status: 201 });
  }

  // ---------- Generar un parche (contratación puente) vinculado a la cadena ----------
  // A diferencia de la renovación, el parche no copia fechas/monto del origen:
  // es una contratación corta con sus propios términos. Puede haber más de uno
  // sucesivo en la misma cadena (ej. un trámite simplificado y después, si la
  // renovación sigue sin salir, un legítimo abono).
  if (body.parcheDeId) {
    const origen = await prisma.expediente.findUnique({ where: { id: body.parcheDeId } });
    if (!origen || origen.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }

    // El legítimo abono nunca lleva orden de compra ni prórroga; descentralizada
    // y trámite simplificado sí pueden tenerlas.
    const esLegitimoAbono = body.tipoParche === "Legítimo abono";

    const nuevoParche = await prisma.expediente.create({
      data: {
        cadenaId: origen.cadenaId,
        rol: "parche",
        exp: body.exp,
        departamentoId: session.user.departamentoId,
        area: origen.area,
        tipo: origen.tipo,
        agente: origen.agente,
        organismos: origen.organismos,
        destinatario: origen.destinatario,
        domicilio: origen.domicilio,
        objeto: body.objeto || origen.objeto,
        presupuestoOficial: 0,
        montoARS: Number(body.montoARS) || 0,
        montoUSD: 0,
        fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
        fechaVencimiento: new Date(body.fechaVencimiento),
        ocResolucion: esLegitimoAbono ? null : (body.ocResolucion || null),
        sector: origen.sector,
        estadoGeneral: "Vigente",
        tipoParche: body.tipoParche || null,
        detalleParche: body.detalleParche || null,
        tieneProrroga: esLegitimoAbono ? false : !!body.tieneProrroga,
        zona: origen.zona,
        fuero: origen.fuero,
      },
      include: INCLUDE_EXPEDIENTE,
    });

    // Si ya hay una renovación en trámite en la misma cadena, su período
    // deja de ser correlativo (el parche ahora cubre más adelante) — se
    // corre para que arranque justo al día siguiente del parche, conservando
    // la duración que tenía planificada.
    const renovacionEnTramite = await prisma.expediente.findFirst({
      where: { cadenaId: origen.cadenaId, rol: "renovacion", departamentoId: session.user.departamentoId },
    });
    if (renovacionEnTramite) {
      const nuevaFechaInicio = new Date(nuevoParche.fechaVencimiento);
      nuevaFechaInicio.setDate(nuevaFechaInicio.getDate() + 1);
      const duracionMs = renovacionEnTramite.fechaInicio
        ? new Date(renovacionEnTramite.fechaVencimiento) - new Date(renovacionEnTramite.fechaInicio)
        : 0;
      await prisma.expediente.update({
        where: { id: renovacionEnTramite.id },
        data: {
          fechaInicio: nuevaFechaInicio,
          fechaVencimiento: new Date(nuevaFechaInicio.getTime() + duracionMs),
        },
      });
    }

    return NextResponse.json({ expediente: nuevoParche }, { status: 201 });
  }

  // ---------- Alta normal de expediente ----------
  // Si esto va a ser la renovación de una cadena, no puede empezar antes de
  // que termine la cobertura actual: el vencimiento del vigente (ya extendido
  // si tiene la prórroga activada) o el del parche más tardío — el que sea
  // más tarde. Se mira TODA la cadena, sin importar si lo que se referenció
  // como antecedente fue el propio vigente o uno de sus parches.
  if (body.idVigenteAActualizar && body.fechaInicio) {
    const referencia = await prisma.expediente.findUnique({ where: { id: body.idVigenteAActualizar } });
    if (!referencia || referencia.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de referencia no encontrado" }, { status: 404 });
    }
    const cadenaCompleta = await prisma.expediente.findMany({ where: { cadenaId: referencia.cadenaId } });
    const fechaMinima = cadenaCompleta
      .filter(e => e.rol === "vigente" || e.rol === "parche")
      .reduce((max, e) => (!max || e.fechaVencimiento > max ? e.fechaVencimiento : max), null);
    if (fechaMinima && new Date(body.fechaInicio) < fechaMinima) {
      return NextResponse.json({
        error: "La fecha de inicio de la renovación no puede ser anterior a " + fechaMinima.toISOString().slice(0, 10),
      }, { status: 400 });
    }
  }

  // La renovación de un vigente arranca su propio trámite: sin N° de
  // contratación, presupuesto ni monto adjudicado todavía, sin importar lo
  // que se haya tipeado en el formulario.
  const esRenovacionVinculada = !!body.idVigenteAActualizar;

  const nuevo = await prisma.expediente.create({
    data: {
      cadenaId: body.cadenaId || "c" + Date.now(),
      rol: body.rol || "vigente",
      exp: body.exp,
      nombreCorto: body.nombreCorto || null,
      nroContratacion: esRenovacionVinculada ? null : (body.nroContratacion || null),
      nroResolucion: body.nroResolucion || null,
      departamentoId: session.user.departamentoId,
      area: body.area || null,
      tipo: body.tipo,
      agente: body.agente,
      organismos: normalizarOrganismos(body),
      objeto: body.objeto,
      encuadre: puedePoliciaAdicional && body.esPoliciaAdicional ? ENCUADRE_INTERADMINISTRATIVO : (body.encuadre || null),
      presupuestoOficial: esRenovacionVinculada ? 0 : (Number(body.presupuestoOficial) || 0),
      montoARS: esRenovacionVinculada ? 0 : (Number(body.montoARS) || 0),
      montoUSD: Number(body.montoUSD) || 0,
      esPoliciaAdicional: puedePoliciaAdicional && !!body.esPoliciaAdicional,
      fuerzaSeguridad: puedePoliciaAdicional && body.esPoliciaAdicional ? (body.fuerzaSeguridad || null) : null,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaVencimiento: new Date(body.fechaVencimiento),
      ocResolucion: body.ocResolucion || null,
      adjudicatario: body.adjudicatario || null,
      sector: body.sector || null,
      etapa: body.etapa || null,
      estadoGeneral: body.estadoGeneral || "Vigente",
      fuero: body.fuero || null,
      zona: body.zona || null,
      codigoInterno: body.codigoInterno || null,
      estadoConvocatoria: body.estadoConvocatoria || null,
      tieneProrroga: !!body.tieneProrroga,
    },
    include: INCLUDE_EXPEDIENTE,
  });

  // El vigente NO cambia de estado al vincularle una renovación: ya fue
  // adjudicado y sigue en ejecución tal cual — es la renovación la que
  // entra "En trámite de renovación", no él.

  return NextResponse.json({ expediente: nuevo }, { status: 201 });
}
