"use client";

import { useState } from "react";
import { X } from "lucide-react";
import BotonAccion from "./BotonAccion";

// Adjudicación parcial: algunos domicilios/renglones de la convocatoria de
// `exp` no se adjudican y deben tramitarse por separado. Se elige cuáles se
// van al expediente nuevo (el resto queda en `exp`), sin perder la relación
// con el expediente del que salieron.
export default function DividirExpediente({ exp, onCerrar, onConfirmar }) {
  const disponibles = exp.domiciliosRenglones || [];
  const [seleccionados, setSeleccionados] = useState([]);
  const [f, setF] = useState({ exp: "", objeto: exp.objeto || "", fechaInicio: "", fechaVencimiento: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  function toggle(v) {
    setSeleccionados(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  async function confirmar() {
    if (seleccionados.length === 0) {
      setError("Elegí al menos un domicilio/renglón para dividir.");
      return;
    }
    if (!f.exp || !f.fechaVencimiento) {
      setError("Completá al menos N° de expediente y fecha de vencimiento.");
      return;
    }
    setCargando(true);
    await onConfirmar({ ...f, domiciliosRenglones: seleccionados });
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Dividir expediente</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            Para cuando la adjudicación es parcial: los domicilios/renglones que elijas abajo se separan en un
            expediente nuevo, propio, pero vinculado a <span className="font-mono font-medium text-slate-700">{exp.exp}</span> —
            si más adelante sus períodos coinciden, se pueden reunificar.
          </p>

          {disponibles.length === 0 ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Este expediente no tiene domicilios/renglones cargados. Agregalos primero desde "Editar expediente".
            </p>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Domicilios/renglones a dividir ({seleccionados.length} de {disponibles.length})
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-md p-2">
                {disponibles.map(v => (
                  <label key={v} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" checked={seleccionados.includes(v)} onChange={() => toggle(v)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-800" />
                    {v}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente</label>
              <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="13-00000/26"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Objeto</label>
              <input value={f.objeto} onChange={e => set("objeto", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de inicio</label>
              <input type="date" value={f.fechaInicio} onChange={e => set("fechaInicio", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de vencimiento</label>
              <input type="date" value={f.fechaVencimiento} onChange={e => set("fechaVencimiento", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Dividiendo..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Dividir expediente
            </BotonAccion>
          </div>
        </div>
      </div>
    </div>
  );
}
