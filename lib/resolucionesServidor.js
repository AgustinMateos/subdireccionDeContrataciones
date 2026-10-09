// Solo servidor: acceso y consultas del sistema de Resoluciones.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { SLUG_RESOLUCIONES, EMAIL_JEFA_SUBDIRECCION, esCompletado } from "./resoluciones";
import { FERIADOS_2026 } from "./constants";
import { hoyArgentina } from "./utils";
import { ANIO_PLAN_OBRAS } from "./planObras";

export const INCLUDE_RESOLUCION = { movimientos: { orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }] } };

// La sesión si es de un usuario de Resoluciones; si no, null.
export async function sesionResoluciones() {
  const session = await getServerSession(authOptions);
  return session?.user.departamentoSlug === SLUG_RESOLUCIONES ? session : null;
}

// Campos cuyos cambios quedan en el historial del expediente.
const CAMPOS_HISTORIAL = {
  sectorActual: "Sector actual",
  tipoResolucion: "Tipo de resolución",
  estado: "Estado",
  observaciones: "Observaciones",
};

// N° de expediente para comparar entre planillas: sin espacios, en mayúsculas.
const normExp = s => String(s || "").replace(/\s/g, "").toUpperCase();

// Agrega `enPlanObras` a cada expediente (uno o una lista): si su N° está
// en el Plan de Obras del año. No se guarda: así sigue al plan solo.
export async function conPlanObras(prisma, expedientes) {
  const obras = await prisma.obraPlan.findMany({ where: { anio: ANIO_PLAN_OBRAS, expediente: { not: null } }, select: { expediente: true } });
  const enPlan = new Set(obras.map(o => normExp(o.expediente)));
  const marcar = e => ({ ...e, enPlanObras: enPlan.has(normExp(e.exp)) });
  return Array.isArray(expedientes) ? expedientes.map(marcar) : marcar(expedientes);
}

