"use client";

import { Plus, Filter, FilePlus2 } from "lucide-react";
import { ORGANISMOS, AREA_LABEL, TIPOS_SERVICIOS, ZONAS } from "@/lib/constants";
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
        <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)} className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white">
          <option value="Todos">Todos los tipos</option>
          {esServicios
            ? TIPOS_SERVICIOS.map(t => <option key={t} value={t}>{t}</option>)
            : (
              <>
                <option value="Servicios">Servicios</option>
                <option value="Provisiones">Provisiones</option>
                <option value="Servicios Temporales">Servicios Temporales</option>
              </>
            )}
        </select>
        <select value={zonaFiltro} onChange={e => setZonaFiltro(e.target.value)} className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white">
          <option value="Todas">Todas las zonas</option>
          {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        <select value={estadoFiltro} onChange={e => setEstadoFiltro(e.target.value)} className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white">
          <option value="Todos">Todos los estados</option>
          <option value="Vigente">Vigente</option>
          <option value="En trámite de renovación">En trámite de renovación</option>
          <option value="Finalizado">Finalizado</option>
          <option value="Archivado">Archivado</option>
        </select>
        <select value={vencimientoFiltro} onChange={e => setVencimientoFiltro(e.target.value)}
          className={"text-xs border rounded-md px-2.5 py-1.5 " +
            (vencimientoFiltro === "criticos" ? "bg-red-50 border-red-300 text-red-700" :
              vencimientoFiltro === "proximos" ? "bg-amber-50 border-amber-300 text-amber-700" :
              vencimientoFiltro === "vencidos" ? "bg-gray-100 border-gray-300 text-gray-700" :
              vencimientoFiltro === "enPlazo" ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
              "bg-white border-slate-300")}>
          <option value="Todos">Cualquier vencimiento</option>
          <option value="proximos">Próximos a vencer (&lt; 90 días)</option>
          <option value="criticos">Críticos (&lt; 30 días)</option>
          <option value="enPlazo">En plazo (&ge; 90 días)</option>
          <option value="vencidos">Vencidos</option>
        </select>
        <select value={organismoFiltro} onChange={e => setOrganismoFiltro(e.target.value)} className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white max-w-[220px]">
          <option value="Todos">Todos los organismos</option>
          {ORGANISMOS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        {organismoFiltro !== "Todos" && (
          <button onClick={() => setOrganismoFiltro("Todos")} className="text-[11px] text-slate-500 hover:text-slate-800 underline">
            Quitar organismo
          </button>
        )}
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
        <span className="ml-auto text-xs text-slate-500">{total} expediente{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</span>
      </div>
    </div>
  );
}

