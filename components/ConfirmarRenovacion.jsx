"use client";

import { useState } from "react";
import BotonAccion from "./BotonAccion";

export default function ConfirmarRenovacion({ exp, onCerrar, onConfirmar }) {
  const [expNuevo, setExpNuevo] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function confirmar() {
    if (!expNuevo.trim()) {
      setError("Cargá el N° de expediente de la renovación.");
      return;
    }
    setCargando(true);
    await onConfirmar(expNuevo.trim());
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Crear renovación vinculada</h2>
        <p className="text-sm text-slate-600 mb-4">
          Se generará un nuevo expediente de renovación vinculado al vigente
          <span className="font-mono font-medium text-slate-900"> {exp.exp}</span>, y ese expediente pasará a estado
          <span className="font-medium"> "En trámite de renovación"</span>.
        </p>
        <div className="mb-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente de la renovación</label>
          <input
            value={expNuevo}
            onChange={e => { setExpNuevo(e.target.value); setError(""); }}
            placeholder="13-00000/26"
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
        </div>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <BotonAccion
            onClick={confirmar}
            cargando={cargando}
            cargandoTexto="Creando..."
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            Crear renovación
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
