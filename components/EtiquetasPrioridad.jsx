import { esPrioritario } from "@/lib/resoluciones";

// Carteles de un expediente de Resoluciones: "Prioritario" (lo marcó la
// jefa o está en su Plan de Obras) y "Plan de Obras".
export default function EtiquetasPrioridad({ expediente: e }) {
  if (!esPrioritario(e)) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
        Prioritario
      </span>
      {e.enPlanObras && (
        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-sky-300 bg-sky-50 text-sky-800">
          Plan de Obras
        </span>
      )}
    </div>
  );
}
