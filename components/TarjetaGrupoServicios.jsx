"use client";

import { MapPin, Clock } from "lucide-react";
import { ALERTA_ESTILO, ESTADO_ESTILO } from "@/lib/constants";
import { diasRestantes, alerta, fmtFecha, diasFrenado, alertaFrenado } from "@/lib/utils";
import { direccionesDe } from "@/lib/organismosFueros";

// Varios expedientes de Servicios que son "la misma prestación" repetida
// (mismo tipo de servicio, mismo fuero y misma zona) con distinto N° de
// expediente se agrupan en una sola card, para no repetir la misma info una
// y otra vez en el listado.
export default function TarjetaGrupoServicios({ grupo, onVer }) {
  const { tipo, zona, fuero, organismos, items } = grupo;
  const direcciones = direccionesDe(organismos, fuero);
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
      {organismos.length > 0 && (
        <div className="text-[11px] font-medium text-slate-700 -mt-1">{organismos.join(" · ")}</div>
      )}
      {fuero.length > 0 && (
        <div className="text-[11px] text-slate-500">{fuero.join(" · ")}</div>
      )}
      {direcciones.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
          <MapPin size={12} className="mt-0.5 shrink-0" />
          <span>{direcciones.join(" · ")}</span>
        </div>
      )}

      <div className="divide-y divide-slate-100 border-t border-slate-100">
        {items.map(exp => {
          const esRenovacion = exp.rol === "renovacion";
          const dias = diasRestantes(exp.fechaVencimiento);
          const niv = alerta(dias);
          const frenado = esRenovacion ? diasFrenado(exp.observaciones) : null;
          return (
            <button
              key={exp.id}
              onClick={() => onVer(exp.id)}
              className="w-full text-left py-2 flex items-center justify-between gap-2 hover:bg-slate-50 -mx-1 px-1 rounded transition-colors"
            >
              <div className="min-w-0">
                <div className="font-mono text-xs font-semibold text-slate-900">{exp.exp}</div>
                <div className="text-[11px] text-slate-500 truncate">Agente {exp.agente}</div>
                {esRenovacion && (
                  <div className="text-[11px] text-slate-500 truncate">
                    {exp.sector || "Sin sector"} · {exp.estadoConvocatoria || "Sin estado de convocatoria"}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ESTADO_ESTILO[exp.estadoGeneral]}>
                  {exp.estadoGeneral}
                </span>
                {esRenovacion ? (
                  <>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-slate-300 text-slate-600">
                      {exp.fechaInicio ? "Arranca " + fmtFecha(exp.fechaInicio) : "Sin fecha de inicio"}
                    </span>
                    {frenado != null && (
                      <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(frenado)]}>
                        Frenado hace {frenado} día{frenado !== 1 ? "s" : ""}
                      </span>
                    )}
                  </>
                ) : (
                  <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ALERTA_ESTILO[niv]}>
                    {dias >= 0 ? "Vence " + fmtFecha(exp.fechaVencimiento) : Math.abs(dias) + " días vencido"}
                  </span>
                )}
                {!esRenovacion && exp.tieneProrroga && (
                  <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 " +
                    (exp.prorrogaActivada ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800")}>
                    <Clock size={10} /> {exp.prorrogaActivada ? "Prórroga activada" : "Puede activar prórroga"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
