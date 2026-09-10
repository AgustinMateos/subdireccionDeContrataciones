"use client";

import { useState } from "react";
import { X } from "lucide-react";

// Domicilios/renglones que cubre el expediente — texto libre (no hay un
// padrón fijo como en Fuero): "Renglón 3 - Talcahuano 550", "Edificio
// central", etc. Sirven para poder repartirlos entre expedientes cuando una
// adjudicación es parcial (ver "Dividir expediente").
export default function CampoDomiciliosRenglones({ valores, onChange, id = "lista-domicilios-renglones" }) {
  const [input, setInput] = useState("");
  const lista = valores || [];

  function agregar() {
    const v = input.trim();
    if (!v) return;
    if (!lista.includes(v)) onChange([...lista, v]);
    setInput("");
  }

  function quitar(v) {
    onChange(lista.filter(x => x !== v));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Domicilios / renglones {lista.length > 0 && <span className="text-slate-400">({lista.length})</span>}
      </label>
      {lista.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {lista.map(v => (
            <span key={v} className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full pl-2.5 pr-1 py-1 text-xs text-slate-700">
              {v}
              <button type="button" onClick={() => quitar(v)} className="p-0.5 rounded-full hover:bg-slate-300 text-slate-500">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          placeholder="Ej: Renglón 3 - Talcahuano 550"
          className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
        <button type="button" onClick={agregar} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50 shrink-0">
          Agregar
        </button>
      </div>
    </div>
  );
}