// Hoy como fecha pura (medianoche UTC), igual que las fechas cargadas.
function hoy() {
  return new Date(hoyArgentina().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

// Un completado que vuelve a otro estado reingresa al sector: los días en
// sector vuelven a correr desde hoy. Devuelve `nuevos` con la fecha del
// último movimiento puesta en hoy si corresponde.
export function conContadorReactivado(anterior, nuevos) {
  if (!anterior || !("estado" in nuevos) || !esCompletado(anterior) || esCompletado(nuevos)) return nuevos;
  return { ...nuevos, fechaUltimoMov: hoy() };
}

// Un registro por cada campo de CAMPOS_HISTORIAL que cambia entre
// `anterior` (null en un alta) y `nuevos`, con el día de hoy. No toca
// fechaUltimoMov: esa fecha la carga la gente a mano.
export function registrosDeCambios(anterior, nuevos, usuario) {
  const fecha = hoy();
  return Object.entries(CAMPOS_HISTORIAL)
    .filter(([k]) => k in nuevos && (nuevos[k] || null) !== (anterior?.[k] || null))
    .filter(([k]) => anterior || nuevos[k])
    .map(([k, campo]) => ({
      fecha,
      campo,
      sectorAnterior: anterior?.[k] || null,
      sector: nuevos[k] || "Sin definir",
      usuario,
    }));
}

// ---------- Avisos a Resoluciones de lo que hace la jefa ----------

const CAMPOS_AVISO = {
  exp: "Exp.",
  fechaIngreso: "Ingreso al sector",
  objeto: "Objeto",
  fuero: "Fuero",
  organismo: "Organismo",
  tipoContratacion: "Tipo de contratación",
  numero: "Número",
  tipoResolucion: "Tipo de resolución",
  estado: "Estado",
  sectorActual: "Sector actual",
  fechaUltimoMov: "Último movimiento",
  agente: "Agente",
  vencOfertas: "Venc. ofertas",
  inicioServicio: "Inicio de servicio",
  montos: "Montos",
  observaciones: "Observaciones",
  renovacionAutomatica: "Renovación automática",
  renovacionDias: "Días de renovación",
  renovacionHabiles: "Renovación en días hábiles",
  prioritario: "Prioritario",
};

// Valor legible para el aviso (fechas puras como dd/mm/aaaa).
function legible(valor) {
  if (valor == null || valor === "") return null;
  if (valor instanceof Date) {
    const [a, m, d] = valor.toISOString().slice(0, 10).split("-");
    return Number(d) + "/" + Number(m) + "/" + a;
  }
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  return String(valor);
}

// [{ campo, anterior, nuevo }] de los campos de `nuevos` que cambian.
function describirCambios(anterior, nuevos) {
  return Object.entries(CAMPOS_AVISO)
    .filter(([k]) => k in nuevos)
    .map(([k, campo]) => ({ campo, anterior: legible(anterior?.[k] ?? null), nuevo: legible(nuevos[k]) }))
    .filter(c => c.anterior !== c.nuevo && (anterior || c.nuevo));
}

// Si quien hizo el cambio es la jefa de la Subdirección, deja un aviso
// para Resoluciones con el expediente y lo que cambió. `anterior` es null
// en un alta; `expediente` es como quedó.
export async function avisarSiEsJefa(prisma, session, anterior, nuevos, expediente) {
  if (session.user.email !== EMAIL_JEFA_SUBDIRECCION) return;
  const cambios = describirCambios(anterior, nuevos);
  if (anterior && cambios.length === 0) return;
  await prisma.notificacionResolucion.create({
    data: {
      expedienteId: expediente.id,
      exp: expediente.exp,
      objeto: expediente.objeto,
      accion: anterior ? "modificacion" : "alta",
      cambios: anterior ? cambios : cambios.filter(c => c.campo !== "Exp." && c.campo !== "Objeto"),
      prioritario: !!expediente.prioritario,
      creadoPor: session.user.name,
    },
  });
}

// ---------- Renovación automática del vencimiento de ofertas ----------

const USUARIO_RENOVACION = "Renovación automática";
const FERIADOS = new Set(FERIADOS_2026);

// `fecha` (fecha pura, medianoche UTC) más `dias` días corridos, o hábiles
// (sin sábados, domingos ni feriados).
function sumarDias(fecha, dias, habiles) {
  const f = new Date(fecha);
  let resto = dias;
  while (resto > 0) {
    f.setUTCDate(f.getUTCDate() + 1);
    const dia = f.getUTCDay();
    if (!habiles || (dia !== 0 && dia !== 6 && !FERIADOS.has(f.toISOString().slice(0, 10)))) resto--;
  }
  return f;
}

export function describirPeriodo(dias, habiles) {
  return dias + " día" + (dias !== 1 ? "s" : "") + " " + (habiles ? "hábil" + (dias !== 1 ? "es" : "") : "corrido" + (dias !== 1 ? "s" : ""));
}

// Renueva los vencimientos de ofertas ya pasados de los expedientes con
// renovación automática (salvo los completados): corre la fecha tantos
// períodos como haga falta para que no quede vencida, deja un registro en
// el historial por cada renovación y un aviso en la campana. Si dos
// pedidos llegan juntos, solo uno renueva (se actualiza solo si la fecha
// sigue siendo la que se leyó).
export async function aplicarRenovaciones(prisma) {
  const hoyUTC = hoy();
  const vencidos = await prisma.expedienteResolucion.findMany({
    where: { renovacionAutomatica: true, renovacionDias: { gt: 0 }, vencOfertas: { lt: hoyUTC } },
  });
  for (const e of vencidos) {
    if (esCompletado(e)) continue;
    const periodo = describirPeriodo(e.renovacionDias, e.renovacionHabiles);
    const registros = [];
    let venc = e.vencOfertas;
    while (venc < hoyUTC) {
      const nuevo = sumarDias(venc, e.renovacionDias, e.renovacionHabiles);
      registros.push({
        // El día en que venció, aunque se registre después.
        fecha: venc,
        campo: "Venc. ofertas",
        sectorAnterior: legible(venc),
        sector: legible(nuevo) + " (renovación automática: " + periodo + ")",
        usuario: USUARIO_RENOVACION,
      });
      venc = nuevo;
    }
    const { count } = await prisma.expedienteResolucion.updateMany({
      where: { id: e.id, vencOfertas: e.vencOfertas },
      data: { vencOfertas: venc },
    });
    if (count === 0) continue;
    await prisma.movimientoResolucion.createMany({ data: registros.map(r => ({ ...r, expedienteId: e.id })) });
    await prisma.notificacionResolucion.create({
      data: {
        expedienteId: e.id,
        exp: e.exp,
        objeto: e.objeto,
        accion: "renovacion",
        cambios: [{ campo: "Venc. ofertas (" + periodo + ")", anterior: legible(e.vencOfertas), nuevo: legible(venc) }],
        prioritario: !!e.prioritario,
        creadoPor: USUARIO_RENOVACION,
      },
    });
  }
}
