import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ENCUADRE_INTERADMINISTRATIVO, ENCUADRE_POR_TIPO_PARCHE, ESTADOS_CONVOCATORIA_FALLIDOS, MOTIVOS_ADJUDICACION_PARCIAL, MODALIDADES_FRACASADA, PRORROGA_MESES_OPCIONES } from "@/lib/constants";
import { parseFechaHora } from "@/lib/utils";

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

function normalizarNumeros(valor, max) {
  if (!Array.isArray(valor)) return [];
  return [...new Set(valor.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))].sort((a, b) => a - b);
}

// { "Talcahuano 550": { ascensores: [1,2], montacargas: [1] }, ... } — se
// acota a los domicilios que efectivamente quedan cargados en el
// expediente, y se descartan entradas vacías (sin ascensores ni montacargas).
function normalizarAscensoresPorDomicilio(valor, domiciliosValidos) {
  if (!valor || typeof valor !== "object") return null;
  const validos = new Set(domiciliosValidos || []);
  const resultado = {};
  for (const [domicilio, datos] of Object.entries(valor)) {
    if (!validos.has(domicilio) || !datos || typeof datos !== "object") continue;
    const ascensores = normalizarNumeros(datos.ascensores, 8);
    const montacargas = normalizarNumeros(datos.montacargas, 4);
    if (ascensores.length === 0 && montacargas.length === 0) continue;
    resultado[domicilio] = { ascensores, montacargas };
  }
  return Object.keys(resultado).length > 0 ? resultado : null;
}

