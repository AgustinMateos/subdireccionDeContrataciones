// Solo servidor: acceso y consultas del sistema de Resoluciones.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { SLUG_RESOLUCIONES, EMAIL_JEFA_SUBDIRECCION, esFinalizado } from "./resoluciones";
import { sumarDiasHabiles } from "./diasHabiles";
import { normalizarExp } from "./numeroExpediente";
import { feriadosDe } from "./feriados";
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
  situacion: "Estado gral.",
  observaciones: "Observaciones",
};

// N° de expediente para comparar entre planillas: sin espacios, en mayúsculas.
const normExp = s => normalizarExp(String(s || "")).replace(/\s/g, "").toUpperCase();

// Agrega `enPlanObras` a cada expediente (uno o una lista): si su N° está
// en el Plan de Obras del año. No se guarda: así sigue al plan solo.
export async function conPlanObras(prisma, expedientes) {
  const obras = await prisma.obraPlan.findMany({ where: { anio: ANIO_PLAN_OBRAS, expediente: { not: null } }, select: { expediente: true } });
  const enPlan = new Set(obras.map(o => normExp(o.expediente)));
  const marcar = e => ({ ...e, enPlanObras: enPlan.has(normExp(e.exp)) });
  return Array.isArray(expedientes) ? expedientes.map(marcar) : marcar(expedientes);
}

