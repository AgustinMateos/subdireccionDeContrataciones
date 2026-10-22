import { Star, Building2, ArrowLeftRight } from "lucide-react";

// Carteles de un expediente prioritario de Resoluciones, según por qué lo
// es: "Prioritario" con estrella (lo marcó la jefa) y/o "Plan de Obras"
// (está en su Plan de Obras). Si es por las dos cosas, lleva los dos.
// También "En préstamo" si vino prestado de Aperturas.
export default function EtiquetasPrioridad({ expediente: e }) {
  if (!e.prioritario && !e.enPlanObras && !e.enPrestamo) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {e.prioritario && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
          <Star size={10} className="fill-amber-500 text-amber-500" /> Prioritario
        </span>
      )}
      {e.enPlanObras && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-sky-300 bg-sky-50 text-sky-800">
          <Building2 size={10} /> Plan de Obras
        </span>
      )}
      {e.enPrestamo && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-violet-300 bg-violet-50 text-violet-800">
          <ArrowLeftRight size={10} /> En préstamo
        </span>
      )}
    </div>
  );
}
