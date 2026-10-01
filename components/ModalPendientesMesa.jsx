"use client";

import { X } from "lucide-react";
import { fmtFecha, soloFechaLocal } from "@/lib/utils";
import { ultimoMovimiento } from "@/lib/mesaEntradas";

// Expedientes que Mesa de Entradas caratuló para este departamento y todavía
// no se confirmaron. "Confirmar" abre la carátula precargada: recién al
// guardarla se crea el expediente y entra a las tarjetas.
export default function ModalPendientesMesa({ pendientes, puedeConfirmar, onCerrar, onConfirmar }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Cargados por Mesa de Entradas</h2>
            <p className="text-xs text-slate-500 mt-0.5">{pendientes.length} pendiente{pendientes.length !== 1 ? "s" : ""} de confirmar</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <ul className="p-4 space-y-2">
          {pendientes.length === 0 && (
            <li className="py-8 text-center text-sm text-slate-500">No hay cargas pendientes.</li>
          )}
          {pendientes.map(p => {
            const ult = ultimoMovimiento(p);
            return (
              <li key={p.id} className="border border-slate-200 rounded-lg p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">{p.exp}</span>
                    {p.tipo && <span className="text-xs text-slate-600">{p.tipo}</span>}
                    {p.zona && <span className="text-xs text-slate-500">· {p.zona}</span>}
                  </div>
                  <p className="text-sm text-slate-700 mt-0.5">{p.objeto}</p>
                  {(p.fuero || []).length > 0 && <p className="text-[11px] text-slate-500 mt-0.5">{p.fuero.join(" · ")}</p>}
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Caratulado por Mesa el {fmtFecha(soloFechaLocal(p.creadoEn))}
                    {ult?.sector ? " · hoy en " + ult.sector + (ult.subsector ? " / " + ult.subsector : "") : ""}
                  </p>
                </div>
                {puedeConfirmar && (
                  <button onClick={() => onConfirmar(p)} className="shrink-0 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                    Confirmar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