// Hoy como fecha pura (medianoche UTC), igual que las fechas cargadas.
export function hoy() {
  return new Date(hoyArgentina().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

// N° romano para los reingresos (I, II, III, IV...).
const ROMANOS = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function romano(n) {
  let resto = n, texto = "";
  for (const [valor, letras] of ROMANOS) while (resto >= valor) { texto += letras; resto -= valor; }
  return texto;
}

export const PREFIJO_REINGRESO = "REINGRESO ";

// Un finalizado que vuelve a Tramitando. Al cambiarlo se le
// pregunta a quien lo hace si es un reingreso (`reingreso`):
//  - true: reingresó. La fecha de ingreso al sector y el último movimiento
//    pasan a ser hoy, y la observación, "REINGRESO I" (II, III... según los
//    que ya tuvo) con los datos que cambiaron (tipo de contratación,
//    número, ingreso al sector...: de cuál a cuál) y, a continuación, la
//    que se haya escrito en el mismo cambio. Queda en el historial.
//  - false: fue un error de clic. Vuelve sin constancia ni cambio de fechas.
//  - sin respuesta: como antes, se reactiva (último movimiento hoy).
export async function conReingreso(prisma, anterior, nuevos, reingreso) {
  if (!anterior || !("situacion" in nuevos) || !esFinalizado(anterior) || esFinalizado(nuevos)) return nuevos;
  if (reingreso === false) return nuevos;
  const reactivado = { ...nuevos, fechaUltimoMov: hoy() };
  if (reingreso !== true) return reactivado;
  const previos = await prisma.movimientoResolucion.count({
    where: { expedienteId: anterior.id, campo: "Observaciones", sector: { startsWith: PREFIJO_REINGRESO } },
  });
  const reingresado = { ...reactivado, fechaIngreso: hoy() };
  // Sector, tipo de resolución, estado y estado gral. ya tienen su propio
  // registro en el historial; el último movimiento es automático.
  const sinDetalle = [...Object.values(CAMPOS_HISTORIAL), CAMPOS_AVISO.fechaUltimoMov];
  const cambios = describirCambios(anterior, reingresado).filter(c => !sinDetalle.includes(c.campo))
    .map(c => c.campo + ": " + (c.anterior ?? "-") + " → " + (c.nuevo ?? "-"));
  const escrita = "observaciones" in nuevos && nuevos.observaciones && nuevos.observaciones !== anterior.observaciones ? nuevos.observaciones : "";
  const observaciones = [PREFIJO_REINGRESO + romano(previos + 1), cambios.join("; "), escrita].filter(Boolean).join(". ");
  return { ...reingresado, observaciones };
}

// Constancia del préstamo en las observaciones (y así en el historial):
//  - se pone en préstamo o cambia el dictamen: "EN PRÉSTAMO - Dictamen N°
//    416/2026, vence el 26/10/2026";
//  - deja de estar en préstamo: "ESTUVO EN PRÉSTAMO - Dictamen N° 416/2026,
//    del 22/10/2026 al 26/10/2026 (4 días)". Si fue porque se mandó a
//    Aperturas, el préstamo termina solo y se agrega "Volvió a Aperturas".
// A continuación va la observación que se haya escrito en el mismo cambio.
export async function conPrestamo(prisma, anterior, nuevos) {
  const vuelve = anterior?.enPrestamo && "sectorActual" in nuevos && esAperturas(nuevos.sectorActual) && !esAperturas(anterior.sectorActual);
  if (vuelve) nuevos = { ...nuevos, enPrestamo: false, dictamenNumero: null, dictamenVence: null };
  nuevos = await conIngresoTrasPrestamo(prisma, anterior, nuevos);
  if (!("enPrestamo" in nuevos)) return nuevos;
  const constancia = await textoPrestamo(prisma, anterior, nuevos, vuelve);
  if (!constancia) return nuevos;
  const escrita = nuevos.observaciones && nuevos.observaciones !== anterior?.observaciones ? nuevos.observaciones : "";
  return { ...nuevos, observaciones: [constancia, escrita].filter(Boolean).join(". ") };
}

const esAperturas = sector => String(sector || "").trim().toUpperCase() === "APERTURAS";
const PREFIJO_PRESTAMO = "EN PRÉSTAMO";
const PREFIJO_FIN_PRESTAMO = "ESTUVO EN PRÉSTAMO";

async function textoPrestamo(prisma, anterior, nuevos, vuelve) {
  const dictamen = n => "Dictamen N° " + (n || "-");
  if (nuevos.enPrestamo) {
    const igual = anterior?.enPrestamo && anterior.dictamenNumero === nuevos.dictamenNumero
      && legible(anterior.dictamenVence) === legible(nuevos.dictamenVence);
    return igual ? "" : PREFIJO_PRESTAMO + " - " + dictamen(nuevos.dictamenNumero) + ", vence el " + legible(nuevos.dictamenVence);
  }
  if (!anterior?.enPrestamo) return "";
  const desde = await inicioDelPrestamo(prisma, anterior);
  const hasta = nuevos.fechaUltimoMov && vuelve ? new Date(nuevos.fechaUltimoMov) : hoy();
  const dias = desde ? Math.max(0, Math.round((hasta - desde) / 86400000)) : null;
  const periodo = desde ? ", del " + legible(desde) + " al " + legible(hasta) + " (" + dias + (dias === 1 ? " día)" : " días)") : "";
  return PREFIJO_FIN_PRESTAMO + " - " + dictamen(anterior.dictamenNumero) + periodo + (vuelve ? ". Volvió a Aperturas" : "");
}

// Día en que empezó el préstamo actual: la primera constancia "EN
// PRÉSTAMO" después del último "ESTUVO EN PRÉSTAMO". Si no hay constancia
// (préstamos cargados antes de que existiera), el ingreso al sector.
async function inicioDelPrestamo(prisma, anterior) {
  const constancias = await prisma.movimientoResolucion.findMany({
    where: { expedienteId: anterior.id, campo: "Observaciones", OR: [{ sector: { startsWith: PREFIJO_PRESTAMO } }, { sector: { startsWith: PREFIJO_FIN_PRESTAMO } }] },
    orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }],
    select: { fecha: true, sector: true },
  });
  let inicio = null;
  for (const c of constancias) {
    if (c.sector.startsWith(PREFIJO_FIN_PRESTAMO)) inicio = null;
    else if (!inicio) inicio = c.fecha;
  }
  return inicio || anterior.fechaIngreso || null;
}

const PREFIJO_INGRESO = "INGRESO AL SECTOR";
const esResoluciones = sector => String(sector || "").trim().toUpperCase() === "RESOLUCIONES";

