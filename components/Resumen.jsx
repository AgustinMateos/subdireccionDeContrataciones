"use client";

import { useState } from "react";
import { TrendingUp, FileText, AlertTriangle, Clock, DollarSign } from "lucide-react";
import { fmtMoneda } from "@/lib/utils";
export default function Resumen({ resumen, mostrarDesgloseArea = true }) {
  const [verDesglose, setVerDesglose] = useState(false);
  const items = [
    { label: "Expedientes vigentes", valor: resumen.vigentes, icon: FileText, color: "text-blue-700 bg-blue-50" },
    { label: "Próximos a vencer (< 90 días)", valor: resumen.proximosVencer, icon: AlertTriangle, color: "text-amber-700 bg-amber-50" },
    { label: "En trámite de renovación", valor: resumen.enRenovacion, icon: Clock, color: "text-slate-700 bg-slate-100" },
    { label: "Monto comprometido " + resumen.anioActual + " (ARS)", valor: fmtMoneda(resumen.montoComprometidoAnioActual), icon: DollarSign, color: "text-emerald-700 bg-emerald-50" },
  ];
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-3">
        {items.map(it => (
          <div key={it.label} className="flex-1 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
            <div className={"w-10 h-10 shrink-0 rounded-md flex items-center justify-center " + it.color}>
              <it.icon size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold text-slate-900 leading-tight">{it.valor}</div>
              <div className="text-xs text-slate-500 truncate">{it.label}</div>
            </div>
          </div>
        ))}
      </div>
      {mostrarDesgloseArea && (
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-800" /> Informática: <strong className="text-slate-900">{resumen.porArea.Informatica}</strong> expedientes activos
        </span>
        <span className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-full px-3 py-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-800" /> Varios: <strong className="text-slate-900">{resumen.porArea.Varios}</strong> expedientes activos
        </span>
        <button
          onClick={() => setVerDesglose(v => !v)}
          className="ml-auto inline-flex items-center gap-1.5 text-slate-700 font-medium hover:text-slate-900 underline underline-offset-2"
        >
          <TrendingUp size={13} />
          {verDesglose ? "Ocultar" : "Ver"} desglose de presupuesto por ejercicio financiero
        </button>
      </div>
      )}

      {mostrarDesgloseArea && verDesglose && (
        <div className="mt-3 bg-white border border-slate-200 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Presupuesto comprometido por ejercicio financiero y área
            </h3>
            <span className="text-[11px] text-slate-400">Incluye todos los expedientes (vigentes, en trámite, finalizados y archivados)</span>
          </div>
          <table className="w-full text-sm min-w-[480px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3">Ejercicio</th>
                <th className="py-2 pr-3">Informática</th>
                <th className="py-2 pr-3">Varios</th>
                <th className="py-2 pr-3">Total</th>
                <th className="py-2 pr-3">Expedientes</th>
              </tr>
            </thead>
            <tbody>
              {resumen.desgloseEjercicios.map(fila => (
                <tr key={fila.ejercicio} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 font-medium text-slate-900">{fila.ejercicio}</td>
                  <td className="py-2 pr-3 text-slate-700">{fmtMoneda(fila.Informatica || 0)}</td>
                  <td className="py-2 pr-3 text-slate-700">{fmtMoneda(fila.Varios || 0)}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-900">{fmtMoneda(fila.total)}</td>
                  <td className="py-2 pr-3 text-slate-500">{fila.cantidad}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50">
                <td className="py-2.5 pr-3 font-semibold text-slate-900">Total (todos los ejercicios)</td>
                <td className="py-2.5 pr-3 font-semibold text-slate-900">
                  {fmtMoneda(resumen.desgloseEjercicios.reduce((s, f) => s + (f.Informatica || 0), 0))}
                </td>
                <td className="py-2.5 pr-3 font-semibold text-slate-900">
                  {fmtMoneda(resumen.desgloseEjercicios.reduce((s, f) => s + (f.Varios || 0), 0))}
                </td>
                <td className="py-2.5 pr-3 font-semibold text-slate-900">{fmtMoneda(resumen.totalGeneralTodosLosEjercicios)}</td>
                <td className="py-2.5 pr-3 font-semibold text-slate-500">
                  {resumen.desgloseEjercicios.reduce((s, f) => s + f.cantidad, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
          <p className="text-[11px] text-slate-400 mt-3">
            El ejercicio se toma de la fecha de inicio del expediente. Este desglose sirve como base para
            informes de ejecución presupuestaria por departamento y sector.
          </p>
        </div>
      )}
    </div>
  );
}