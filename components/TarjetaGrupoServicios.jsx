"use client";

import { ALERTA_ESTILO, ESTADO_ESTILO } from "@/lib/constants";
import { diasRestantes, alerta, fmtFecha } from "@/lib/utils";

// Varios expedientes de Servicios que son "la misma prestación" repetida
// (mismo tipo de servicio, mismo fuero y misma zona) con distinto N° de
// expediente se agrupan en una sola card, para no repetir la misma info una
// y otra vez en el listado.
export default function TarjetaGrupoServicios({ grupo, onVer }) {
  const { tipo, zona, fuero, items } = grupo;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{tipo}</span>
        {zona && (
          <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded border border-slate-300 text-slate-600">
            {zona}
          </span>
        )}
      </div>
      {fuero.length > 0 && (
        <div className="text-[11px] text-slate-500 -mt-1">{fuero.join(" · ")}</div>
      )}

      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {items.map(exp => {
          const dias = diasRestantes(exp.fechaVencimiento);
          const niv = alerta(dias);
          return (
            <button
              key={exp.id}
              onClick={() => onVer(exp.id)}
              className="w-full text-left py-2 flex items-center justify-between gap-2 hover:bg-slate-50 -mx-1 px-1 rounded transition-colors"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-slate-900">{exp.exp}</div>
                <div className="text-[11px] text-slate-500 truncate">Agente {exp.agente}</div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ESTADO_ESTILO[exp.estadoGeneral]}>
                  {exp.estadoGeneral}
                </span>
                <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ALERTA_ESTILO[niv]}>
                  {dias >= 0 ? "Vence " + fmtFecha(exp.fechaVencimiento) : Math.abs(dias) + " días vencido"}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
