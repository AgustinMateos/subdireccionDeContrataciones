"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ORGANISMOS } from "@/lib/constants";

export default function SelectorOrganismos({ organismos, onChange }) {
  const [orgInput, setOrgInput] = useState("");

  function agregar() {
    const v = orgInput.trim();
    if (!v) return;
    if (!organismos.includes(v)) onChange([...organismos, v]);
    setOrgInput("");
  }

  function quitar(o) {
    onChange(organismos.filter(x => x !== o));
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Organismos {organismos.length > 0 && <span className="text-slate-400">({organismos.length})</span>}
      </label>
      {organismos.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {organismos.map(o => (
            <span key={o} className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full pl-2.5 pr-1 py-1 text-xs text-slate-700">
              {o}
              <button type="button" onClick={() => quitar(o)} className="p-0.5 rounded-full hover:bg-slate-300 text-slate-500">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          list="lista-organismos"
          value={orgInput}
          onChange={e => setOrgInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregar(); } }}
          placeholder="Escribí o elegí de la lista y presioná Agregar"
          className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
        <datalist id="lista-organismos">
          {ORGANISMOS.map(o => <option key={o} value={o} />)}
        </datalist>
        <button type="button" onClick={agregar} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50 shrink-0">
          Agregar
        </button>
      </div>
    </div>
  );
}
