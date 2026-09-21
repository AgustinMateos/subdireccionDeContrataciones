"use client";

import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { ORGANISMOS } from "@/lib/constants";

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Filtro por organismo con búsqueda: se tipea y van apareciendo las opciones
// que coinciden. Elegir una aplica el filtro; la X lo quita.
export default function FiltroOrganismo({ valor, onChange }) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const aplicado = valor !== "Todos";

  useEffect(() => {
    if (!abierto) return;
    function fuera(e) { if (ref.current && !ref.current.contains(e.target)) { setAbierto(false); setTexto(""); } }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const q = norm(texto);
  const coincidencias = ORGANISMOS.filter(o => !q || norm(o).includes(q));

  function elegir(o) { onChange(o); setTexto(""); setAbierto(false); }
  function quitar() { onChange("Todos"); setTexto(""); }

  return (
    <div ref={ref} className="relative">
      <div className={"flex items-center gap-1.5 text-xs border rounded-md px-2.5 py-1.5 w-[240px] bg-white " +
        (abierto ? "border-slate-800 ring-2 ring-slate-800" : "border-slate-300")}>
        <Search size={13} className="text-slate-400 shrink-0" />
        <input
          value={abierto ? texto : (aplicado ? valor : "")}
          onChange={e => { setTexto(e.target.value); setAbierto(true); }}
          onFocus={() => setAbierto(true)}
          onKeyDown={e => {
            if (e.key === "Escape") { setAbierto(false); setTexto(""); e.currentTarget.blur(); }
            if (e.key === "Enter" && coincidencias.length > 0) elegir(coincidencias[0]);
          }}
          placeholder="Todos los organismos"
          className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-slate-700 text-slate-800"
        />
        {aplicado && (
          <button type="button" onClick={quitar} aria-label="Quitar organismo" className="text-slate-400 hover:text-slate-800 shrink-0">
            <X size={13} />
          </button>
        )}
      </div>
      {abierto && (
        <ul className="absolute z-30 mt-1 w-full min-w-[280px] max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {coincidencias.length === 0 && <li className="px-3 py-2 text-xs text-slate-400">Sin coincidencias</li>}
          {coincidencias.map(o => (
            <li key={o}>
              <button
                type="button"
                onClick={() => elegir(o)}
                className={"w-full text-left text-xs px-3 py-1.5 hover:bg-slate-50 " + (o === valor ? "font-semibold text-slate-900" : "text-slate-600")}
              >
                {o}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
