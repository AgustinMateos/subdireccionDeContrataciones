"use client";

import { Plus, Filter, FilePlus2 } from "lucide-react";
import { AREA_LABEL, TIPOS_SERVICIOS, ZONAS } from "@/lib/constants";
import FiltroDesplegable from "./FiltroDesplegable";
import FiltroOrganismo from "./FiltroOrganismo";

const CLASE_VENCIMIENTO = {
  Todos: "bg-white border-slate-300 text-slate-700",
  criticos: "bg-red-50 border-red-300 text-red-700",
  proximos: "bg-amber-50 border-amber-300 text-amber-700",
  vencidos: "bg-gray-100 border-gray-300 text-gray-700",
  enPlazo: "bg-emerald-50 border-emerald-300 text-emerald-700",
};

export default function FiltroBar({ areaFiltro, setAreaFiltro, tipoFiltro, setTipoFiltro, estadoFiltro, setEstadoFiltro, organismoFiltro, setOrganismoFiltro, vencimientoFiltro, setVencimientoFiltro, nombreCortoFiltro, setNombreCortoFiltro, zonaFiltro, setZonaFiltro, total, puedeEditar, onNuevo, onCaratular, departamentoSlug }) {
  const esServicios = departamentoSlug === "servicios";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!esServicios && (
          <>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide mr-1">Área</span>
            {["Todas", "Informatica", "Varios"].map(a => (
              <button key={a} onClick={() => setAreaFiltro(a)}
                className={"px-3 py-1.5 rounded-full text-xs font-medium border transition-colors " +
                  (areaFiltro === a ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500")}>
                {a === "Todas" ? "Todas" : AREA_LABEL[a]}
              </button>
            ))}
          </>
        )}
        {puedeEditar && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={onCaratular} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50">
              <FilePlus2 size={14} /> Caratular
            </button>
            <button onClick={onNuevo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              <Plus size={14} /> Cargar expediente
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter size={13} /> Filtros:
        </div>
        <FiltroDesplegable
          valor={tipoFiltro}
          onChange={setTipoFiltro}
          opciones={[
            { valor: "Todos", etiqueta: "Todos los tipos" },
            ...(esServicios ? TIPOS_SERVICIOS : ["Servicios", "Provisiones", "Servicios Temporales"]).map(t => ({ valor: t, etiqueta: t })),
          ]}
        />
        <FiltroDesplegable
          valor={zonaFiltro}
          onChange={setZonaFiltro}
          opciones={[{ valor: "Todas", etiqueta: "Todas las zonas" }, ...ZONAS.map(z => ({ valor: z, etiqueta: z }))]}
        />
        <FiltroDesplegable
          valor={estadoFiltro}
          onChange={setEstadoFiltro}
          opciones={[
            { valor: "Todos", etiqueta: "Todos los estados" },
            ...["Vigente", "En trámite de renovación", "Finalizado", "Archivado"].map(e => ({ valor: e, etiqueta: e })),
          ]}
        />
        <FiltroDesplegable
          valor={vencimientoFiltro}
          onChange={setVencimientoFiltro}
          clase={CLASE_VENCIMIENTO[vencimientoFiltro] || CLASE_VENCIMIENTO.Todos}
          opciones={[
            { valor: "Todos", etiqueta: "Cualquier vencimiento" },
            { valor: "proximos", etiqueta: "Próximos a vencer (< 90 días)" },
            { valor: "criticos", etiqueta: "Críticos (< 30 días)" },
            { valor: "enPlazo", etiqueta: "En plazo (≥ 90 días)" },
            { valor: "vencidos", etiqueta: "Vencidos" },
          ]}
        />
        <FiltroOrganismo valor={organismoFiltro} onChange={setOrganismoFiltro} />
        {!esServicios && (
          <>
            <input
              value={nombreCortoFiltro}
              onChange={e => setNombreCortoFiltro(e.target.value)}
              placeholder="Filtrar por nombre corto"
              className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white w-[200px] focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
            {nombreCortoFiltro && (
              <button onClick={() => setNombreCortoFiltro("")} className="text-[11px] text-slate-500 hover:text-slate-800 underline">
                Quitar nombre
              </button>
            )}
          </>
        )}
        <span className="ml-auto text-xs text-slate-500">{total} expediente{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

