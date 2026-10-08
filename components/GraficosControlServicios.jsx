"use client";

import { useMemo, useState } from "react";
import { TIPOS_SERVICIOS, ZONAS } from "@/lib/constants";

// Una sola serie por gráfico: un único color (el azul de la planilla), sin
// paleta categórica — la categoría la dice la etiqueta de cada barra.
const COLOR_BARRA = "#2a78d6";

// Colores de la torta (paleta categórica validada para daltonismo, en
// orden fijo). Más de 8 porciones no se distinguen: el resto va a "Otros".
const COLORES_TORTA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const COLOR_OTROS = "#9ca3af";
const MAX_PORCIONES = COLORES_TORTA.length;

// "Servicios Varios / Prevención de Incendios" → "Servicios Varios"
// 0.14 del total → "14,0%"
const fmtPct = (n, total) => ((n / total) * 100).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";

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
                  {esActiva && <span className="text-[11px] text-slate-500 whitespace-nowrap">{fmtPct(d.cantidad, total)} del total</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Torta con agujero (dona). Las porciones más chicas se juntan en "Otros"
// si no entran en la paleta. El color sigue a la categoría (orden fijo de
// tipo y zona), no a su tamaño. Al pasar el mouse por una porción o por su
// fila de la leyenda, se resalta y el centro muestra su cantidad y %.
function GraficoTorta({ titulo, datos, total, orden }) {
  const [activa, setActiva] = useState(null);
  const porciones = useMemo(() => {
    let visibles = datos;
    let otros = null;
    if (datos.length > MAX_PORCIONES) {
      visibles = datos.slice(0, MAX_PORCIONES - 1);
      const resto = datos.slice(MAX_PORCIONES - 1);
      otros = { etiqueta: "Otros (" + resto.length + ")", cantidad: resto.reduce((n, d) => n + d.cantidad, 0), color: COLOR_OTROS, detalle: resto };
    }
    const coloreadas = [...visibles]
      .sort((a, b) => orden(a.etiqueta) - orden(b.etiqueta) || a.etiqueta.localeCompare(b.etiqueta))
      .map((d, i) => ({ ...d, color: COLORES_TORTA[i] }));
    // Se dibujan de mayor a menor; "Otros" siempre al final.
    return [...coloreadas.sort((a, b) => b.cantidad - a.cantidad), ...(otros ? [otros] : [])];
  }, [datos, orden]);

  const R = 80, r = 50, C = 100; // radios externo/interno y centro (viewBox 200x200)
  let angulo = -Math.PI / 2;
  const arcos = porciones.map(p => {
    const barrido = (p.cantidad / total) * Math.PI * 2;
    const a0 = angulo, a1 = angulo + barrido;
    angulo = a1;
    const punto = (rad, a) => [C + rad * Math.cos(a), C + rad * Math.sin(a)];
    const grande = barrido > Math.PI ? 1 : 0;
    const [x0, y0] = punto(R, a0), [x1, y1] = punto(R, a1), [x2, y2] = punto(r, a1), [x3, y3] = punto(r, a0);
    const d = porciones.length === 1
      ? `M ${C - R} ${C} A ${R} ${R} 0 1 1 ${C + R} ${C} A ${R} ${R} 0 1 1 ${C - R} ${C} M ${C - r} ${C} A ${r} ${r} 0 1 0 ${C + r} ${C} A ${r} ${r} 0 1 0 ${C - r} ${C} Z`
      : `M ${x0} ${y0} A ${R} ${R} 0 ${grande} 1 ${x1} ${y1} L ${x2} ${y2} A ${r} ${r} 0 ${grande} 0 ${x3} ${y3} Z`;
    return { ...p, d };
  });
  const enfocada = porciones.find(p => p.etiqueta === activa);
  const pct = n => fmtPct(n, total);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <span className="text-[11px] text-slate-500">{total} expediente{total !== 1 ? "s" : ""}</span>
      </div>
      {total === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500">Sin datos.</div>
      ) : (
        <div className="px-5 py-4 flex flex-col sm:flex-row items-center gap-6" onMouseLeave={() => setActiva(null)}>
          <svg viewBox="0 0 200 200" className="w-48 h-48 shrink-0" role="img" aria-label={titulo}>
            {arcos.map(a => (
              <path
                key={a.etiqueta}
                d={a.d}
                fill={a.color}
                fillRule="evenodd"
                stroke="#ffffff"
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={activa && activa !== a.etiqueta ? 0.35 : 1}
                onMouseEnter={() => setActiva(a.etiqueta)}
                className="transition-opacity cursor-default"
              >
                <title>{a.etiqueta + ": " + a.cantidad + " (" + pct(a.cantidad) + ")"}</title>
              </path>
            ))}
            <text x={C} y={C - 4} textAnchor="middle" className="fill-slate-900" style={{ fontSize: 24, fontWeight: 600 }}>
              {enfocada ? enfocada.cantidad : total}
            </text>
            <text x={C} y={C + 14} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>
              {enfocada ? pct(enfocada.cantidad) : "total"}
            </text>
          </svg>
          <ul className="w-full min-w-0 space-y-0.5">
            {porciones.map(p => (
              <li
                key={p.etiqueta}
                onMouseEnter={() => setActiva(p.etiqueta)}
                title={p.detalle ? p.detalle.map(d => d.etiqueta + ": " + d.cantidad).join("\n") : undefined}
                className={"flex items-center gap-2 rounded px-1.5 py-1 text-xs " + (activa === p.etiqueta ? "bg-slate-50" : "")}
              >
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
                <span className="flex-1 min-w-0 truncate text-slate-700">{p.etiqueta}</span>
                <span className="font-semibold text-slate-900 tabular-nums">{p.cantidad}</span>
                <span className="w-12 text-right text-slate-500 tabular-nums">{pct(p.cantidad)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Orden fijo de las categorías "tipo zona" para asignar colores: el del
// catálogo de tipos de Servicios y, dentro de cada tipo, el de las zonas.
function ordenTipoZona(etiqueta) {
  const i = TIPOS_SERVICIOS.map(tipoCorto).findIndex(t => etiqueta === t || etiqueta.startsWith(t + " "));
  const zona = ZONAS.findIndex(z => etiqueta.endsWith(" " + z));
  return (i === -1 ? TIPOS_SERVICIOS.length : i) * 10 + (zona === -1 ? 9 : zona);
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
        <GraficoTorta titulo="Expedientes en el sector" datos={porTipo} total={total} orden={ordenTipoZona} />
        <GraficoBarras titulo="Expedientes por tipo y zona" datos={porTipo} total={total} />
        <GraficoBarras titulo="Cantidad de contrataciones por agente" datos={porAgente} total={total} />
      </div>
    </div>
  );
}
