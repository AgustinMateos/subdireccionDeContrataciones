"use client";

import { useEffect, useMemo, useState } from "react";
import { estaFueraDeResoluciones } from "@/lib/resoluciones";

// Dos series en orden fijo de la paleta categórica (validada para
// daltonismo como par adyacente); el número va escrito en cada tramo y hay
// leyenda, así que la serie no se distingue solo por color.
const SERIES = [
  { clave: "en", etiqueta: "En Resoluciones", color: "#2a78d6" },
  { clave: "fuera", etiqueta: "Fuera de Resoluciones", color: "#eb6834" },
];

const SIN_ASIGNAR = "Sin asignar";

// Solapa de gráficos de la jefa de la Subdirección: cuántos expedientes en
// trámite (no finalizados) tiene cada agente en Resoluciones y fuera.
export default function GraficosResoluciones({ mostrarToast }) {
  const [expedientes, setExpedientes] = useState(null);
  const [activo, setActivo] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/resoluciones");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (vivo) setExpedientes(data.expedientes || []);
      } catch (err) {
        if (vivo) { setExpedientes([]); mostrarToast(err.message); }
      }
    })();
    return () => { vivo = false; };
    // Solo al montar: mostrarToast del Dashboard cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filas = useMemo(() => {
    const porAgente = new Map();
    for (const e of expedientes || []) {
      if (e.situacion === "FINALIZADO") continue;
      const agente = String(e.agente || "").trim() || SIN_ASIGNAR;
      const fila = porAgente.get(agente) || { agente, en: 0, fuera: 0 };
      fila[estaFueraDeResoluciones(e) ? "fuera" : "en"]++;
      porAgente.set(agente, fila);
    }
    // Más cargado primero; "Sin asignar" siempre al final.
    return [...porAgente.values()].sort((a, b) =>
      (a.agente === SIN_ASIGNAR) - (b.agente === SIN_ASIGNAR) || (b.en + b.fuera) - (a.en + a.fuera) || a.agente.localeCompare(b.agente));
  }, [expedientes]);

  if (expedientes === null) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando...</div>;
  }

  const max = Math.max(1, ...filas.map(f => f.en + f.fuera));
  const totales = filas.reduce((t, f) => ({ en: t.en + f.en, fuera: t.fuera + f.fuera }), { en: 0, fuera: 0 });

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Expedientes por agente</h3>
            <span className="text-[11px] text-slate-500">En trámite (sin finalizados): {totales.en + totales.fuera} expedientes</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-700">
            {SERIES.map(s => (
              <span key={s.clave} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.etiqueta}
              </span>
            ))}
          </div>
        </div>
        {filas.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Sin expedientes en trámite.</div>
        ) : (
          <div className="px-5 py-4 space-y-1" onMouseLeave={() => setActivo(null)}>
            {filas.map(f => {
              const total = f.en + f.fuera;
              const esActivo = activo === f.agente;
              return (
                <div
                  key={f.agente}
                  onMouseEnter={() => setActivo(f.agente)}
                  className={"grid grid-cols-[90px_1fr_auto] items-center gap-3 rounded px-1 py-1 " + (esActivo ? "bg-slate-50" : "")}
                >
                  <span className="text-xs font-medium text-slate-700 truncate" title={f.agente}>{f.agente}</span>
                  <div className="flex h-5 min-w-0" style={{ width: (total / max) * 100 + "%", opacity: activo && !esActivo ? 0.45 : 1 }}>
                    {SERIES.map((s, i) => f[s.clave] > 0 && (
                      <div
                        key={s.clave}
                        title={s.etiqueta + ": " + f[s.clave]}
                        className={"h-full flex items-center justify-center text-[11px] font-semibold text-white tabular-nums " +
                          (i === SERIES.length - 1 || !f[SERIES[i + 1].clave] ? "rounded-r" : "")}
                        style={{
                          width: (f[s.clave] / total) * 100 + "%",
                          minWidth: 18,
                          background: s.color,
                          // Separación de 2px entre los dos tramos.
                          marginLeft: i > 0 && f[SERIES[i - 1].clave] > 0 ? 2 : 0,
                        }}
                      >
                        {f[s.clave]}
                      </div>
                    ))}
                  </div>
                  <span className="text-xs font-semibold text-slate-900 tabular-nums w-8 text-right">{total}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Los mismos números en tabla. */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden max-w-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50/60">
              <th className="py-2 px-4 font-medium">Agente</th>
              <th className="py-2 px-4 font-medium text-right">En Resoluciones</th>
              <th className="py-2 px-4 font-medium text-right">Fuera</th>
              <th className="py-2 px-4 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.agente} className="border-b border-slate-50">
                <td className="py-1.5 px-4 text-slate-700">{f.agente}</td>
                <td className="py-1.5 px-4 text-right tabular-nums">{f.en}</td>
                <td className="py-1.5 px-4 text-right tabular-nums">{f.fuera}</td>
                <td className="py-1.5 px-4 text-right font-semibold tabular-nums">{f.en + f.fuera}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/60 font-semibold">
              <td className="py-1.5 px-4">Total</td>
              <td className="py-1.5 px-4 text-right tabular-nums">{totales.en}</td>
              <td className="py-1.5 px-4 text-right tabular-nums">{totales.fuera}</td>
              <td className="py-1.5 px-4 text-right tabular-nums">{totales.en + totales.fuera}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
