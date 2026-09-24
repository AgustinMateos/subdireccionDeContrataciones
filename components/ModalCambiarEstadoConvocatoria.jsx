"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ESTADOS_CONVOCATORIA } from "@/lib/constants";
import BotonAccion from "./BotonAccion";

// Edición rápida del estado de convocatoria (ej. desde la tabla de
// expedientes), sin pasar por "Editar expediente". Los estados terminales
// (Fracasada/Desierta/Adjudicación íntegra/parcial) siguen resolviéndose
// desde "Resolver adjudicación" en la ficha, que además maneja la división
// por domicilio/renglón — esto es solo para los pasos intermedios del
// trámite (Publicación, Preadjudicación, etc.).
export default function ModalCambiarEstadoConvocatoria({ exp, onCerrar, onConfirmar }) {
  const [valor, setValor] = useState(exp.estadoConvocatoria || "");
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    await onConfirmar(valor || null);
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Estado de convocatoria</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono font-medium text-slate-700">{exp.exp}</span>
            </p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6">
          <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
          <select value={valor} onChange={e => setValor(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
            <option value="">— Sin definir —</option>
            {ESTADOS_CONVOCATORIA.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <p className="text-[11px] text-slate-500 mt-2">
            Para Fracasada, Desierta o Adjudicación (íntegra o parcial) usá "Resolver adjudicación" desde la ficha del expediente.
          </p>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onCerrar} disabled={enviando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <BotonAccion
            onClick={confirmar}
            cargando={enviando}
            cargandoTexto="Guardando..."
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            Guardar
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
