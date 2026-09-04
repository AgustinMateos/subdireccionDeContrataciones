"use client";

import { useState } from "react";
import { PRORROGA_MESES_OPCIONES } from "@/lib/constants";
import { fmtFecha, sumarMesesISO } from "@/lib/utils";

export default function ActivarProrroga({ exp, onCerrar, onConfirmar }) {
  const [meses, setMeses] = useState(null);
  const [error, setError] = useState("");

  const nuevaFechaVencimiento = meses ? sumarMesesISO(exp.fechaVencimiento, meses) : null;

  function confirmar() {
    if (!meses) {
      setError("Elegí cuántos meses de prórroga vas a usar.");
      return;
    }
    onConfirmar({ nuevaFechaVencimiento });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Activar prórroga</h2>
        <p className="text-sm text-slate-600 mb-4">
          Se extiende la cobertura del expediente vigente
          <span className="font-mono font-medium text-slate-900"> {exp.exp}</span> (vence hoy el {fmtFecha(exp.fechaVencimiento)})
          sin generar un expediente nuevo. Quedará registrado como observación.
        </p>

        <label className="block text-xs font-medium text-slate-600 mb-1.5">
          Meses de prórroga a usar (máximo {Math.max(...PRORROGA_MESES_OPCIONES)})
        </label>
        <div className="flex gap-1.5">
          {PRORROGA_MESES_OPCIONES.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMeses(m); setError(""); }}
              className={"flex-1 text-sm font-medium px-3 py-2 rounded-md border transition-colors " +
                (meses === m ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}
            >
              {m} mes{m > 1 ? "es" : ""}
            </button>
          ))}
        </div>

        {nuevaFechaVencimiento && (
          <p className="text-xs text-slate-500 mt-3">
            Nuevo vencimiento: <span className="font-medium text-slate-800">{fmtFecha(nuevaFechaVencimiento)}</span>
          </p>
        )}

        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCerrar} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Cancelar</button>
          <button onClick={confirmar} className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            Activar prórroga
          </button>
        </div>
      </div>
    </div>
  );
}
