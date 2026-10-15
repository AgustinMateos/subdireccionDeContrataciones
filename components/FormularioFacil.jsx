"use client";

// Piezas de formulario pensadas para que lo complete cualquiera sin dudas
// (lo usan personas grandes): preguntas en vez de rótulos, botones grandes
// en vez de desplegables, "Hoy" a un toque y pasos numerados que se abren
// y se cierran. Las usan los modales de Órdenes de Compra y Resoluciones.

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { hoyLocalISO } from "@/lib/mesaEntradas";

export function Pregunta({ children }) {
  return <p className="text-sm font-medium text-slate-800 mb-1.5">{children}</p>;
}

// Botón grande que queda marcado al elegirlo.
export function BotonOpcion({ elegido, onClick, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={elegido}
      className={"min-h-[40px] px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors " +
        (elegido ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-slate-500 hover:bg-slate-50")}>
      {elegido && <Check size={14} className="inline -mt-0.5 mr-1" />}{children}
    </button>
  );
}

export const CLASE_ENTRADA = "w-full text-base border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800";

export function Entrada({ valor, onChange, ejemplo, mono, autoFocus }) {
  return (
    <input value={valor || ""} onChange={e => onChange(e.target.value)} placeholder={ejemplo ? "Ej.: " + ejemplo : ""} autoFocus={autoFocus}
      className={CLASE_ENTRADA + (mono ? " font-mono" : "")} />
  );
}

// Un botón por opción; `vacio`: un botón para "nada" (guarda vacío);
// `otro`: un botón para escribir algo que no está en la lista. Si lo
// cargado no está en la lista, se ve escrito. `etiqueta`: cómo se lee
// cada opción.
export function ElegirDeLista({ opciones, valor, onChange, otro, vacio, etiqueta = o => o }) {
  const v = String(valor || "").trim();
  const elegida = opciones.find(o => o.toUpperCase() === v.toUpperCase());
  const [escribiendo, setEscribiendo] = useState(!!v && !elegida);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {vacio && <BotonOpcion elegido={!v && !escribiendo} onClick={() => { setEscribiendo(false); onChange(""); }}>{vacio}</BotonOpcion>}
        {opciones.map(o => (
          <BotonOpcion key={o} elegido={!escribiendo && elegida === o} onClick={() => { setEscribiendo(false); onChange(o); }}>{etiqueta(o)}</BotonOpcion>
        ))}
        {(otro || escribiendo) && (
          <BotonOpcion elegido={escribiendo} onClick={() => { setEscribiendo(true); if (elegida) onChange(""); }}>{otro || "Otro"}</BotonOpcion>
        )}
      </div>
      {escribiendo && <Entrada valor={v} onChange={onChange} ejemplo="escribilo acá" autoFocus />}
    </div>
  );
}

export function SiNo({ valor, onChange, si = "Sí", no = "No" }) {
  return (
    <div className="flex flex-wrap gap-2">
      <BotonOpcion elegido={!valor} onClick={() => onChange(false)}>{no}</BotonOpcion>
      <BotonOpcion elegido={!!valor} onClick={() => onChange(true)}>{si}</BotonOpcion>
    </div>
  );
}

// Un día: el calendario y, al lado, "Hoy".
export function ElegirDia({ valor, onChange }) {
  const hoy = hoyLocalISO();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="date" value={valor || ""} onChange={e => onChange(e.target.value)}
        className="text-base border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
      <BotonOpcion elegido={valor === hoy} onClick={() => onChange(hoy)}>Hoy</BotonOpcion>
      {valor && <button type="button" onClick={() => onChange("")} className="text-sm text-slate-500 underline hover:text-slate-800">Borrar</button>}
    </div>
  );
}

// Un paso del formulario, numerado, que se abre y se cierra tocando el
// título. Cerrado, muestra un resumen de lo cargado.
export function Paso({ numero, titulo, resumen, abierto, onAlternar, avance, children }) {
  return (
    <section className={"rounded-xl border " + (abierto ? "border-slate-300 shadow-sm" : "border-slate-200")}>
      <button type="button" onClick={onAlternar} aria-expanded={abierto}
        className="w-full flex items-center gap-3 p-4 sm:px-5 text-left rounded-xl hover:bg-slate-50">
        <span className="w-8 h-8 shrink-0 rounded-full bg-slate-900 text-white text-sm font-semibold flex items-center justify-center">{numero}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-slate-900">{titulo}</span>
          {!abierto && <span className="block text-sm text-slate-500 truncate">{resumen || "Sin completar"}</span>}
        </span>
        <span className="shrink-0 inline-flex items-center gap-1 text-sm text-slate-600">
          {abierto ? "Cerrar" : "Abrir"}
          <ChevronDown size={20} className={"transition-transform " + (abierto ? "rotate-180" : "")} />
        </span>
      </button>
      {abierto && (
        <div className="px-4 pb-5 sm:px-5 space-y-4">
          {avance}
          <div className="grid md:grid-cols-2 gap-x-6 gap-y-5">{children}</div>
        </div>
      )}
    </section>
  );
}

export function Campo({ pregunta, ayuda, ancho, children }) {
  return (
    <div className={"min-w-0" + (ancho ? " md:col-span-2" : "")}>
      <Pregunta>{pregunta}</Pregunta>
      {children}
      {ayuda && <p className="mt-1 text-xs text-slate-500">{ayuda}</p>}
    </div>
  );
}

// Pasos abiertos y cerrados de un formulario. `resumen(n)`: lo que se ve
// del paso n cerrado.
export function usePasos(iniciales, resumen) {
  const [abiertos, setAbiertos] = useState(iniciales);
  return {
    paso: n => ({ numero: n, resumen: resumen(n), abierto: !!abiertos[n], onAlternar: () => setAbiertos(a => ({ ...a, [n]: !a[n] })) }),
    abrir: (...ns) => setAbiertos(a => ({ ...a, ...Object.fromEntries(ns.map(n => [n, true])) })),
    todosAbiertos: total => Array.from({ length: total }, (_, i) => i + 1).every(n => abiertos[n]),
    setAbiertos,
  };
}

// "Abrir todos los pasos" / "Cerrar todos los pasos".
export function AbrirTodos({ pasos, total }) {
  const todos = pasos.todosAbiertos(total);
  return (
    <div className="flex justify-end -mb-3">
      <button type="button" onClick={() => pasos.setAbiertos(todos ? {} : Object.fromEntries(Array.from({ length: total }, (_, i) => [i + 1, true])))}
        className="text-sm text-slate-600 underline hover:text-slate-900">
        {todos ? "Cerrar todos los pasos" : "Abrir todos los pasos"}
      </button>
    </div>
  );
}
