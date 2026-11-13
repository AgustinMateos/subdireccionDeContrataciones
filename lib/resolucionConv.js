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
