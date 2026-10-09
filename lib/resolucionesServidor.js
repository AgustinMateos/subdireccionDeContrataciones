// Solo servidor: acceso y consultas del sistema de Resoluciones.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { SLUG_RESOLUCIONES, EMAIL_JEFA_SUBDIRECCION } from "./resoluciones";
import { hoyArgentina } from "./utils";

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
};

// Un registro por cada campo de CAMPOS_HISTORIAL que cambia entre
// `anterior` (null en un alta) y `nuevos`, con el día de hoy. No toca
// fechaUltimoMov: esa fecha la carga la gente a mano.
export function registrosDeCambios(anterior, nuevos, usuario) {
  const fecha = new Date(hoyArgentina().toISOString().slice(0, 10) + "T00:00:00.000Z");
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
  situacion: "Situación",
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
