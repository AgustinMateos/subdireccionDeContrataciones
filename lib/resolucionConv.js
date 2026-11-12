// Resolución de la convocatoria (cómo terminó): etiqueta compartida por
// Licitaciones y el Cuadro de Informática y Varios. Sin dependencias.
export const RESOLUCIONES_CONV = ["Adjudicada", "Adjudicación parcial", "Sin efecto", "Desierta", "Fracasada", "Fracasa / Autoriza"];
export const ESTILO_RESOLUCION_CONV = {
  "Adjudicada": "border-emerald-300 bg-emerald-50 text-emerald-800",
  "Adjudicación parcial": "border-amber-300 bg-amber-50 text-amber-800",
  "Sin efecto": "border-slate-300 bg-slate-100 text-slate-700",
  "Desierta": "border-orange-300 bg-orange-50 text-orange-800",
  "Fracasada": "border-rose-300 bg-rose-50 text-rose-800",
  "Fracasa / Autoriza": "border-violet-300 bg-violet-50 text-violet-800",
};
export const resolucionConvValida = v => (RESOLUCIONES_CONV.includes(v) ? v : null);
