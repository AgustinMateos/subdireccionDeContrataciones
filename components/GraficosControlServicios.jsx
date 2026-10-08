"use client";

import { useMemo, useState } from "react";

// Una sola serie por gráfico: un único color (el azul de la planilla), sin
// paleta categórica — la categoría la dice la etiqueta de cada barra.
const COLOR_BARRA = "#2a78d6";

// "Servicios Varios / Prevención de Incendios" → "Servicios Varios"
const tipoCorto = t => String(t || "Sin tipo").split(" / ")[0];

function contar(lista, clave) {
  const conteo = new Map();
  for (const e of lista) {
    const k = clave(e);
    conteo.set(k, (conteo.get(k) || 0) + 1);
  }
  // De mayor a menor; a igual cantidad, alfabético.
  return [...conteo.entries()]
    .map(([etiqueta, cantidad]) => ({ etiqueta, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta));
}

// Barras horizontales con la cantidad al final de cada una. Al pasar el
// mouse por una fila (toda la fila es el área de hover) se resalta y se ve
// el porcentaje sobre el total.
function GraficoBarras({ titulo, datos, total }) {
  const [activa, setActiva] = useState(null);
  const max = Math.max(1, ...datos.map(d => d.cantidad));
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <span className="text-[11px] text-slate-500">{total} expediente{total !== 1 ? "s" : ""}</span>
      </div>
      {datos.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">Sin datos.</div>
      ) : (
        <div className="px-5 py-4 space-y-0.5" onMouseLeave={() => setActiva(null)}>
          {datos.map(d => {
            const pct = Math.round((d.cantidad / total) * 1000) / 10;
            const esActiva = activa === d.etiqueta;
            return (
              <div
                key={d.etiqueta}
                onMouseEnter={() => setActiva(d.etiqueta)}
                className={"grid grid-cols-[minmax(0,160px)_1fr] items-center gap-3 rounded px-1 py-1 " + (esActiva ? "bg-slate-50" : "")}
              >
                <span className="text-xs text-slate-700 truncate" title={d.etiqueta}>{d.etiqueta}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="h-4 rounded-r transition-opacity"
                    style={{
                      width: (d.cantidad / max) * 100 + "%",
                      minWidth: 4,
                      background: COLOR_BARRA,
                      opacity: activa && !esActiva ? 0.45 : 1,
                    }}
                  />
                  <span className="text-xs font-semibold text-slate-900 tabular-nums">{d.cantidad}</span>
                  {esActiva && <span className="text-[11px] text-slate-500 whitespace-nowrap">{pct}% del total</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Solapa "Gráficos" del panel de control de Servicios: los mismos
// expedientes de la planilla (parches y renovaciones en trámite), contados
// por tipo de servicio y zona, y por agente.
export default function GraficosControlServicios({ expedientes }) {
  const porTipo = useMemo(
    () => contar(expedientes, e => tipoCorto(e.tipo) + (e.zona ? " " + e.zona : "")),
    [expedientes],
  );
  const porAgente = useMemo(
    () => contar(expedientes, e => String(e.agente || "").trim().toUpperCase() || "Sin agente"),
    [expedientes],
  );
  const total = expedientes.length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-baseline gap-3">
        <span className="text-3xl font-semibold text-slate-900 tabular-nums">{total}</span>
        <span className="text-sm text-slate-600">expedientes de Servicios en trámite (parches y renovaciones)</span>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <GraficoBarras titulo="Expedientes por tipo y zona" datos={porTipo} total={total} />
        <GraficoBarras titulo="Cantidad de contrataciones por agente" datos={porAgente} total={total} />
      </div>
    </div>
  );
}
