// Solo servidor: acceso y cambios del Cuadro de Informática y Varios.

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { EMAIL_JEFA_SUBDIRECCION } from "./resoluciones";
import { SLUG_IYV, etiquetaCampoIyV, puedeEditarIyV, puedeEliminarIyV } from "./cuadroIyV";

export const INCLUDE_FILA_IYV = { movimientos: { orderBy: { fecha: "asc" } } };

// La sesión si es de Informática y Varios o de la jefa de la Subdirección
// (ella solo consulta); si no, null.
export async function sesionCuadroIyV() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  return session.user.departamentoSlug === SLUG_IYV || session.user.email === EMAIL_JEFA_SUBDIRECCION ? session : null;
}
export const puedeEditar = session => puedeEditarIyV(session?.user);
export const puedeEliminar = session => puedeEliminarIyV(session?.user);

// Un registro por cada campo que cambia entre `anterior` y `nuevos` (los
// datos completos de la fila). En un alta (anterior null), uno solo.
export function registrosDeCambiosIyV(hoja, anterior, nuevos, usuario) {
  if (!anterior) return [{ campo: "Alta", valor: "Fila cargada", usuario }];
  const claves = [...new Set([...Object.keys(anterior), ...Object.keys(nuevos)])];
  return claves
    .filter(k => (anterior[k] || "") !== (nuevos[k] || ""))
    .map(k => ({ campo: etiquetaCampoIyV(hoja, k), anterior: anterior[k] || null, valor: nuevos[k] || "(vacío)", usuario }));
}
