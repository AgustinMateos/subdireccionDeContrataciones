"use client";

import { PRORROGA_MESES_OPCIONES } from "@/lib/constants";

export default function SelectorMesesProrroga({ value, onChange }) {
  return (
    <div className="mt-2.5">
      <label className="block text-[11px] font-medium text-slate-600 mb-1">
        ¿Cuántos meses de prórroga tiene el expediente?
      </label>
      <div className="flex gap-1.5">
        {PRORROGA_MESES_OPCIONES.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            className={"flex-1 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors " +
              (value === m ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500 bg-white")}
          >
            {m} mes{m > 1 ? "es" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
