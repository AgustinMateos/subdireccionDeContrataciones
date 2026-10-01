// Solo servidor: datos de Mesa de Entradas que salen de otras tablas.

import { prisma } from "./prisma";

// Suma `tipoContratacionSector`: el encuadre que cargó el sector que tramita
// en su propio expediente (el que se creó al confirmar la carga de Mesa).
// Mesa lo muestra cuando no cargó el tipo de contratación a mano.
export async function conDatosDelSector(expedientesMesa) {
  const ids = expedientesMesa.map((e) => e.expedienteId).filter(Boolean);
  const encuadres = ids.length
    ? await prisma.expediente.findMany({ where: { id: { in: ids } }, select: { id: true, encuadre: true } })
    : [];
  const porId = Object.fromEntries(encuadres.map((e) => [e.id, e.encuadre]));
  return expedientesMesa.map((e) => ({ ...e, tipoContratacionSector: (e.expedienteId && porId[e.expedienteId]) || null }));
}
