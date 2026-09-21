"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

// Desplegable propio para los filtros (reemplaza al <select> nativo).
// `opciones`: [{ valor, etiqueta }]. `clase` permite teñir el botón según el
// valor elegido (ej. el filtro de vencimiento).
export default function FiltroDesplegable({ valor, onChange, opciones, clase = "bg-white border-slate-300 text-slate-700" }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const actual = opciones.find(o => o.valor === valor) || opciones[0];

  useEffect(() => {
    if (!abierto) return;
    function fuera(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); }
    function tecla(e) { if (e.key === "Escape") setAbierto(false); }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        className={"flex items-center gap-2 text-xs border rounded-md px-2.5 py-1.5 hover:border-slate-500 transition-colors " + clase}
      >
        <span>{actual.etiqueta}</span>
        <ChevronDown size={13} className={"text-slate-400 transition-transform " + (abierto ? "rotate-180" : "")} />
      </button>
      {abierto && (
        <ul className="absolute z-30 mt-1 min-w-full w-max max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1">
          {opciones.map(o => (
            <li key={o.valor}>
              <button
                type="button"
                onClick={() => { onChange(o.valor); setAbierto(false); }}
                className={"w-full flex items-center justify-between gap-3 text-left text-xs px-3 py-1.5 hover:bg-slate-50 " +
                  (o.valor === valor ? "font-semibold text-slate-900" : "text-slate-600")}
              >
                {o.etiqueta}
                {o.valor === valor && <Check size={12} className="text-slate-700" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
