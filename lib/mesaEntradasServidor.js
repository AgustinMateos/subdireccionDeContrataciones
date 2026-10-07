// Solo servidor: datos de Mesa de Entradas que salen de otras tablas.

import { prisma } from "./prisma";
import { SECTOR_TRAMITA_POR_DEPARTAMENTO } from "./mesaEntradas";
import { hoyArgentina } from "./utils";

// Un expediente de un departamento "existe hoy" si está en curso: vigente,
// parche o renovación, sin finalizar ni archivar (los antecedentes son
// historia).
export const EN_CURSO = {
  rol: { in: ["vigente", "parche", "renovacion"] },
  estadoGeneral: { notIn: ["Finalizado", "Archivado"] },
};

// Mesa de Entradas lleva el control de los expedientes que existen hoy en
// los departamentos (Servicios, Informática y Varios): a cada uno que
// todavía no tenga su registro en Mesa se le crea, ya confirmado y
// vinculado, con su sector actual como primer movimiento.
export async function sincronizarConDepartamentos(mesaDepartamentoId) {
  const departamentos = await prisma.departamento.findMany({
    where: { slug: { in: Object.keys(SECTOR_TRAMITA_POR_DEPARTAMENTO) } },
    select: { id: true, slug: true, nombre: true },
  });
  if (departamentos.length === 0) return;
  const porId = Object.fromEntries(departamentos.map((d) => [d.id, d]));

  const [expedientes, yaVinculados] = await Promise.all([
    prisma.expediente.findMany({
      where: { departamentoId: { in: departamentos.map((d) => d.id) }, ...EN_CURSO },
      include: { observaciones: { where: { tipo: "movimiento" }, orderBy: { fecha: "desc" }, take: 1 } },
    }),
    prisma.expedienteMesa.findMany({
      where: { departamentoId: mesaDepartamentoId },
      select: { exp: true, expedienteId: true },
    }),
  ]);
  const vinculados = new Set(yaVinculados.map((m) => m.expedienteId).filter(Boolean));
  const numeros = new Set(yaVinculados.map((m) => m.exp));

  for (const e of expedientes) {
    // Si Mesa ya tiene ese N° (ej. lo caratuló y está por confirmarse), no
    // se duplica.
    if (vinculados.has(e.id) || numeros.has(e.exp)) continue;
    const depto = porId[e.departamentoId];
    const ultimoPase = e.observaciones[0];
    try {
      await prisma.expedienteMesa.create({
        data: {
          departamentoId: mesaDepartamentoId,
          exp: e.exp,
          objeto: e.objeto || "",
          agente: e.agente || null,
          sectorTramita: SECTOR_TRAMITA_POR_DEPARTAMENTO[depto.slug],
          tipo: e.tipo || null,
          zona: e.zona || null,
          fuero: e.fuero || [],
          organismos: e.organismos || [],
          domiciliosRenglones: e.domiciliosRenglones || [],
          fechaInicio: e.fechaInicio,
          fechaVencimiento: e.fechaVencimiento,
          confirmadoEn: new Date(),
          confirmadoPor: "Tomado de " + depto.nombre,
          expedienteId: e.id,
          movimientos: {
            create: [{
              fecha: ultimoPase ? ultimoPase.fecha : e.creadoEn,
              vieneDe: ultimoPase?.sectorAnterior || null,
              sector: e.sector || "Sin definir",
              observacion: "Tomado del expediente de " + depto.nombre + ".",
              usuario: "Sistema",
            }],
          },
        },
      });
      numeros.add(e.exp);
    } catch (err) {
      // Otro pedido lo creó al mismo tiempo.
      if (err.code !== "P2002") throw err;
    }
  }
}

// Si un expediente de un departamento lleva control de Mesa de Entradas:
// es de un departamento que Mesa sigue y está en curso. Sus pases de
// sector quedan pendientes de que Mesa los confirme.
export function controladoPorMesa(departamentoSlug, expediente) {
  return !!SECTOR_TRAMITA_POR_DEPARTAMENTO[departamentoSlug]
    && EN_CURSO.rol.in.includes(expediente.rol)
    && !EN_CURSO.estadoGeneral.notIn.includes(expediente.estadoGeneral);
}

// El registro de Mesa de un expediente de departamento: el vinculado o, si
// Mesa lo caratuló y todavía no se vinculó, el del mismo N°. Si no hay
// ninguno (el departamento lo cargó después del último listado de Mesa),
// se sincroniza y se vuelve a buscar.
export async function expedienteMesaDe(mesaDepartamentoId, expediente) {
  const buscar = () => prisma.expedienteMesa.findFirst({
    where: { departamentoId: mesaDepartamentoId, OR: [{ expedienteId: expediente.id }, { exp: expediente.exp }] },
    orderBy: { expedienteId: { sort: "asc", nulls: "last" } },
  });
  return (await buscar()) || (await sincronizarConDepartamentos(mesaDepartamentoId), await buscar());
}

// Constancia en la ficha del expediente del departamento de un movimiento
// que registró Mesa (ver Observacion.pendienteMesa en el schema). La fecha
// de Mesa es un día puro; se le pone la hora actual para que en el
// historial quede después de lo ya registrado ese día y para que el día no
// cambie al mostrarlo en hora local.
export function constanciaMesa(mov) {
  const dia = Date.UTC(mov.fecha.getUTCFullYear(), mov.fecha.getUTCMonth(), mov.fecha.getUTCDate());
  const hoy = hoyArgentina();
  const diasAtras = Math.round((Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) - dia) / 86400000);
  return {
    tipo: "mesa",
    fecha: new Date(Date.now() - diasAtras * 86400000),
    usuario: mov.usuario,
    sectorAnterior: mov.vieneDe,
    sectorNuevo: mov.sector + (mov.subsector ? " · " + mov.subsector : ""),
    texto: mov.observacion || "Movimiento registrado por Mesa de Entradas.",
  };
}

// Suma `tipoContratacionSector`: el encuadre que cargó el sector que tramita
// en su propio expediente (el vinculado al confirmar o al sincronizar).
// Mesa lo muestra cuando no cargó el tipo de contratación a mano. También
// marca `enCurso`: si el expediente vinculado ya no existe o se cerró.
export async function conDatosDelSector(expedientesMesa) {
  const ids = expedientesMesa.map((e) => e.expedienteId).filter(Boolean);
  const vinculados = ids.length
    ? await prisma.expediente.findMany({ where: { id: { in: ids } }, select: { id: true, encuadre: true, rol: true, estadoGeneral: true } })
    : [];
  const porId = Object.fromEntries(vinculados.map((e) => [e.id, e]));
  return expedientesMesa.map((e) => {
    const vinculado = e.expedienteId ? porId[e.expedienteId] : null;
    const enCurso = !e.expedienteId || (!!vinculado
      && ["vigente", "parche", "renovacion"].includes(vinculado.rol)
      && !["Finalizado", "Archivado"].includes(vinculado.estadoGeneral));
    return { ...e, tipoContratacionSector: vinculado?.encuadre || null, enCurso };
  });
}
