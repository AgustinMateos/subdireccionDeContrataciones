"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { fuerosDeOrganismos } from "@/lib/organismosFueros";

// Selector de fueros (puede haber más de uno), con sugerencias acotadas a los
// organismos ya elegidos en el expediente (si ninguno coincide con el
// padrón, sugiere todos los fueros conocidos). Sigue siendo texto libre: la
// lista es una ayuda, no restringe.
export default function CampoFuero({ organismos, fueros, onChange, id = "lista-fueros" }) {
  const [input, setInput] = useState("");
  const opciones = fuerosDeOrganismos(organismos);
  const valores = fueros || [];

  function agregar() {
    const v = input.trim();
    if (!v) return;
    if (!valores.includes(v)) onChange([...valores, v]);
    setInput("");
  }

  function quitar(f) {
    onChange(valores.filter(x => x !== f));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Fuero {valores.length > 0 && <span className="text-slate-400">({valores.length})</span>}
      </label>
      {valores.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {valores.map(f => (
            <span key={f} className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full pl-2.5 pr-1 py-1 text-xs text-slate-700">
              {f}
              <button type="button" onClick={() => quitar(f)} className="p-0.5 rounded-full hover:bg-slate-300 text-slate-500">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          list={id}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          placeholder="Ej: Cámara Federal de Apelaciones de Córdoba"
          className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
        <datalist id={id}>
          {opciones.map(f => <option key={f} value={f} />)}
        </datalist>
        <button type="button" onClick={agregar} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50 shrink-0">
          Agregar
        </button>
      </div>
    </div>
  );
}