// Activación automática de renovaciones: si una renovación ya está
// adjudicada (íntegra, o con adjudicatario cargado aunque sea una
// adjudicación parcial) y su fecha de inicio ya llegó, no tiene sentido
// seguir esperando el clic manual de "Activar como Vigente" — se activa
// sola, con la misma lógica de esa acción (el vigente anterior de la cadena
// pasa a "antecedente" / "Finalizado"). Una convocatoria fracasada/desierta
// nunca se activa así, aunque tenga fecha de inicio vencida — sigue
// necesitando resolverse a mano (relanzar, generar contratación, etc.).
// Se corre al listar expedientes (se llama en cada carga/refresco de la
// pantalla) en vez de con un cron: no hay infraestructura de tareas
// programadas en este proyecto, y así igual queda al día apenas alguien
// entra, sin depender de que ese alguien haga clic en nada.
async function activarRenovacionesVencidas(departamentoId) {
  // Las fechas se cargan desde inputs "YYYY-MM-DD" en el navegador del
  // usuario (huso horario de Argentina, UTC-3, sin horario de verano) y
  // terminan guardadas como la medianoche de ESE huso, que en UTC es
  // "día T03:00:00Z" — no "día T00:00:00Z". El servidor corre en UTC, así
  // que para el corte "hoy" hay que reconstruir la fecha de calendario de
  // Argentina (restando 3hs a la hora UTC actual) y recién ahí armar su
  // medianoche en UTC — si no, el corte queda 3hs adelantado y una fecha de
  // inicio de HOY no se reconoce como llegada hasta la noche.
  const ahoraArgentina = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hoy = new Date(Date.UTC(
    ahoraArgentina.getUTCFullYear(), ahoraArgentina.getUTCMonth(), ahoraArgentina.getUTCDate(),
    3, 0, 0, 0
  ));
  const candidatas = await prisma.expediente.findMany({
    where: {
      departamentoId,
      rol: "renovacion",
      fechaInicio: { lte: hoy },
      NOT: { estadoConvocatoria: { in: ESTADOS_CONVOCATORIA_FALLIDOS } },
      OR: [
        { estadoConvocatoria: "Adjudicación íntegra" },
        { adjudicatario: { not: null } },
      ],
    },
  });
  for (const renovacion of candidatas) {
    const vigenteAnterior = await prisma.expediente.findFirst({
      where: { cadenaId: renovacion.cadenaId, rol: "vigente", departamentoId, NOT: { id: renovacion.id } },
    });
    const ops = [];
    if (vigenteAnterior) {
      ops.push(prisma.expediente.update({
        where: { id: vigenteAnterior.id },
        data: { rol: "antecedente", estadoGeneral: "Finalizado", etapa: "Finalizado" },
      }));
    }
    ops.push(prisma.expediente.update({
      where: { id: renovacion.id },
      data: {
        rol: "vigente",
        estadoGeneral: "Vigente",
        etapa: "En ejecución",
        observaciones: {
          create: {
            usuario: "Sistema",
            tipo: "general",
            texto: "Activada automáticamente como Vigente: ya estaba adjudicada y llegó la fecha de inicio (" +
              renovacion.fechaInicio.toISOString().slice(0, 10) + ").",
          },
        },
      },
    }));
    await prisma.$transaction(ops);
  }
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    await activarRenovacionesVencidas(session.user.departamentoId);
  } catch (e) {
    // No bloquea el listado si esto falla — es una corrección automática,
    // no el propósito principal del endpoint.
    console.error("No se pudieron activar renovaciones vencidas:", e);
  }

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
          // El encuadre se define recién cuando se resuelve la adjudicación
          // de esta renovación — no se hereda del vigente del que surge.
          encuadre: null,
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

  // ---------- Unificar renovación de varios trámites que vencen en el mismo período ----------
  // Dos o más cadenas del mismo grupo (mismo tipo/zona/fuero/organismos, cada
  // una con su propio N° de expediente) pueden terminar el mismo período y
  // conviene tramitarlas juntas de ahí en más: se genera UN expediente nuevo,
  // con su propia cadenaId (una tarjeta nueva), que suma los
  // domicilios/renglones de todos los orígenes. El N° de la renovación
  // unificada puede ser uno nuevo o el mismo que ya tenía uno de los
  // orígenes — como `exp` es único, en ese caso el origen elegido se
  // renombra (mismo mecanismo que el sufijo "-LA" de Legítimo abono) para
  // liberar el número, y queda como antecedente histórico bajo el número
  // nuevo. Ninguno de los orígenes cambia de rol ni de estado: solo quedan
  // marcados con `unificadoEnId` para la trazabilidad.
  if (Array.isArray(body.unificarDeIds) && body.unificarDeIds.length > 0) {
    const ids = [...new Set(body.unificarDeIds)];
    if (ids.length < 2) {
      return NextResponse.json({ error: "Elegí al menos dos trámites para unificar" }, { status: 400 });
    }
    if (!body.exp || !body.exp.trim()) {
      return NextResponse.json({ error: "Cargá el N° de expediente de la renovación unificada" }, { status: 400 });
    }
    if (!body.fechaInicio || !body.fechaVencimiento) {
      return NextResponse.json({ error: "Cargá la fecha de inicio y de vencimiento de la renovación unificada" }, { status: 400 });
    }

    const origenes = await prisma.expediente.findMany({ where: { id: { in: ids } } });
    if (origenes.length !== ids.length || origenes.some((o) => o.departamentoId !== session.user.departamentoId)) {
      return NextResponse.json({ error: "Alguno de los expedientes de origen no se encontró" }, { status: 404 });
    }
    if (origenes.some((o) => o.rol !== "vigente" && o.rol !== "parche")) {
      return NextResponse.json({ error: "Solo se puede unificar la cobertura activa (vigente o parche) de cada trámite" }, { status: 400 });
    }
    if (origenes.some((o) => o.unificadoEnId)) {
      return NextResponse.json({ error: "Alguno de los expedientes ya fue unificado en otra renovación" }, { status: 400 });
    }

    // No puede empezar antes de que termine la cobertura de NINGUNA de las
    // cadenas que se unen (igual que una renovación simple, pero mirando
    // todas las cadenas involucradas).
    const cadenaIds = [...new Set(origenes.map((o) => o.cadenaId))];
    const cadenasCompletas = await prisma.expediente.findMany({
      where: { cadenaId: { in: cadenaIds }, rol: { in: ["vigente", "parche"] } },
    });
    const fechaMinima = cadenasCompletas.reduce(
      (max, e) => (!max || e.fechaVencimiento > max ? e.fechaVencimiento : max),
      null
    );
    if (fechaMinima && new Date(body.fechaInicio) < fechaMinima) {
      return NextResponse.json({
        error: "La fecha de inicio de la renovación unificada no puede ser anterior a " + fechaMinima.toISOString().slice(0, 10),
      }, { status: 400 });
    }

    const expPedido = body.exp.trim();
    const origenARenombrar = origenes.find((o) => o.exp.trim().toLowerCase() === expPedido.toLowerCase());
    const base = origenes[0];
    const domiciliosUnificados = normalizarLista(
      Array.isArray(body.domiciliosRenglones) && body.domiciliosRenglones.length > 0
        ? body.domiciliosRenglones
        : origenes.flatMap((o) => o.domiciliosRenglones || [])
    );

    let nuevo;
    try {
      nuevo = await prisma.$transaction(async (tx) => {
        // Si se reutiliza el N° de uno de los orígenes, ese origen se
        // renombra primero para liberar el string (exp es único).
        if (origenARenombrar) {
          let candidato = origenARenombrar.exp + "-ANT";
          let sufijo = 1;
          while (await tx.expediente.findUnique({ where: { exp: candidato } })) {
            sufijo++;
            candidato = origenARenombrar.exp + "-ANT" + sufijo;
          }
          await tx.expediente.update({
            where: { id: origenARenombrar.id },
            data: {
              exp: candidato,
              observaciones: {
                create: [{
                  usuario: session.user.name,
                  tipo: "general",
                  texto: "Expediente renombrado a " + candidato + " para liberar el N° " + expPedido +
                    ", reutilizado en la renovación unificada.",
                }],
              },
            },
          });
        }

        const creado = await tx.expediente.create({
          data: {
            cadenaId: "c" + Date.now(),
            rol: "renovacion",
            exp: expPedido,
            nombreCorto: base.nombreCorto,
            nroResolucion: base.nroResolucion,
            departamentoId: session.user.departamentoId,
            area: base.area,
            tipo: base.tipo,
            agente: base.agente,
            organismos: base.organismos,
            destinatario: base.destinatario,
            domicilio: base.domicilio,
            objeto: base.objeto,
            // Igual que una renovación simple: sin encuadre ni monto todavía,
            // se define recién al resolver la adjudicación.
            encuadre: null,
            presupuestoOficial: 0,
            montoARS: 0,
            montoUSD: 0,
            esPoliciaAdicional: base.esPoliciaAdicional,
            fuerzaSeguridad: base.fuerzaSeguridad,
            fechaInicio: new Date(body.fechaInicio),
            fechaVencimiento: new Date(body.fechaVencimiento),
            sector: base.sector,
            zona: base.zona,
            fuero: base.fuero,
            codigoInterno: base.codigoInterno,
            domiciliosRenglones: domiciliosUnificados,
            ascensoresPorDomicilio: base.tipo === "Ascensores"
              ? normalizarAscensoresPorDomicilio(body.ascensoresPorDomicilio, domiciliosUnificados)
              : null,
            etapa: "En trámite - carátula inicial",
            estadoGeneral: "En trámite de renovación",
          },
          include: INCLUDE_EXPEDIENTE,
        });

        await tx.expediente.updateMany({ where: { id: { in: ids } }, data: { unificadoEnId: creado.id } });
        await tx.observacion.createMany({
          data: ids.map((id) => ({
            expedienteId: id,
            usuario: session.user.name,
            tipo: "general",
            texto: "Unificado con " + (ids.length - 1) + " trámite(s) más en la renovación " + expPedido + ".",
          })),
        });

        return creado;
      });
    } catch (e) {
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

    if (!esLegitimoAbono && body.tieneProrroga && !PRORROGA_MESES_OPCIONES.includes(Number(body.mesesProrroga))) {
      return NextResponse.json({ error: "Elegí cuántos meses de prórroga tiene el expediente" }, { status: 400 });
    }

    // El legítimo abono no tiene N° de expediente propio: usa el de la
    // contratación anterior. Como `exp` es único en la base, se le agrega un
    // sufijo "-LA" (y un contador si hiciera falta) en vez de pedirlo.
    let expParche = body.exp;
    if (esLegitimoAbono) {
      let candidato = origen.exp + "-LA";
      let sufijo = 1;
      while (await prisma.expediente.findUnique({ where: { exp: candidato } })) {
        sufijo++;
        candidato = origen.exp + "-LA" + sufijo;
      }
      expParche = candidato;
    }

    let nuevoParche;
    try {
      nuevoParche = await prisma.expediente.create({
        data: {
          cadenaId: origen.cadenaId,
          rol: "parche",
          exp: expParche,
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
          domiciliosRenglones: origen.domiciliosRenglones || [],
          tipoParche: body.tipoParche || null,
          detalleParche: body.detalleParche || null,
          tieneProrroga: esLegitimoAbono ? false : !!body.tieneProrroga,
          mesesProrroga: !esLegitimoAbono && body.tieneProrroga ? Number(body.mesesProrroga) : null,
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

    // Si ya hay una renovación EN CURSO (todavía no se resolvió) en la misma
    // cadena, su período deja de ser correlativo (el parche ahora cubre más
    // adelante) — se corre para que arranque justo al día siguiente del
    // parche, conservando la duración que tenía planificada. Si la
    // convocatoria ya fracasó/quedó desierta, no se toca: ese período ya
    // quedó fijo como antecedente del intento fallido, no es una fecha
    // "pendiente" que deba seguir corriéndose.
    const renovacionEnTramite = await prisma.expediente.findFirst({
      where: {
        cadenaId: origen.cadenaId,
        rol: "renovacion",
        departamentoId: session.user.departamentoId,
        OR: [
          { estadoConvocatoria: null },
          { estadoConvocatoria: { notIn: ESTADOS_CONVOCATORIA_FALLIDOS } },
        ],
      },
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
  // departamento: lleva su propio N° de expediente. Ese N° se asigna una
  // sola vez (primera activación) — si la cadena se subdivide más adelante
  // (nueva OC, misma cobertura extendida) NO se crea otro expediente: se
  // extiende el mismo registro y la OC nueva queda como observación.
  if (body.prorrogaDepartamentoDeId) {
    const origen = await prisma.expediente.findUnique({ where: { id: body.prorrogaDepartamentoDeId } });
    if (!origen || origen.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }
    if (!origen.tieneProrroga) {
      return NextResponse.json({ error: "Este expediente no tiene la opción de prórroga marcada" }, { status: 400 });
    }
    if (origen.prorrogaActivada) {
      return NextResponse.json({ error: "Esta cadena ya usa la prórroga habilitada por el organismo" }, { status: 400 });
    }
    if (!origen.encuadre) {
      return NextResponse.json({ error: "El expediente de origen no tiene encuadre definido" }, { status: 400 });
    }
    // El tipo de contratación de la prórroga es siempre el mismo del vigente
    // de origen — no se elige.
    const esDescentralizada = origen.encuadre.toLowerCase().includes("descentralizada");

    const parcheExistente = await prisma.expediente.findFirst({
      where: { cadenaId: origen.cadenaId, rol: "parche", tipoContratacionProrroga: { not: null } },
    });

    // Igual que la del organismo, se elige en meses (1/2/3) en vez de una
    // fecha libre, y el acumulado (sea cual sea la modalidad) se descuenta
    // siempre del tope elegido en el vigente (origen.mesesProrroga) — cada
    // subdivisión consume de ahí, no hay un tope aparte para el parche.
    const maxMeses = origen.mesesProrroga || Math.max(...PRORROGA_MESES_OPCIONES);
    const mesesDisponibles = maxMeses - (origen.mesesProrrogaUsados || 0);
    if (mesesDisponibles <= 0) {
      return NextResponse.json({ error: "Este expediente ya usó todos los meses de prórroga disponibles" }, { status: 400 });
    }
    const meses = Number(body.meses);
    if (!PRORROGA_MESES_OPCIONES.includes(meses) || meses > mesesDisponibles) {
      return NextResponse.json({ error: "Solo podés activar hasta " + mesesDisponibles + " mes(es) más" }, { status: 400 });
    }

    let resultado;
    if (parcheExistente) {
      // Subdivisión: mismo N° de expediente, solo se extiende el vencimiento
      // y se suma una OC nueva.
      if (!esDescentralizada && !body.ocResolucion) {
        return NextResponse.json({ error: "Esta modalidad requiere N° de orden de compra" }, { status: 400 });
      }
      const nuevaFecha = new Date(parcheExistente.fechaVencimiento);
      nuevaFecha.setMonth(nuevaFecha.getMonth() + meses);
      const ocResolucion = esDescentralizada ? null : (body.ocResolucion || null);
      resultado = await prisma.expediente.update({
        where: { id: parcheExistente.id },
        data: {
          fechaVencimiento: nuevaFecha,
          ...(body.nroResolucion ? { nroResolucion: body.nroResolucion } : {}),
          ...(ocResolucion ? { ocResolucion } : {}),
          ...(body.montoARS != null ? { montoARS: Number(body.montoARS) || 0 } : {}),
          observaciones: {
            create: {
              usuario: session.user.name,
              tipo: "general",
              texto: "Prórroga (departamento) subdividida: +" + meses + " mes(es), vencimiento extendido de " +
                parcheExistente.fechaVencimiento.toISOString().slice(0, 10) + " a " + nuevaFecha.toISOString().slice(0, 10) +
                (ocResolucion ? ", OC " + ocResolucion : "") + ".",
              ocResolucion,
            },
          },
        },
        include: INCLUDE_EXPEDIENTE,
      });
    } else {
      // Primera activación: crea el expediente nuevo de la cadena. La fecha
      // de inicio es correlativa al período contratado (arranca al día
      // siguiente del vencimiento del vigente, sin que se pueda elegir) y
      // cubre los meses elegidos desde ahí.
      if (!body.nroResolucion) {
        return NextResponse.json({ error: "Cargá el N° de resolución" }, { status: 400 });
      }
      if (!esDescentralizada && !body.ocResolucion) {
        return NextResponse.json({ error: "Esta modalidad requiere N° de orden de compra" }, { status: 400 });
      }
      const fechaInicio = new Date(origen.fechaVencimiento);
      fechaInicio.setDate(fechaInicio.getDate() + 1);
      const nuevaFecha = new Date(fechaInicio);
      nuevaFecha.setMonth(nuevaFecha.getMonth() + meses);
      try {
        resultado = await prisma.expediente.create({
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
            fechaInicio,
            fechaVencimiento: nuevaFecha,
            nroResolucion: body.nroResolucion,
            ocResolucion: esDescentralizada ? null : (body.ocResolucion || null),
            sector: origen.sector,
            estadoGeneral: "Vigente",
            tipoContratacionProrroga: origen.encuadre,
            encuadre: origen.encuadre,
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
    }

    // El acumulado vive en el vigente (origen), no en el parche: ahí es
    // donde se eligió el tope y donde lo consulta la modalidad organismo.
    await prisma.expediente.update({
      where: { id: origen.id },
      data: { mesesProrrogaUsados: (origen.mesesProrrogaUsados || 0) + meses },
    });

    // Misma lógica de corrimiento que un parche clásico: si ya hay una
    // renovación EN CURSO (no fracasada/desierta) en la cadena, se corre
    // para arrancar al día siguiente, conservando la duración planificada.
    const renovacionEnTramite = await prisma.expediente.findFirst({
      where: {
        cadenaId: origen.cadenaId,
        rol: "renovacion",
        departamentoId: session.user.departamentoId,
        OR: [
          { estadoConvocatoria: null },
          { estadoConvocatoria: { notIn: ESTADOS_CONVOCATORIA_FALLIDOS } },
        ],
      },
    });
    if (renovacionEnTramite) {
      const nuevaFechaInicio = new Date(resultado.fechaVencimiento);
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

    return NextResponse.json({ expediente: resultado }, { status: parcheExistente ? 200 : 201 });
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
    // Resuelven adjudicación las renovaciones en trámite y todos los parches
    // salvo el legítimo abono y la prórroga por departamento.
    const esRenovacionEnTramite = origen.rol === "renovacion" && origen.estadoGeneral === "En trámite de renovación";
    const esParcheConAdjudicacion = origen.rol === "parche" && origen.tipoParche !== "Legítimo abono" && !origen.tipoContratacionProrroga;
    if (!esRenovacionEnTramite && !esParcheConAdjudicacion) {
      return NextResponse.json({ error: "Solo se puede dividir una renovación en trámite o un parche (salvo legítimo abono)" }, { status: 400 });
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
        const motivo = MOTIVOS_ADJUDICACION_PARCIAL.includes(g.estadoConvocatoria) ? g.estadoConvocatoria : MOTIVOS_ADJUDICACION_PARCIAL[0];
        // Este expediente nuevo NO tramita el fracaso — es el intento de
        // contratación de esos domicilios/renglones, así que arranca su
        // propia convocatoria desde cero. El motivo por el que no se
        // adjudicaron antes queda de referencia en una observación.
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
            estadoConvocatoria: "Caratulación",
            domiciliosRenglones: domicilios,
            divisionDeId: origen.id,
            observaciones: {
              create: [{
                usuario: session.user.name,
                tipo: "general",
                texto: "Intento de contratación de los domicilios/renglones: " + domicilios.join(", ") +
                  " — en " + origen.exp + " quedaron como " + motivo + ".",
              }],
            },
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

    // El expediente de origen conserva TODOS los domicilios/renglones con los
    // que arrancó esa contratación (no se le sacan los que se dividieron) —
    // pero se deja constancia en una observación de cuáles quedaron
    // adjudicados ahí y cuáles se tramitan por separado en los expedientes
    // nuevos.
    const adjudicados = (origen.domiciliosRenglones || []).filter(v => !todosLosDomicilios.includes(v));
    const textoConstancia = (adjudicados.length > 0
      ? "Adjudicación parcial: quedan adjudicados los domicilios/renglones " + adjudicados.join(", ") + ". "
      : "Adjudicación parcial: ningún domicilio/renglón quedó adjudicado en este expediente. ") +
      "Se tramitan por separado los domicilios/renglones " + todosLosDomicilios.join(", ") +
      " en los expedientes " + nuevasDivisiones.map(d => d.exp).join(", ") + ".";

    // Firma y monto adjudicados por domicilio/renglón de lo que queda
    // adjudicado en el origen — distintos renglones pueden haber sido
    // adjudicados a distintas empresas y por distintos montos dentro de esta
    // misma resolución.
    const adjudicacionEnviada = body.adjudicacionPorRenglon && typeof body.adjudicacionPorRenglon === "object" ? body.adjudicacionPorRenglon : {};
    const adjudicacionPorRenglon = {};
    for (const dom of adjudicados) {
      const dato = adjudicacionEnviada[dom] ?? origen.adjudicacionPorRenglon?.[dom];
      if (dato?.firma) {
        adjudicacionPorRenglon[dom] = { firma: String(dato.firma).trim(), monto: Number(dato.monto) || 0, oc: dato.oc ? String(dato.oc).trim() : "" };
      }
    }
    const firmasUnicas = [...new Set(Object.values(adjudicacionPorRenglon).map(v => v.firma))];
    const montoTotal = Object.values(adjudicacionPorRenglon).reduce((s, v) => s + v.monto, 0);
    // Una OC por empresa, no por renglón — si además vino un ocResolucion
    // explícito (join de las OC únicas armado en el cliente) se usa ese.
    const ocsUnicas = body.ocResolucion
      ? String(body.ocResolucion).trim()
      : [...new Set(Object.values(adjudicacionPorRenglon).map(v => v.oc).filter(Boolean))].join(" / ");

    await prisma.expediente.update({
      where: { id: origen.id },
      data: {
        ...(Object.keys(adjudicacionPorRenglon).length > 0
          ? { adjudicacionPorRenglon, adjudicatario: firmasUnicas.join(" / "), montoARS: montoTotal }
          : {}),
        ...(body.resolucionAdjudicacion ? { resolucionAdjudicacion: String(body.resolucionAdjudicacion).trim() } : {}),
        ...(ocsUnicas ? { ocResolucion: ocsUnicas } : {}),
        observaciones: {
          create: [{
            usuario: session.user.name,
            tipo: "general",
            texto: textoConstancia,
          }],
        },
      },
    });

    return NextResponse.json({ expedientes: nuevasDivisiones }, { status: 201 });
  }

  // ---------- Generar contrataciones tras una convocatoria fracasada, dividiendo por renglón ----------
  // A diferencia de "Generar contratación" (que reutiliza el mismo N° de
  // expediente cuando no hace falta dividir), acá cada grupo de
  // domicilios/renglones va a un expediente NUEVO, cada uno con su propia
  // modalidad — puede ser que 2 renglones se resuelvan por Contratación
  // Directa y el otro por Licitación Privada, por ejemplo. El expediente
  // fracasado de origen queda intacto (sigue mostrando su propio estado e
  // encuadre); cada nuevo expediente arranca en ejecución (Vigente) de
  // inmediato, igual que un parche clásico, y queda vinculado a la fracasada
  // vía divisionDeId — la ficha los cuelga juntos, uno arriba del otro.
  if (body.generarContratacionesFracasadaDeId) {
    const grupos = Array.isArray(body.grupos) ? body.grupos : [];
    if (grupos.length === 0) {
      return NextResponse.json({ error: "Cargá al menos un expediente para la división" }, { status: 400 });
    }
    const origen = await prisma.expediente.findUnique({ where: { id: body.generarContratacionesFracasadaDeId } });
    if (!origen || origen.departamentoId !== session.user.departamentoId) {
      return NextResponse.json({ error: "Expediente de origen no encontrado" }, { status: 404 });
    }
    if (origen.rol !== "renovacion" || origen.estadoConvocatoria !== "Proyecto fracasado") {
      return NextResponse.json({ error: "Solo aplica a una convocatoria fracasada" }, { status: 400 });
    }
    for (const g of grupos) {
      if (!g.exp || !String(g.exp).trim()) {
        return NextResponse.json({ error: "Cargá el N° de expediente de cada división" }, { status: 400 });
      }
      if (normalizarLista(g.domiciliosRenglones).length === 0) {
        return NextResponse.json({ error: "Elegí al menos un domicilio/renglón para cada división" }, { status: 400 });
      }
      if (!MODALIDADES_FRACASADA.includes(g.modalidad)) {
        return NextResponse.json({ error: "Elegí una modalidad válida para cada división" }, { status: 400 });
      }
      if (!g.fechaVencimiento) {
        return NextResponse.json({ error: "Cargá la fecha de vencimiento de cada división" }, { status: 400 });
      }
      const esDescentralizada = g.modalidad === "Contratación Descentralizada";
      if (!esDescentralizada && !g.ocResolucion) {
        return NextResponse.json({ error: "Cargá la OC de cada división que no sea descentralizada" }, { status: 400 });
      }
      if (g.tieneProrroga && !PRORROGA_MESES_OPCIONES.includes(Number(g.mesesProrroga))) {
        return NextResponse.json({ error: "Elegí cuántos meses de prórroga tiene cada división con opción de prórroga" }, { status: 400 });
      }
    }

    const nuevasContrataciones = [];
    try {
      for (let i = 0; i < grupos.length; i++) {
        const g = grupos[i];
        const esDescentralizada = g.modalidad === "Contratación Descentralizada";
        const nueva = await prisma.expediente.create({
          data: {
            // Misma cadena que la fracasada (a diferencia de "Dividir
            // expediente", que arranca una cadena nueva por división): estas
            // contrataciones resuelven la MISMA convocatoria, así que tienen
            // que verse juntas en la trazabilidad del expediente de origen.
            cadenaId: origen.cadenaId,
            rol: "parche",
            exp: g.exp.trim(),
            departamentoId: session.user.departamentoId,
            area: origen.area,
            tipo: origen.tipo,
            agente: origen.agente,
            organismos: origen.organismos,
            objeto: g.objeto || origen.objeto,
            encuadre: g.modalidad,
            parcheDeFracasada: true,
            estadoGeneral: "Vigente",
            etapa: "En ejecución",
            sector: origen.sector,
            zona: origen.zona,
            fuero: origen.fuero,
            domiciliosRenglones: normalizarLista(g.domiciliosRenglones),
            fechaInicio: g.fechaInicio ? new Date(g.fechaInicio) : null,
            fechaVencimiento: new Date(g.fechaVencimiento),
            montoARS: Number(g.montoARS) || 0,
            ocResolucion: esDescentralizada ? null : (g.ocResolucion || null),
            resolucionLlamado: g.resolucionLlamado || null,
            resolucionAdjudicacion: g.resolucionAdjudicacion || null,
            tieneProrroga: !!g.tieneProrroga,
            mesesProrroga: g.tieneProrroga ? Number(g.mesesProrroga) : null,
            observaciones: {
              create: [{
                usuario: session.user.name,
                tipo: "general",
                texto: "Contratación (" + g.modalidad + ") generada tras la convocatoria fracasada " + origen.exp +
                  " — domicilios/renglones: " + normalizarLista(g.domiciliosRenglones).join(", ") + ".",
              }],
            },
          },
          include: INCLUDE_EXPEDIENTE,
        });
        nuevasContrataciones.push(nueva);
      }
    } catch (e) {
      if (e.code === "P2002") {
        return NextResponse.json({ error: "Ya existe un expediente con ese número" }, { status: 409 });
      }
      throw e;
    }

    await prisma.expediente.update({
      where: { id: origen.id },
      data: {
        observaciones: {
          create: [{
            usuario: session.user.name,
            tipo: "general",
            texto: "Convocatoria fracasada dividida en " + nuevasContrataciones.length + " contratación(es): " +
              nuevasContrataciones.map(n => n.exp + " (" + n.encuadre + ")").join(", ") + ".",
          }],
        },
      },
    });

    return NextResponse.json({ expedientes: nuevasContrataciones }, { status: 201 });
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

  if (body.tieneProrroga && !PRORROGA_MESES_OPCIONES.includes(Number(body.mesesProrroga))) {
    return NextResponse.json({ error: "Elegí cuántos meses de prórroga tiene el expediente" }, { status: 400 });
  }

  const domiciliosNormalizados = normalizarLista(body.domiciliosRenglones);

  // Legítimo abono caratulado como parche: no tiene N° de expediente propio,
  // toma el del antecedente. Como `exp` es único en la base, se le agrega el
  // sufijo "-LA" (y un contador si hiciera falta), igual que en "Generar
  // parche". Nunca lleva OC, resoluciones ni prórroga.
  const esLegitimoAbono = body.rol === "parche" && body.tipoParche === "Legítimo abono";
  let expFinal = body.exp;
  if (esLegitimoAbono) {
    const base = String(body.exp || "").trim().replace(/-LA\d*$/, "");
    if (!base) return NextResponse.json({ error: "Cargá el N° de expediente del antecedente" }, { status: 400 });
    let candidato = base + "-LA";
    let sufijo = 1;
    while (await prisma.expediente.findUnique({ where: { exp: candidato } })) {
      sufijo++;
      candidato = base + "-LA" + sufijo;
    }
    expFinal = candidato;
  }

  // "En trámite de renovación" es un estado que solo tiene sentido para el
  // rol "renovacion" (define, entre otras cosas, si esConvocatoriaFracasada
  // puede aplicar) — si el cliente lo manda para cualquier otro rol (ej. el
  // desplegable "Estado general" del alta manual, elegido sin pensar en qué
  // rol termina resolviendo la cadena), se corrige a "Vigente" para no dejar
  // guardar una combinación inconsistente.
  let rolFinal = body.rol || "vigente";
  // Tampoco tiene sentido un "vigente" cuyo período todavía no arrancó — ya
  // está la cobertura corriendo o no lo es. Mismo criterio que aplica
  // "Caratular": si la fecha de inicio es futura, pasa a ser una renovación
  // en trámite (avisa cuándo arranca) hasta que llegue esa fecha.
  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  if (rolFinal === "vigente" && body.fechaInicio && new Date(body.fechaInicio) > hoy) {
    rolFinal = "renovacion";
  }
  const estadoGeneralFinal = rolFinal === "renovacion"
    ? "En trámite de renovación"
    : (body.estadoGeneral === "En trámite de renovación" ? "Vigente" : (body.estadoGeneral || "Vigente"));

  const nuevo = await prisma.expediente.create({
    data: {
      cadenaId: body.cadenaId || "c" + Date.now(),
      rol: rolFinal,
      exp: expFinal,
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
      fechaApertura: parseFechaHora(body.fechaApertura),
      ocResolucion: esRenovacionVinculada || esLegitimoAbono ? null : (body.ocResolucion || null),
      resolucionLlamado: esRenovacionVinculada || esLegitimoAbono ? null : (body.resolucionLlamado || null),
      resolucionAdjudicacion: esRenovacionVinculada || esLegitimoAbono ? null : (body.resolucionAdjudicacion || null),
      adjudicatario: esRenovacionVinculada || esLegitimoAbono ? null : (body.adjudicatario || null),
      sector: sectorInicial,
      etapa: body.etapa || null,
      estadoGeneral: estadoGeneralFinal,
      fuero: normalizarFuero(body),
      zona: esRenovacionVinculada ? (referenciaVigente.zona || null) : (body.zona || null),
      codigoInterno: body.codigoInterno || null,
      estadoConvocatoria: body.estadoConvocatoria || null,
      tieneProrroga: !esLegitimoAbono && !!body.tieneProrroga,
      mesesProrroga: !esLegitimoAbono && body.tieneProrroga ? Number(body.mesesProrroga) : null,
      domiciliosRenglones: domiciliosNormalizados,
      tipoParche: body.rol === "parche" ? (body.tipoParche || null) : null,
      ascensoresPorDomicilio: body.tipo === "Ascensores" ? normalizarAscensoresPorDomicilio(body.ascensoresPorDomicilio, domiciliosNormalizados) : null,
      tieneAdecuaciones: body.tipo === "Ascensores" ? !!body.tieneAdecuaciones : false,
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
