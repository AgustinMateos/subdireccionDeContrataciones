"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import { MOTIVOS_NO_ADJUDICACION } from "@/lib/resolucionConv";

// Elegir uno o varios motivos de no adjudicación (Licitaciones). Va encima
// del formulario del expediente: lo elegido se aplica al aceptar.
export default function ModalMotivosNoAdjudicacion({ resolucion, elegidos, onCerrar, onAceptar }) {
  const [sel, setSel] = useState(() => new Set(elegidos));

  useEffect(() => {
    const alTeclear = ev => { if (ev.key === "Escape") { ev.stopPropagation(); onCerrar(); } };
    window.addEventListener("keydown", alTeclear, true);
    return () => window.removeEventListener("keydown", alTeclear, true);
  }, [onCerrar]);

  function alternar(m) {
    setSel(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(m)) nuevo.delete(m); else nuevo.add(m);
      return nuevo;
    });
  }

  const lista = MOTIVOS_NO_ADJUDICACION.filter(m => sel.has(m));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Motivos de no adjudicación</h2>
            <p className="text-xs text-slate-500">{resolucion} · podés marcar más de uno</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <ul className="p-3 space-y-1 overflow-y-auto">
          {MOTIVOS_NO_ADJUDICACION.map(m => {
            const activo = sel.has(m);
            return (
              <li key={m}>
                <button type="button" onClick={() => alternar(m)} aria-pressed={activo}
                  className={"w-full flex items-center gap-3 text-left text-sm px-3 py-2 rounded-md border transition-colors " +
                    (activo ? "border-slate-800 bg-slate-50 text-slate-900" : "border-transparent hover:bg-slate-50 text-slate-700")}>
                  <span className={"w-4 h-4 shrink-0 rounded border flex items-center justify-center " + (activo ? "bg-slate-800 border-slate-800 text-white" : "border-slate-300 bg-white")}>
                    {activo && <Check size={12} strokeWidth={3} />}
                  </span>
                  {m}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="px-6 py-4 border-t border-slate-200 flex items-center gap-2">
          <span className="text-xs text-slate-500 mr-auto">
            {lista.length === 0 ? "Ninguno marcado" : lista.length + " marcado" + (lista.length !== 1 ? "s" : "")}
          </span>
          {lista.length > 0 && (
            <button type="button" onClick={() => setSel(new Set())} className="px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100">
              Limpiar
            </button>
          )}
          <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">
            Cancelar
          </button>
          <button type="button" onClick={() => onAceptar(lista)} className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
