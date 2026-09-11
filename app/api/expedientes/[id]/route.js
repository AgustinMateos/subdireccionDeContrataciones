import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CHECKLIST_POLICIA_ADICIONAL, ENCUADRE_INTERADMINISTRATIVO, PRORROGA_MESES_OPCIONES } from "@/lib/constants";

const ITEM_COTIZADOR_POLICIA = CHECKLIST_POLICIA_ADICIONAL[3]; // "Control con el cotizador de módulos (aprobado y vinculado)"

const INCLUDE_EXPEDIENTE = {
  observaciones: { orderBy: { fecha: "asc" } },
  documentacion: { orderBy: { orden: "asc" } },
};

// Tras editar o borrar un movimiento, el "sector actual" del expediente vuelve a
// derivarse del último movimiento que quede registrado. Si no queda ninguno, se
// conserva el sector que ya tenía cargado.
async function resyncSectorDesdeMovimientos(expedienteId) {
  const ultimoMov = await prisma.observacion.findFirst({
    where: { expedienteId, tipo: "movimiento" },
    orderBy: { fecha: "desc" },
  });
  if (ultimoMov?.sectorNuevo) {
    await prisma.expediente.update({
      where: { id: expedienteId },
      data: { sector: ultimoMov.sectorNuevo, etapa: "En " + ultimoMov.sectorNuevo },
    });
  }
}

export async function GET(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const expediente = await prisma.expediente.findUnique({
    where: { id },
    include: INCLUDE_EXPEDIENTE,
  });
  if (!expediente || expediente.departamentoId !== session.user.departamentoId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ expediente });
}

