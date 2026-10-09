"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

// Campo de texto con lista de opciones. A diferencia de un <datalist>, al
// tocarlo muestra TODAS las opciones aunque ya tenga un valor cargado; al
// escribir, filtra. Se puede cargar un valor que no esté en la lista.
export default function CampoOpciones({ label, value, onChange, opciones, placeholder }) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState(null); // null: sin escribir desde que se abrió → todas
  const [marcada, setMarcada] = useState(-1);
  const ref = useRef(null);
  const listaRef = useRef(null);

  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const visibles = filtro === null ? opciones : opciones.filter(o => norm(o).includes(norm(filtro)));

  useEffect(() => {
    if (!abierto) return;
    function fuera(e) { if (!ref.current?.contains(e.target)) cerrar(); }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  // Al abrir, la opción actual queda marcada y a la vista.
  useEffect(() => {
    if (!abierto || marcada < 0) return;
    listaRef.current?.children[marcada]?.scrollIntoView({ block: "nearest" });
  }, [abierto, marcada]);

  function abrir() {
    if (abierto) return;
    setFiltro(null);
    setMarcada(opciones.indexOf(value));
    setAbierto(true);
  }

  function cerrar() { setAbierto(false); setFiltro(null); }

  function elegir(o) { onChange(o); cerrar(); }

  function tecla(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!abierto) { abrir(); return; }
      const paso = e.key === "ArrowDown" ? 1 : -1;
      setMarcada(m => Math.max(0, Math.min(visibles.length - 1, m + paso)));
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault();
      if (visibles[marcada]) elegir(visibles[marcada]); else cerrar();
    } else if (e.key === "Escape" || e.key === "Tab") {
      cerrar();
    }
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input
          value={value ?? ""}
          placeholder={placeholder}
          onFocus={abrir}
          onClick={abrir}
          onKeyDown={tecla}
          onChange={e => { onChange(e.target.value); setFiltro(e.target.value); setMarcada(0); setAbierto(true); }}
          autoComplete="off"
          className="w-full text-sm border border-slate-300 rounded-md pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); abierto ? cerrar() : abrir(); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
        >
          <ChevronDown size={15} className={"transition-transform " + (abierto ? "rotate-180" : "")} />
        </button>
      </div>
      {abierto && visibles.length > 0 && (
        <ul ref={listaRef} className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-md shadow-lg py-1">
          {visibles.map((o, i) => (
            <li
              key={o}
              onMouseDown={e => { e.preventDefault(); elegir(o); }}
              onMouseEnter={() => setMarcada(i)}
              className={"flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer " +
                (i === marcada ? "bg-slate-100 text-slate-900" : "text-slate-700")}
            >
              <span className="truncate">{o}</span>
              {o === value && <Check size={14} className="text-slate-500 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
