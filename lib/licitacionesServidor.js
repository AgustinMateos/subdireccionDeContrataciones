// Solo servidor: acceso y consultas del sistema de Licitaciones.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { EMAIL_JEFA_SUBDIRECCION } from "./resoluciones";
import { SLUG_LICITACIONES, agentePorJurisdiccion } from "./licitaciones";
import { hoyArgentina } from "./utils";

export { conPlanObras } from "./resolucionesServidor";

export const INCLUDE_LICITACION = { movimientos: { orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }] } };

// La sesión si es del departamento de Licitaciones o de la jefa de la
// Subdirección; si no, null.
export async function sesionLicitaciones() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session.user.departamentoSlug === SLUG_LICITACIONES || session.user.email === EMAIL_JEFA_SUBDIRECCION ? session : null;
}

// Campos cuyos cambios quedan en el historial del expediente.
const CAMPOS_HISTORIAL = {
  sector: "Sector",
  estadoInterno: "Estado interno",
  estadoConvocatoria: "Estado convocatoria",
  agente: "Agente",
  observaciones: "Observaciones",
};

// Hoy como fecha pura (medianoche UTC), igual que las fechas cargadas.
function hoy() {
  return new Date(hoyArgentina().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

// Un registro por cada campo de CAMPOS_HISTORIAL que cambia entre
// `anterior` (null en un alta) y `nuevos`, con el día de hoy.
export function registrosDeCambiosLicitacion(anterior, nuevos, usuario) {
  const fecha = hoy();
  return Object.entries(CAMPOS_HISTORIAL)
    .filter(([k]) => k in nuevos && (nuevos[k] || null) !== (anterior?.[k] || null))
    .filter(([k]) => anterior || nuevos[k])
    .map(([k, campo]) => ({
      fecha,
      campo,
      anterior: anterior?.[k] || null,
      valor: nuevos[k] || "Sin definir",
      usuario,
    }));
}

// En un alta sin agente, se asigna el que atiende la jurisdicción.
export function conAgentePorJurisdiccion(datos) {
  if (datos.agente) return datos;
  const agente = agentePorJurisdiccion(datos.jurisdiccion);
  return agente ? { ...datos, agente } : datos;
}