// Vino en préstamo, el préstamo terminó (volvió a Aperturas) y después
// entra a Resoluciones: ese es el ingreso efectivo al sector, no un
// reingreso. La fecha de ingreso pasa a ser la del último movimiento (hoy,
// o la cargada a mano) y queda la constancia "INGRESO AL SECTOR - Después
// del préstamo (Dictamen N° 416/2026). Ingreso al sector: 22/10/2026 →
// 27/10/2026". Solo una vez por préstamo: la primera entrada después del
// último "ESTUVO EN PRÉSTAMO".
async function conIngresoTrasPrestamo(prisma, anterior, nuevos) {
  if (!anterior || !("sectorActual" in nuevos) || !esResoluciones(nuevos.sectorActual) || esResoluciones(anterior.sectorActual)) return nuevos;
  if (anterior.enPrestamo || nuevos.enPrestamo) return nuevos;
  const ultima = await prisma.movimientoResolucion.findFirst({
    where: { expedienteId: anterior.id, campo: "Observaciones", OR: [PREFIJO_PRESTAMO, PREFIJO_FIN_PRESTAMO, PREFIJO_INGRESO].map(p => ({ sector: { startsWith: p } })) },
    orderBy: [{ fecha: "desc" }, { creadoEn: "desc" }],
    select: { sector: true },
  });
  if (!ultima?.sector.startsWith(PREFIJO_FIN_PRESTAMO)) return nuevos;
  const fechaIngreso = nuevos.fechaUltimoMov ? new Date(nuevos.fechaUltimoMov) : hoy();
  const dictamen = ultima.sector.match(/Dictamen N° ([^,.\s]+)/)?.[1];
  const constancia = PREFIJO_INGRESO + " - Después del préstamo" + (dictamen && dictamen !== "-" ? " (Dictamen N° " + dictamen + ")" : "")
    + ". Ingreso al sector: " + (legible(anterior.fechaIngreso) ?? "-") + " → " + legible(fechaIngreso);
  const escrita = nuevos.observaciones && nuevos.observaciones !== anterior.observaciones ? nuevos.observaciones : "";
  return { ...nuevos, fechaIngreso, observaciones: [constancia, escrita].filter(Boolean).join(". ") };
}

// Si cambia el sector actual, el último movimiento pasa a ser hoy (de ahí
// corren los días en el sector), salvo que en el mismo cambio se haya
// cargado otra fecha a mano. (En un alta, la fecha es siempre la de hoy:
// ver la ruta de alta.)
export function conUltimoMovPorSector(anterior, nuevos) {
  if (!("sectorActual" in nuevos) || !nuevos.sectorActual) return nuevos;
  if ((nuevos.sectorActual || null) === (anterior?.sectorActual || null)) return nuevos;
  const fechaAnterior = anterior?.fechaUltimoMov ? new Date(anterior.fechaUltimoMov).getTime() : null;
  const fechaNueva = nuevos.fechaUltimoMov ? new Date(nuevos.fechaUltimoMov).getTime() : null;
  const cargadaAMano = "fechaUltimoMov" in nuevos && fechaNueva !== null && fechaNueva !== fechaAnterior;
  return cargadaAMano ? nuevos : { ...nuevos, fechaUltimoMov: hoy() };
}

// Un registro por cada campo de CAMPOS_HISTORIAL que cambia entre
// `anterior` (null en un alta) y `nuevos`, con el día de hoy.
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
  autorizaTipo: "Autoriza (tipo de contratación)",
  autorizaNumero: "Autoriza (número)",
  estado: "Estado",
  situacion: "Estado gral.",
  sectorActual: "Sector actual",
  fechaUltimoMov: "Último movimiento",
  agente: "Agente",
  vencOfertas: "Venc. ofertas",
  enPrestamo: "En préstamo",
  dictamenNumero: "N° de dictamen",
  dictamenVence: "Vence el dictamen",
  inicioServicio: "Inicio de servicio",
  montos: "Montos",
  observaciones: "Observaciones",
  renovacionAutomatica: "Renovación automática",
  renovacionDias: "Días de renovación",
  renovacionHabiles: "Renovación en días hábiles",
  prioritario: "Prioritario",
  cantidadOfertas: "Cantidad de ofertas",
  cantidadRenglones: "Cantidad de renglones",
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
  // Si activó la renovación automática, eso va en su propio aviso.
  const renovacion = [CAMPOS_AVISO.renovacionAutomatica, CAMPOS_AVISO.renovacionDias, CAMPOS_AVISO.renovacionHabiles];
  const cambios = describirCambios(anterior, nuevos).filter(c => !activaRenovacion(anterior, expediente) || !renovacion.includes(c.campo));
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

