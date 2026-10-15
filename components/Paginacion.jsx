"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import FiltroDesplegable from "./FiltroDesplegable";

export const OPCIONES_POR_PAGINA = [15, 30, 50, 100];

// Números de página a mostrar (base 0): siempre la primera y la última,
// y las vecinas de la actual; los huecos van como "…".
function paginasVisibles(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  let desde = Math.max(1, Math.min(actual - 1, total - 5));
  let hasta = Math.min(total - 2, Math.max(actual + 1, 4));
  // Un "…" que taparía una sola página muestra esa página.
  if (desde === 2) desde = 1;
  if (hasta === total - 3) hasta = total - 2;
  const medio = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  return [0, ...(desde > 1 ? ["…izq"] : []), ...medio, ...(hasta < total - 2 ? ["…der"] : []), total - 1];
}

const BOTON_FLECHA = "p-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white";

// Pie de tabla: "1–15 de 746", filas por página y salto de páginas.
export default function Paginacion({ total, pagina, porPagina, onPagina, onPorPagina }) {
  if (!total) return null;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const actual = Math.min(pagina, totalPaginas - 1);
  const desde = actual * porPagina + 1;
  const hasta = Math.min(total, (actual + 1) * porPagina);

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-2.5 border-t border-slate-100 text-xs text-slate-500">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          <span className="font-medium text-slate-700">{desde}–{hasta}</span> de {total}
        </span>
        <div className="flex items-center gap-1.5">
          Filas
          <FiltroDesplegable valor={String(porPagina)} onChange={v => onPorPagina(Number(v))} flotante
            opciones={OPCIONES_POR_PAGINA.map(n => ({ valor: String(n), etiqueta: String(n) }))} />
        </div>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onPagina(0)} disabled={actual === 0} title="Primera página" className={BOTON_FLECHA + " hidden sm:block"}>
            <ChevronsLeft size={14} />
          </button>
          <button type="button" onClick={() => onPagina(actual - 1)} disabled={actual === 0} title="Página anterior" className={BOTON_FLECHA}>
            <ChevronLeft size={14} />
          </button>
          {paginasVisibles(actual, totalPaginas).map(p => typeof p === "string" ? (
            <span key={p} className="min-w-[20px] text-center text-slate-400 select-none">…</span>
          ) : (
            <button key={p} type="button" onClick={() => onPagina(p)} aria-current={p === actual ? "page" : undefined}
              className={"min-w-[26px] px-1.5 py-1 rounded-md text-xs font-medium tabular-nums " +
                (p === actual ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
              {p + 1}
            </button>
          ))}
          <button type="button" onClick={() => onPagina(actual + 1)} disabled={actual === totalPaginas - 1} title="Página siguiente" className={BOTON_FLECHA}>
            <ChevronRight size={14} />
          </button>
          <button type="button" onClick={() => onPagina(totalPaginas - 1)} disabled={actual === totalPaginas - 1} title="Última página" className={BOTON_FLECHA + " hidden sm:block"}>
            <ChevronsRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
