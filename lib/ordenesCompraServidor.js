// Solo servidor: acceso y consultas del sistema de Órdenes de Compra.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { EMAIL_JEFA_SUBDIRECCION } from "./resoluciones";
import { SLUG_ORDENES_COMPRA } from "./ordenesCompra";
import { hoyArgentina } from "./utils";

export { conPlanObras } from "./resolucionesServidor";

export const INCLUDE_ORDEN_COMPRA = { movimientos: { orderBy: [{ fecha: "asc" }, { creadoEn: "asc" }] } };

// La sesión si es del departamento de Órdenes de Compra o de la jefa de la
// Subdirección; si no, null.
export async function sesionOrdenesCompra() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session.user.departamentoSlug === SLUG_ORDENES_COMPRA || session.user.email === EMAIL_JEFA_SUBDIRECCION ? session : null;
}

// Campos cuyos cambios quedan en el historial de la orden.
const CAMPOS_HISTORIAL = {
  estado: "Estado",
  pase: "Pase",
  notificacion44: "Notif. art. 44",
  contabilidad: "Contabilidad",
  controlada: "Controlada",
  firmaSol: "A la firma",
  notificada: "OC notificada",
  informe: "Informe",
  agente: "Agente",
  observaciones: "Observaciones",
};

// Hoy como fecha pura (medianoche UTC), igual que las fechas cargadas.
export function hoy() {
  return new Date(hoyArgentina().toISOString().slice(0, 10) + "T00:00:00.000Z");
}

// Un registro por cada campo de CAMPOS_HISTORIAL que cambia entre
// `anterior` (null en un alta) y `nuevos`, con el día de hoy.
export function registrosDeCambiosOrdenCompra(anterior, nuevos, usuario) {
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
