"use client";

import { AREA_ESTILO, AREA_LABEL, ALERTA_ESTILO, ALERTA_LABEL, ESTADO_ESTILO } from "@/lib/constants";
import { diasRestantes, alerta, fmtFecha, fmtMoneda } from "@/lib/utils";
export default function TarjetaExpediente({ exp, onVer }) {
  const dias = diasRestantes(exp.fechaVencimiento);
  const niv = alerta(dias);
  return (
    <button onClick={onVer} className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-400 hover:shadow-sm transition-all flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className={"text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded " + AREA_ESTILO[exp.area]}>
          {AREA_LABEL[exp.area]}
        </span>
        <span className={"text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded border " + ALERTA_ESTILO[niv]}>
          {ALERTA_LABEL[niv]}
        </span>
      </div>

      <div>
        <div className="font-mono text-sm font-semibold text-slate-900">{exp.exp}</div>
        {exp.nombreCorto && (
          <div className="text-xs font-medium text-slate-700 mt-0.5">{exp.nombreCorto}</div>
        )}
        <div className="text-xs text-slate-500 mt-0.5">{exp.tipo} · Agente {exp.agente}</div>
        <div className="text-[11px] text-slate-400 mt-0.5 truncate">{exp.organismo}</div>
      </div>

      <p className="text-sm text-slate-700 line-clamp-2 leading-snug">{exp.objeto}</p>

      <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
        <span className="text-slate-500">Vence {fmtFecha(exp.fechaVencimiento)}</span>
        <span className="font-medium text-slate-900">{fmtMoneda(exp.montoARS)}</span>
      </div>

      <span className={"text-[11px] font-medium px-2 py-1 rounded border self-start " + ESTADO_ESTILO[exp.estadoGeneral]}>
        {exp.estadoGeneral}
      </span>
    </button>
  );
}