// Cuando Resoluciones carga un expediente, le llega a la jefa de la
// Subdirección un aviso para asignarlo (Resoluciones no asigna agente).
export async function avisarJefaParaAsignar(prisma, session, expediente) {
  if (session.user.email === EMAIL_JEFA_SUBDIRECCION) return;
  await prisma.notificacionResolucion.create({
    data: {
      expedienteId: expediente.id,
      exp: expediente.exp,
      objeto: expediente.objeto,
      accion: "para-asignar",
      cambios: [
        { campo: "Fuero", anterior: null, nuevo: legible(expediente.fuero) },
        { campo: "Tipo de contratación", anterior: null, nuevo: legible(expediente.tipoContratacion) },
        { campo: "Tipo de resolución", anterior: null, nuevo: legible(expediente.tipoResolucion) },
        { campo: "Vencen las ofertas", anterior: null, nuevo: legible(expediente.vencOfertas) },
      ].filter(c => c.nuevo),
      prioritario: !!expediente.prioritario,
      creadoPor: session.user.name,
    },
  });
}

// Ya asignado: el aviso "para asignar" de ese expediente queda leído.
export async function marcarAsignado(prisma, expediente) {
  if (!expediente.agente) return;
  await prisma.notificacionResolucion.updateMany({
    where: { expedienteId: expediente.id, accion: "para-asignar", leida: false },
    data: { leida: true },
  });
}

// ---------- Vencimiento del dictamen de un expediente en préstamo ----------

// Cuando llega el día en que vence el dictamen de un expediente en
// préstamo (o ya pasó y no se avisó), llega un aviso a la campana de
// Resoluciones para devolverlo a Aperturas, que notifica si hubo o no
// impugnaciones. Un aviso por vencimiento: si se cambia la fecha, se vuelve
// a avisar el nuevo día. Como las renovaciones, se revisa en cada pedido
// de la planilla y de la campana.
export async function avisarDictamenesVencidos(prisma) {
  const vencidos = (await prisma.expedienteResolucion.findMany({
    where: { enPrestamo: true, dictamenVence: { lte: hoy() } },
  })).filter(e => !esFinalizado(e) && e.dictamenAvisado?.getTime() !== e.dictamenVence.getTime());
  for (const e of vencidos) {
    // Si dos pedidos llegan juntos, avisa uno solo.
    const { count } = await prisma.expedienteResolucion.updateMany({
      where: { id: e.id, dictamenVence: e.dictamenVence, OR: [{ dictamenAvisado: null }, { dictamenAvisado: { not: e.dictamenVence } }] },
      data: { dictamenAvisado: e.dictamenVence },
    });
    if (count === 0) continue;
    await prisma.notificacionResolucion.create({
      data: {
        expedienteId: e.id,
        exp: e.exp,
        objeto: e.objeto,
        accion: "dictamen-vence",
        cambios: [{ campo: "Dictamen N° " + (e.dictamenNumero || "-"), anterior: null, nuevo: "vence el " + legible(e.dictamenVence) }],
        prioritario: !!e.prioritario,
        creadoPor: "Vencimiento del dictamen",
      },
    });
  }
}

// ---------- Renovación automática del vencimiento de ofertas ----------

const activaRenovacion = (anterior, expediente) => !!expediente.renovacionAutomatica && !anterior?.renovacionAutomatica;

