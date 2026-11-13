// Resolución de la convocatoria (cómo terminó): etiqueta compartida por
// Licitaciones y el Cuadro de Informática y Varios. Sin dependencias.
export const RESOLUCIONES_CONV = ["Adjudicada", "Adjudicación parcial", "Sin efecto", "Desierta", "Fracasada", "Fracasa / Autoriza", "Fracasa / Desierta"];
export const ESTILO_RESOLUCION_CONV = {
  "Adjudicada": "border-emerald-300 bg-emerald-50 text-emerald-800",
  "Adjudicación parcial": "border-amber-300 bg-amber-50 text-amber-800",
  "Sin efecto": "border-slate-300 bg-slate-100 text-slate-700",
  "Desierta": "border-orange-300 bg-orange-50 text-orange-800",
  "Fracasada": "border-rose-300 bg-rose-50 text-rose-800",
  "Fracasa / Autoriza": "border-violet-300 bg-violet-50 text-violet-800",
  "Fracasa / Desierta": "border-red-300 bg-red-50 text-red-800",
  "No pasó por Resoluciones": "border-sky-300 bg-sky-50 text-sky-800",
};
// Licitaciones suma una opción que no aplica al cuadro de Informática y Varios.
export const RESOLUCIONES_CONV_LICITACIONES = [...RESOLUCIONES_CONV, "No pasó por Resoluciones"];
export const resolucionConvValida = v => (RESOLUCIONES_CONV_LICITACIONES.includes(v) ? v : null);

// Motivo: solo cuando la convocatoria no se adjudicó (o se adjudicó en
// parte). Lista cerrada para poder analizarlo, más un detalle libre.
const RESOLUCIONES_SIN_MOTIVO = ["Adjudicada", "No pasó por Resoluciones"];
export const pideMotivo = r => !!r && !RESOLUCIONES_SIN_MOTIVO.includes(r);
export const MOTIVOS_NO_ADJUDICACION = [
  "Sin ofertas",
  "Ofertas inadmisibles (no cumplen requisitos formales)",
  "Ofertas que no cumplen lo técnico",
  "Precio inconveniente / supera el presupuesto",
  "Falta de crédito presupuestario",
  "Desistimiento o cambio de necesidad del organismo",
  "Error u omisión en el pliego",
  "Oferente no mantuvo la oferta / no firmó",
  "Otro",
];
export const motivoValido = (resolucion, v) => (pideMotivo(resolucion) && MOTIVOS_NO_ADJUDICACION.includes(v) ? v : null);

// Grupos del análisis de Licitaciones (los colores, en AnalisisLicitaciones).
export const GRUPOS_RESOLUCION_CONV = [
  { id: "adjudicadas", etiqueta: "Adjudicadas", incluye: ["Adjudicada"] },
  { id: "parcial", etiqueta: "Adjudicación parcial", incluye: ["Adjudicación parcial"] },
  { id: "noPaso", etiqueta: "No pasaron por Resoluciones", incluye: ["No pasó por Resoluciones"] },
  { id: "noAdjudicadas", etiqueta: "No adjudicadas", incluye: ["Sin efecto", "Desierta", "Fracasada", "Fracasa / Autoriza", "Fracasa / Desierta"] },
  { id: "sinDefinir", etiqueta: "Sin resolución cargada", incluye: [""] },
];
export const grupoResolucionConv = r => GRUPOS_RESOLUCION_CONV.find(g => g.incluye.includes(r || "")) || GRUPOS_RESOLUCION_CONV.at(-1);