export async function PUT(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol === "lector") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const existente = await prisma.expediente.findUnique({ where: { id }, select: { departamentoId: true } });
  if (!existente || existente.departamentoId !== session.user.departamentoId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await request.json();

  // ---------- Aprobar y vincular una cotización de policía adicional ----------
  // Marca el expediente como policía adicional, fija la fuerza y el encuadre,
  // guarda el snapshot de la cotización, deja una observación y tilda el paso
  // "Control con el cotizador de módulos" del circuito de legalidad.
  if (body.vincularCotizacionPolicia) {
    if (session.user.departamentoSlug !== "informatica-y-varios") {
      return NextResponse.json({ error: "La policía adicional es exclusiva de Informática y Varios" }, { status: 403 });
    }
    const c = body.vincularCotizacionPolicia;
    await prisma.expediente.update({
      where: { id },
      data: {
        esPoliciaAdicional: true,
        fuerzaSeguridad: c.fuerza || undefined,
        encuadre: ENCUADRE_INTERADMINISTRATIVO,
        cotizacionPolicia: c,
        observaciones: {
          create: { usuario: session.user.name, tipo: "general", texto: c.texto || "Cotización de policía adicional aprobada y vinculada." },
        },
      },
    });

    const existentes = await prisma.documentacionItem.findMany({
      where: { expedienteId: id },
      orderBy: { orden: "asc" },
    });
    if (existentes.length === 0) {
      await prisma.documentacionItem.createMany({
        data: CHECKLIST_POLICIA_ADICIONAL.map((item, i) => ({
          expedienteId: id,
          item,
          orden: i,
          cargado: item === ITEM_COTIZADOR_POLICIA,
        })),
      });
    } else {
      const target = existentes.find((e) => e.item === ITEM_COTIZADOR_POLICIA);
      if (target) {
        await prisma.documentacionItem.update({ where: { id: target.id }, data: { cargado: true } });
      }
    }

    const actualizado = await prisma.expediente.findUnique({ where: { id }, include: INCLUDE_EXPEDIENTE });
    return NextResponse.json({ expediente: actualizado });
  }

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

  // ---------- Editar una observación / movimiento ya registrado ----------
  // Solo el jefe de departamento (admin) puede modificar historial.
  if (body.editarObservacion) {
    if (session.user.rol !== "admin") {
      return NextResponse.json({ error: "Solo el jefe de departamento puede editar observaciones" }, { status: 403 });
    }
    const { obsId, texto, sectorNuevo } = body.editarObservacion;
    const obs = await prisma.observacion.findUnique({ where: { id: obsId } });
    if (!obs || obs.expedienteId !== id) {
      return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });
    }
    const esMovimiento = obs.tipo === "movimiento";
    await prisma.observacion.update({
      where: { id: obsId },
      data: {
        texto: typeof texto === "string" ? texto : obs.texto,
        ...(esMovimiento && sectorNuevo ? { sectorNuevo } : {}),
      },
    });
    if (esMovimiento) await resyncSectorDesdeMovimientos(id);

    const actualizado = await prisma.expediente.findUnique({ where: { id }, include: INCLUDE_EXPEDIENTE });
    return NextResponse.json({ expediente: actualizado });
  }

  // ---------- Eliminar una observación / movimiento ya registrado ----------
  if (body.eliminarObservacion) {
    if (session.user.rol !== "admin") {
      return NextResponse.json({ error: "Solo el jefe de departamento puede eliminar observaciones" }, { status: 403 });
    }
    const { obsId } = body.eliminarObservacion;
    const obs = await prisma.observacion.findUnique({ where: { id: obsId } });
    if (!obs || obs.expedienteId !== id) {
      return NextResponse.json({ error: "Observación no encontrada" }, { status: 404 });
    }
    await prisma.observacion.delete({ where: { id: obsId } });
    if (obs.tipo === "movimiento") await resyncSectorDesdeMovimientos(id);

    const actualizado = await prisma.expediente.findUnique({ where: { id }, include: INCLUDE_EXPEDIENTE });
    return NextResponse.json({ expediente: actualizado });
  }

  // ---------- Activar una renovación como nuevo vigente ----------
  // La renovación pasa a rol "vigente" y el vigente anterior de la misma cadena
  // se degrada a "antecedente" / "Finalizado". Lógica de negocio sobre dos registros.
  if (body.activarRenovacion) {
    const renovacion = await prisma.expediente.findUnique({ where: { id } });
    if (!renovacion) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

    const vigenteAnterior = await prisma.expediente.findFirst({
      where: {
        cadenaId: renovacion.cadenaId,
        rol: "vigente",
        departamentoId: session.user.departamentoId,
        NOT: { id: renovacion.id },
      },
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

  // ---------- Activar la prórroga del vigente o de un parche ----------
  // Extiende fechaVencimiento del mismo expediente (no crea uno nuevo) y deja
  // una observación con el detalle del cambio. El legítimo abono nunca tiene
  // prórroga (ya viene forzado a false al crearlo/editarlo, pero se valida
  // de nuevo acá por las dudas).
  if (body.activarProrroga) {
    const exp = await prisma.expediente.findUnique({ where: { id } });
    if (!exp) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const puedeTenerProrroga = exp.rol === "vigente" || (exp.rol === "parche" && exp.tipoParche !== "Legítimo abono");
    if (!puedeTenerProrroga || !exp.tieneProrroga || exp.prorrogaActivada) {
      return NextResponse.json({ error: "Este expediente no tiene una prórroga disponible para activar" }, { status: 400 });
    }
    const nuevaFecha = new Date(body.activarProrroga.nuevaFechaVencimiento);
    const maxFecha = new Date(exp.fechaVencimiento);
    maxFecha.setMonth(maxFecha.getMonth() + Math.max(...PRORROGA_MESES_OPCIONES));
    if (!(nuevaFecha > exp.fechaVencimiento) || nuevaFecha > maxFecha) {
      return NextResponse.json({ error: "La prórroga no puede superar los " + Math.max(...PRORROGA_MESES_OPCIONES) + " meses" }, { status: 400 });
    }
    const fechaNotificacionProrroga = body.activarProrroga.fechaNotificacionProrroga
      ? new Date(body.activarProrroga.fechaNotificacionProrroga)
      : null;
    const actualizado = await prisma.expediente.update({
      where: { id },
      data: {
        prorrogaActivada: true,
        fechaVencimiento: nuevaFecha,
        fechaNotificacionProrroga,
        observaciones: {
          create: {
            usuario: session.user.name,
            tipo: "general",
            texto: "Prórroga activada: vencimiento extendido de " + exp.fechaVencimiento.toISOString().slice(0, 10) +
              " a " + nuevaFecha.toISOString().slice(0, 10) + ".",
          },
        },
      },
      include: INCLUDE_EXPEDIENTE,
    });

    // Si ya hay una renovación en trámite en la misma cadena, su período deja
    // de ser correlativo (la prórroga corrió la cobertura) — se corre para
    // que arranque justo al día siguiente, conservando la duración que tenía
    // planificada. Mismo ajuste que se hace al generar un parche nuevo.
    const renovacionEnTramite = await prisma.expediente.findFirst({
      where: { cadenaId: exp.cadenaId, rol: "renovacion", departamentoId: session.user.departamentoId },
    });
    if (renovacionEnTramite) {
      const nuevaFechaInicio = new Date(nuevaFecha);
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

    return NextResponse.json({ expediente: actualizado });
  }

  // ---------- Reunificar / separar una división ----------
  // Solo aplica a un expediente que salió de otro por "Dividir expediente"
  // (tiene divisionDeId). Reunificar no fusiona filas: solo marca que sus
  // períodos ya coinciden con los del expediente de origen y por eso se
  // muestran vinculados en la interfaz.
  if (body.reunificar !== undefined) {
    const exp = await prisma.expediente.findUnique({ where: { id } });
    if (!exp) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    if (!exp.divisionDeId) {
      return NextResponse.json({ error: "Este expediente no proviene de una división" }, { status: 400 });
    }
    if (body.reunificar) {
      const origen = await prisma.expediente.findUnique({ where: { id: exp.divisionDeId } });
      const fechaInicioIgual = (exp.fechaInicio?.getTime() ?? null) === (origen?.fechaInicio?.getTime() ?? null);
      const fechaVencimientoIgual = exp.fechaVencimiento.getTime() === origen?.fechaVencimiento.getTime();
      if (!origen || !fechaInicioIgual || !fechaVencimientoIgual) {
        return NextResponse.json({ error: "Los períodos no coinciden todavía — no se puede reunificar" }, { status: 400 });
      }
    }
    const actualizado = await prisma.expediente.update({
      where: { id },
      data: { unificado: !!body.reunificar },
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

  // La contratación de policía adicional es exclusiva de Informática y Varios.
  const puedePoliciaAdicional = session.user.departamentoSlug === "informatica-y-varios";
  const esPoliciaAdicionalPedido = puedePoliciaAdicional && body.esPoliciaAdicional === true;
  // El legítimo abono nunca lleva OC ni resoluciones de llamado/adjudicación.
  const esLegitimoAbono = body.tipoParche === "Legítimo abono";

  // ---------- Edición normal de campos del expediente ----------
  const actualizado = await prisma.expediente.update({
    where: { id },
    data: {
      exp: body.exp,
      nombreCorto: body.nombreCorto ?? undefined,
      nroContratacion: body.nroContratacion ?? undefined,
      nroResolucion: body.nroResolucion ?? undefined,
      area: body.area || null,
      tipo: body.tipo,
      agente: body.agente,
      organismos: Array.isArray(body.organismos)
        ? body.organismos.map((o) => String(o).trim()).filter(Boolean)
        : undefined,
      objeto: body.objeto,
      encuadre: esPoliciaAdicionalPedido ? ENCUADRE_INTERADMINISTRATIVO : (body.encuadre ?? undefined),
      presupuestoOficial: body.presupuestoOficial != null ? Number(body.presupuestoOficial) || 0 : undefined,
      montoARS: Number(body.montoARS) || 0,
      montoUSD: Number(body.montoUSD) || 0,
      esPoliciaAdicional: typeof body.esPoliciaAdicional === "boolean" ? (puedePoliciaAdicional && body.esPoliciaAdicional) : undefined,
      fuerzaSeguridad: esPoliciaAdicionalPedido
        ? (body.fuerzaSeguridad || null)
        : body.esPoliciaAdicional === false ? null : undefined,
      fechaInicio: body.fechaInicio ? new Date(body.fechaInicio) : null,
      fechaVencimiento: body.fechaVencimiento ? new Date(body.fechaVencimiento) : undefined,
      fechaPublicacion: body.fechaPublicacion ? new Date(body.fechaPublicacion) : null,
      fechaApertura: body.fechaApertura ? new Date(body.fechaApertura) : null,
      ocResolucion: esLegitimoAbono ? null : (body.ocResolucion ?? undefined),
      resolucionLlamado: esLegitimoAbono ? null : (body.resolucionLlamado ?? undefined),
      resolucionAdjudicacion: esLegitimoAbono ? null : (body.resolucionAdjudicacion ?? undefined),
      adjudicatario: body.adjudicatario ?? undefined,
      sector: body.sector ?? undefined,
      etapa: body.etapa ?? undefined,
      estadoGeneral: body.estadoGeneral,
      fuero: Array.isArray(body.fuero)
        ? body.fuero.map((f) => String(f).trim()).filter(Boolean)
        : undefined,
      zona: body.zona ?? undefined,
      codigoInterno: body.codigoInterno ?? undefined,
      estadoConvocatoria: body.estadoConvocatoria ?? undefined,
      tieneProrroga: esLegitimoAbono ? false : (typeof body.tieneProrroga === "boolean" ? body.tieneProrroga : undefined),
      tipoParche: body.tipoParche ?? undefined,
      detalleParche: body.detalleParche ?? undefined,
      domiciliosRenglones: Array.isArray(body.domiciliosRenglones)
        ? body.domiciliosRenglones.map((v) => String(v).trim()).filter(Boolean)
        : undefined,
    },
    include: INCLUDE_EXPEDIENTE,
  });

  return NextResponse.json({ expediente: actualizado });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  // Solo el jefe de departamento (admin) puede eliminar expedientes.
  if (!session || session.user.rol !== "admin") {
    return NextResponse.json({ error: "Solo el jefe de departamento puede eliminar expedientes" }, { status: 403 });
  }

  const { count } = await prisma.expediente.deleteMany({
    where: { id, departamentoId: session.user.departamentoId },
  });
  if (count === 0) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
