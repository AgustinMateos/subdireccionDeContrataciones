import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ENCUADRE_INTERADMINISTRATIVO, ENCUADRE_POR_TIPO_PARCHE, ESTADOS_CONVOCATORIA_FALLIDOS } from "@/lib/constants";

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

function normalizarFuero(body) {
  if (Array.isArray(body.fuero)) {
    return body.fuero.map((f) => String(f).trim()).filter(Boolean);
  }
  return body.fuero ? [String(body.fuero).trim()].filter(Boolean) : [];
}

function normalizarLista(valor) {
  if (Array.isArray(valor)) return valor.map((v) => String(v).trim()).filter(Boolean);
  return valor ? [String(valor).trim()].filter(Boolean) : [];
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
  // "En trámite de renovación", no él. Las fechas las carga el usuario (no se
  // adivinan): solo se valida que no arranquen antes de que termine la
  // cobertura actual de la cadena.
  if (body.renovarDeId) {
    if (!body.exp || !body.exp.trim()) {
      return NextResponse.json({ error: "Cargá el N° de expediente de la renovación" }, { status: 400 });
    }
    if (!body.fechaInicio || !body.fechaVencimiento) {
      return NextResponse.json({ error: "Cargá la fecha de inicio y de vencimiento de la renovación" }, { status: 400 });
    }
    const vigente = await prisma.expediente.findUnique({ where: { id: body.renovarDeId } });
    if (!vigente || vigente.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }

    // No puede empezar antes de que termine la cobertura actual: el
    // vencimiento del vigente (ya extendido si tiene prórroga activada) o el
    // del parche más tardío de la cadena, el que sea más tarde.
    const parchesOrigen = await prisma.expediente.findMany({ where: { cadenaId: vigente.cadenaId, rol: "parche" } });
    const fechaMinima = [vigente, ...parchesOrigen].reduce(
      (max, e) => (!max || e.fechaVencimiento > max ? e.fechaVencimiento : max),
      null
    );
    if (fechaMinima && new Date(body.fechaInicio) < fechaMinima) {
      return NextResponse.json({
        error: "La fecha de inicio de la renovación no puede ser anterior a " + fechaMinima.toISOString().slice(0, 10),
      }, { status: 400 });
    }

    let nuevo;
    try {
      nuevo = await prisma.expediente.create({
        data: {
          cadenaId: vigente.cadenaId,
          rol: "renovacion",
          exp: body.exp.trim(),
          nombreCorto: vigente.nombreCorto,
          // La renovación arranca su propio trámite: sin N° de contratación,
          // presupuesto, monto adjudicado, adjudicatario, OC ni resoluciones
          // todavía (se cargan a medida que avanza, hasta adjudicarla).
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
          fechaInicio: new Date(body.fechaInicio),
          fechaVencimiento: new Date(body.fechaVencimiento),
          ocResolucion: null,
          resolucionLlamado: null,
          resolucionAdjudicacion: null,
          adjudicatario: null,
          sector: vigente.sector,
          zona: vigente.zona,
          fuero: vigente.fuero,
          codigoInterno: vigente.codigoInterno,
          domiciliosRenglones: Array.isArray(body.domiciliosRenglones)
            ? normalizarLista(body.domiciliosRenglones)
            : (vigente.domiciliosRenglones || []),
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
        encuadre: ENCUADRE_POR_TIPO_PARCHE[body.tipoParche] || null,
        presupuestoOficial: 0,
        montoARS: Number(body.montoARS) || 0,
        montoUSD: 0,
        fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
        fechaVencimiento: new Date(body.fechaVencimiento),
        ocResolucion: esLegitimoAbono ? null : (body.ocResolucion || null),
        resolucionLlamado: esLegitimoAbono ? null : (body.resolucionLlamado || null),
        resolucionAdjudicacion: esLegitimoAbono ? null : (body.resolucionAdjudicacion || null),
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

  // ---------- Habilitar prórroga por el DEPARTAMENTO ----------
  // A diferencia de la prórroga simple (que habilita el organismo, sin
  // expediente nuevo) y del parche clásico, esta la habilita el propio
  // departamento: lleva su propio N° de expediente, siempre N° de
  // resolución, y orden de compra solo si la contratación no es
  // descentralizada.
  if (body.prorrogaDepartamentoDeId) {
    const origen = await prisma.expediente.findUnique({ where: { id: body.prorrogaDepartamentoDeId } });
    if (!origen || origen.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }
    if (!origen.tieneProrroga) {
      return NextResponse.json({ error: "Este expediente no tiene la opción de prórroga marcada" }, { status: 400 });
    }
    if (!body.nroResolucion) {
      return NextResponse.json({ error: "Cargá el N° de resolución" }, { status: 400 });
    }
    const esDescentralizada = body.tipoContratacionProrroga === "Contratación descentralizada";
    if (!esDescentralizada && !body.ocResolucion) {
      return NextResponse.json({ error: "Esta modalidad requiere N° de orden de compra" }, { status: 400 });
    }

    let nuevaProrroga;
    try {
      nuevaProrroga = await prisma.expediente.create({
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
          nroResolucion: body.nroResolucion,
          ocResolucion: esDescentralizada ? null : (body.ocResolucion || null),
          sector: origen.sector,
          estadoGeneral: "Vigente",
          tipoContratacionProrroga: body.tipoContratacionProrroga || null,
          zona: origen.zona,
          fuero: origen.fuero,
        },
        include: INCLUDE_EXPEDIENTE,
      });
    } catch (e) {
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Ya existe un expediente con ese número" }, { status: 409 });
      }
      throw e;
    }

    // Misma lógica de corrimiento que un parche clásico: si ya hay una
    // renovación en trámite en la cadena, se corre para arrancar al día
    // siguiente, conservando la duración planificada.
    const renovacionEnTramite = await prisma.expediente.findFirst({
      where: { cadenaId: origen.cadenaId, rol: "renovacion", departamentoId: session.user.departamentoId },
    });
    if (renovacionEnTramite) {
      const nuevaFechaInicio = new Date(nuevaProrroga.fechaVencimiento);
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

    return NextResponse.json({ expediente: nuevaProrroga }, { status: 201 });
  }

  // ---------- Dividir expediente (adjudicación parcial) ----------
  // Adjudicación parcial: algunos domicilios/renglones de la convocatoria no
  // se adjudican (uno o varios grupos, cada uno con su propio destino —
  // pueden ser 3 renglones fracasados repartidos en 2 expedientes nuevos, por
  // ejemplo) mientras el resto sigue su curso en el expediente de origen. Cada
  // división arranca su propia cadena, pero conserva la relación con el
  // expediente del que salió (divisionDeId) para poder "reunificarlos" más
  // adelante si los períodos coinciden.
  if (body.divisionDeId) {
    const grupos = Array.isArray(body.grupos) ? body.grupos : [];
    if (grupos.length === 0) {
      return NextResponse.json({ error: "Cargá al menos un expediente para la adjudicación parcial" }, { status: 400 });
    }
    const origen = await prisma.expediente.findUnique({ where: { id: body.divisionDeId } });
    if (!origen || origen.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }
    if (origen.rol !== "renovacion" || origen.estadoGeneral !== "En trámite de renovación") {
      return NextResponse.json({ error: "Solo se puede dividir una renovación en trámite" }, { status: 400 });
    }
    for (const g of grupos) {
      if (!g.exp || !String(g.exp).trim()) {
        return NextResponse.json({ error: "Cargá el N° de expediente de cada división" }, { status: 400 });
      }
      if (!g.fechaVencimiento) {
        return NextResponse.json({ error: "Cargá la fecha de vencimiento de cada división" }, { status: 400 });
      }
      if (normalizarLista(g.domiciliosRenglones).length === 0) {
        return NextResponse.json({ error: "Elegí al menos un domicilio/renglón para cada división" }, { status: 400 });
      }
    }

    const nuevasDivisiones = [];
    const todosLosDomicilios = [];
    try {
      for (let i = 0; i < grupos.length; i++) {
        const g = grupos[i];
        const domicilios = normalizarLista(g.domiciliosRenglones);
        todosLosDomicilios.push(...domicilios);
        const nueva = await prisma.expediente.create({
          data: {
            cadenaId: "c" + Date.now() + "_" + i,
            rol: "renovacion",
            exp: g.exp.trim(),
            departamentoId: session.user.departamentoId,
            area: origen.area,
            tipo: origen.tipo,
            agente: origen.agente,
            organismos: origen.organismos,
            objeto: g.objeto || origen.objeto,
            fechaInicio: g.fechaInicio ? new Date(g.fechaInicio) : null,
            fechaVencimiento: new Date(g.fechaVencimiento),
            estadoGeneral: "En trámite de renovación",
            sector: origen.sector,
            zona: origen.zona,
            fuero: origen.fuero,
            estadoConvocatoria: ESTADOS_CONVOCATORIA_FALLIDOS.includes(g.estadoConvocatoria)
              ? g.estadoConvocatoria
              : "Proyecto fracasado",
            domiciliosRenglones: domicilios,
            divisionDeId: origen.id,
          },
          include: INCLUDE_EXPEDIENTE,
        });
        nuevasDivisiones.push(nueva);
      }
    } catch (e) {
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Ya existe un expediente con ese número" }, { status: 409 });
      }
      throw e;
    }

    // Los domicilios/renglones divididos dejan de estar cubiertos por el
    // expediente de origen — el resto sigue su curso ahí normalmente.
    await prisma.expediente.update({
      where: { id: origen.id },
      data: {
        domiciliosRenglones: (origen.domiciliosRenglones || []).filter(v => !todosLosDomicilios.includes(v)),
      },
    });

    return NextResponse.json({ expedientes: nuevasDivisiones }, { status: 201 });
  }

  // ---------- Alta normal de expediente ----------
  // Si esto va a ser la renovación de una cadena, no puede empezar antes de
  // que termine la cobertura actual: el vencimiento del vigente (ya extendido
  // si tiene la prórroga activada) o el del parche más tardío — el que sea
  // más tarde. Se mira TODA la cadena, sin importar si lo que se referenció
  // como antecedente fue el propio vigente o uno de sus parches.
  let referenciaVigente = null;
  if (body.idVigenteAActualizar) {
    referenciaVigente = await prisma.expediente.findUnique({ where: { id: body.idVigenteAActualizar } });
    if (!referenciaVigente || referenciaVigente.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de referencia no encontrado" }, { status: 404 });
    }
    if (body.fechaInicio) {
      const cadenaCompleta = await prisma.expediente.findMany({ where: { cadenaId: referenciaVigente.cadenaId } });
      const fechaMinima = cadenaCompleta
        .filter(e => e.rol === "vigente" || e.rol === "parche")
        .reduce((max, e) => (!max || e.fechaVencimiento > max ? e.fechaVencimiento : max), null);
      if (fechaMinima && new Date(body.fechaInicio) < fechaMinima) {
        return NextResponse.json({
          error: "La fecha de inicio de la renovación no puede ser anterior a " + fechaMinima.toISOString().slice(0, 10),
        }, { status: 400 });
      }
    }
  }

  // La renovación de un vigente arranca su propio trámite: sin N° de
  // contratación, presupuesto ni monto adjudicado todavía, sin importar lo
  // que se haya tipeado en el formulario. La zona es la misma de donde surge,
  // no se puede elegir otra al vincular.
  const esRenovacionVinculada = !!body.idVigenteAActualizar;
  const sectorInicial = body.sector || null;

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
      montoUSD: esRenovacionVinculada ? 0 : (Number(body.montoUSD) || 0),
      esPoliciaAdicional: puedePoliciaAdicional && !!body.esPoliciaAdicional,
      fuerzaSeguridad: puedePoliciaAdicional && body.esPoliciaAdicional ? (body.fuerzaSeguridad || null) : null,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaVencimiento: new Date(body.fechaVencimiento),
      fechaPublicacion: body.fechaPublicacion ? new Date(body.fechaPublicacion) : null,
      fechaApertura: body.fechaApertura ? new Date(body.fechaApertura) : null,
      ocResolucion: esRenovacionVinculada ? null : (body.ocResolucion || null),
      resolucionLlamado: esRenovacionVinculada ? null : (body.resolucionLlamado || null),
      resolucionAdjudicacion: esRenovacionVinculada ? null : (body.resolucionAdjudicacion || null),
      adjudicatario: esRenovacionVinculada ? null : (body.adjudicatario || null),
      sector: sectorInicial,
      etapa: body.etapa || null,
      estadoGeneral: body.estadoGeneral || "Vigente",
      fuero: normalizarFuero(body),
      zona: esRenovacionVinculada ? (referenciaVigente.zona || null) : (body.zona || null),
      codigoInterno: body.codigoInterno || null,
      estadoConvocatoria: body.estadoConvocatoria || null,
      tieneProrroga: !!body.tieneProrroga,
      domiciliosRenglones: normalizarLista(body.domiciliosRenglones),
      observaciones: sectorInicial
        ? {
            create: [{
              usuario: session.user.name,
              tipo: "movimiento",
              texto: "Expediente caratulado, ingresa a " + sectorInicial + ".",
              sectorAnterior: null,
              sectorNuevo: sectorInicial,
            }],
          }
        : undefined,
    },
    include: INCLUDE_EXPEDIENTE,
  });

  // El vigente NO cambia de estado al vincularle una renovación: ya fue
  // adjudicado y sigue en ejecución tal cual — es la renovación la que
  // entra "En trámite de renovación", no él.

  return NextResponse.json({ expediente: nuevo }, { status: 201 });
}
