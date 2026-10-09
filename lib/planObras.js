// Plan de Obras de la jefa de la Subdirección (sección propia del navbar
// de Resoluciones). Los campos son texto libre con estas sugerencias,
// sacadas de su planilla.

export const ANIO_PLAN_OBRAS = 2026;

export const ESTADOS_OBRA = [
  "Confección de Pliego de Bases y Condiciones",
  "Proyecto de convocatoria",
  "Confección de proyecto de resolución de convocatoria",
  "Convocatoria (difusión/apertura)",
  "Evaluación de ofertas",
  "Proyecto de adjudicación del procedimiento",
  "Proyecto de fracaso/desierto del procedimiento",
  "Obra concluída",
];

export const ENCUADRES_OBRA = [
  "Contratación Directa", "Contratación Descentralizada", "Trámite SImplificado", "Licitación Privada",
  "Licitación Pública (RCCM)", "Obra Pública", "Sin definir",
];

export const DEPENDENCIAS_OBRA = [
  "SDC", "SAJ", "Comisión de Preadjudicaciones", "DGIJ", "AG", "CIJ", "DGAF", "Unidad requirente",
];

function texto(valor) {
  const t = String(valor ?? "").trim();
  return t || null;
}

function fecha(valor) {
  if (!valor) return null;
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? null : f;
}

// Datos editables de una obra, tal como llegan del formulario.
export function datosObra(body) {
  return {
    expediente: texto(body.expediente),
    camara: String(body.camara || "").trim(),
    destino: texto(body.destino),
    objeto: String(body.objeto || "").trim(),
    monto: texto(body.monto),
    encuadre: texto(body.encuadre),
    estado: texto(body.estado),
    fechaUltimoMov: fecha(body.fechaUltimoMov),
    dependenciaActual: texto(body.dependenciaActual),
    ordenCompra: texto(body.ordenCompra),
    fechaNotificacionOC: fecha(body.fechaNotificacionOC),
    plazoEjecucion: texto(body.plazoEjecucion),
    observaciones: texto(body.observaciones),
  };
}
