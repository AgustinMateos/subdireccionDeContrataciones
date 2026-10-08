// Solo servidor: acceso y consultas del sistema de Resoluciones.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { SLUG_RESOLUCIONES } from "./resoluciones";
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