// Cuando la jefa activa la renovación automática (en un alta o al editar;
// solo ella puede), queda un aviso en la campana de Resoluciones con los
// días y el vencimiento.
export async function avisarSiActivaRenovacion(prisma, session, anterior, expediente) {
  if (!activaRenovacion(anterior, expediente)) return;
  await prisma.notificacionResolucion.create({
    data: {
      expedienteId: expediente.id,
      exp: expediente.exp,
      objeto: expediente.objeto,
      accion: "renovacion-activada",
      cambios: [
        expediente.renovacionDias > 0 && { campo: "Se renuevan por", anterior: null, nuevo: describirPeriodo(expediente.renovacionDias, expediente.renovacionHabiles) },
        { campo: "Vencen las ofertas", anterior: null, nuevo: legible(expediente.vencOfertas) || "sin fecha" },
      ].filter(Boolean),
      prioritario: !!expediente.prioritario,
      creadoPor: session.user.name,
    },
  });
}

const USUARIO_RENOVACION = "Renovación automática";
export const CAMPO_RENOVACION = "Renovación de ofertas";

// `fecha` (fecha pura, medianoche UTC) más `dias` días corridos, o hábiles:
// sin fines de semana, feriados nacionales (`feriados`, de ArgentinaDatos)
// ni inhábiles judiciales (24 y 31/12, 16/11), como en lib/diasHabiles.js.
function sumarDias(fecha, dias, habiles, feriados) {
  if (habiles) return new Date(sumarDiasHabiles(fecha.toISOString().slice(0, 10), dias, feriados) + "T00:00:00.000Z");
  const f = new Date(fecha);
  f.setUTCDate(f.getUTCDate() + dias);
  return f;
}

export function describirPeriodo(dias, habiles) {
  return dias + " día" + (dias !== 1 ? "s" : "") + " " + (habiles ? "hábil" + (dias !== 1 ? "es" : "") : "corrido" + (dias !== 1 ? "s" : ""));
}

// Renueva los vencimientos de ofertas ya pasados de los expedientes con
// renovación automática (salvo los finalizados): corre la fecha tantos
// períodos como haga falta para que no quede vencida, deja un registro en
// el historial por cada renovación (se lee en "Observaciones e
// historial") y un aviso en la campana. Si dos pedidos llegan juntos, solo
// uno renueva (se actualiza solo si la fecha sigue siendo la que se leyó).
// Si no se pueden traer los feriados, no se renueva nada: se reintenta en
// el próximo pedido, para no correr fechas con un calendario incompleto.
export async function aplicarRenovaciones(prisma) {
  const hoyUTC = hoy();
  const vencidos = (await prisma.expedienteResolucion.findMany({
    where: { renovacionAutomatica: true, renovacionDias: { gt: 0 }, vencOfertas: { lt: hoyUTC } },
  })).filter(e => !esFinalizado(e));
  if (!vencidos.length) return;
  let feriados = new Set();
  if (vencidos.some(e => e.renovacionHabiles)) {
    const desde = Math.min(...vencidos.map(e => e.vencOfertas.getUTCFullYear()));
    const anios = Array.from({ length: hoyUTC.getUTCFullYear() + 2 - desde }, (_, i) => desde + i);
    try {
      feriados = await feriadosDe(anios);
    } catch (err) {
      console.error("Renovación de ofertas pospuesta:", err.message);
      return;
    }
  }
  for (const e of vencidos) {
    const periodo = describirPeriodo(e.renovacionDias, e.renovacionHabiles);
    const registros = [];
    let venc = e.vencOfertas;
    while (venc < hoyUTC) {
      const nuevo = sumarDias(venc, e.renovacionDias, e.renovacionHabiles, feriados);
      registros.push({
        // El día en que venció, aunque se registre después.
        fecha: venc,
        campo: CAMPO_RENOVACION,
        sectorAnterior: legible(venc),
        sector: "Las ofertas vencían el " + legible(venc) + " y se renovaron solas por " + periodo + ": ahora vencen el " + legible(nuevo) + ".",
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
