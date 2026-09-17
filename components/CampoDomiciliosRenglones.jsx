"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { ASCENSORES_NUMEROS, MONTACARGAS_NUMEROS } from "@/lib/constants";

// Domicilios/renglones que cubre el expediente — texto libre (no hay un
// padrón fijo como en Fuero): "Renglón 3 - Talcahuano 550", "Edificio
// central", etc. Sirven para poder repartirlos entre expedientes cuando una
// adjudicación es parcial (ver "Dividir expediente").
//
// conAscensores (solo Servicios, tipo "Ascensores") agrega, debajo de cada
// domicilio, qué ascensores y qué montacargas puntuales tramita — puede
// haber más de uno de cada uno — ver Expediente.ascensoresPorDomicilio.
export default function CampoDomiciliosRenglones({
  valores, onChange, id = "lista-domicilios-renglones",
  conAscensores, ascensoresPorDomicilio, onChangeAscensoresPorDomicilio,
}) {
  const [input, setInput] = useState("");
  // Colapsado por default; arranca abierto el que ya trae ascensores o
  // montacargas cargados (al editar un expediente existente).
  const [abiertos, setAbiertos] = useState(() => new Set(
    Object.entries(ascensoresPorDomicilio || {})
      .filter(([, d]) => (d.ascensores || []).length > 0 || (d.montacargas || []).length > 0)
      .map(([dom]) => dom)
  ));
  const lista = valores || [];
  const porDomicilio = ascensoresPorDomicilio || {};

  function toggleAbierto(v) {
    setAbiertos(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }

  function agregar() {
    const v = input.trim();
    if (!v) return;
    if (!lista.includes(v)) onChange([...lista, v]);
    setInput("");
  }

  function quitar(v) {
    onChange(lista.filter(x => x !== v));
    if (conAscensores && porDomicilio[v]) {
      const { [v]: _quitado, ...resto } = porDomicilio;
      onChangeAscensoresPorDomicilio(resto);
    }
  }

  function entradaDe(v) {
    return porDomicilio[v] || { ascensores: [], montacargas: [] };
  }

  function toggleEn(v, campo, n) {
    const actual = entradaDe(v);
    const lista = actual[campo].includes(n)
      ? actual[campo].filter(x => x !== n)
      : [...actual[campo], n].sort((a, b) => a - b);
    onChangeAscensoresPorDomicilio({ ...porDomicilio, [v]: { ...actual, [campo]: lista } });
  }

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Domicilios / renglones {lista.length > 0 && <span className="text-slate-400">({lista.length})</span>}
      </label>

      {lista.length > 0 && (
        conAscensores ? (
          <div className="space-y-2 mb-2">
            {lista.map(v => {
              const entrada = entradaDe(v);
              const abierto = abiertos.has(v);
              const resumen = [
                entrada.ascensores.length > 0 ? "Ascensores " + entrada.ascensores.join(", ") : null,
                entrada.montacargas.length > 0 ? "Montacargas " + entrada.montacargas.join(", ") : null,
              ].filter(Boolean).join(" · ");
              return (
                <div key={v} className="border border-slate-200 rounded-md bg-slate-50">
                  <button
                    type="button"
                    onClick={() => toggleAbierto(v)}
                    className="w-full flex items-center justify-between gap-2 p-2.5 text-left"
                  >
                    <span className="min-w-0">
                      <span className="text-sm text-slate-700">{v}</span>
                      {!abierto && resumen && (
                        <span className="block text-[11px] text-slate-500 truncate">{resumen}</span>
                      )}
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); quitar(v); }}
                        onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); quitar(v); } }}
                        className="p-0.5 rounded-full hover:bg-slate-200 text-slate-500"
                      >
                        <X size={14} />
                      </span>
                      <ChevronDown size={14} className={"text-slate-400 transition-transform " + (abierto ? "rotate-180" : "")} />
                    </span>
                  </button>
                  {abierto && (
                    <div className="px-2.5 pb-2.5">
                      <div>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Ascensores</span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {ASCENSORES_NUMEROS.map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => toggleEn(v, "ascensores", n)}
                              className={"w-7 h-7 rounded border text-xs font-medium transition-colors " +
                                (entrada.ascensores.includes(n)
                                  ? "border-slate-800 bg-slate-800 text-white"
                                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-500")}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Montacargas</span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {MONTACARGAS_NUMEROS.map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => toggleEn(v, "montacargas", n)}
                              className={"w-7 h-7 rounded border text-xs font-medium transition-colors " +
                                (entrada.montacargas.includes(n)
                                  ? "border-amber-700 bg-amber-700 text-white"
                                  : "border-slate-300 bg-white text-slate-600 hover:border-slate-500")}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
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
        )
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
