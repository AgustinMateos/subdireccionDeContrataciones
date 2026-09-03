"use client";

import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { TIPOS_SERVICIOS, ZONAS_SERVICIOS, ALERTA_ESTILO } from "@/lib/constants";
import { diasRestantes, alerta, diasFrenado, fmtFecha } from "@/lib/utils";

export default function InformeServicios({ expedientes }) {
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [zonaFiltro, setZonaFiltro] = useState("Todas");

  const activos = useMemo(
    () => (expedientes || []).filter(e => e.estadoGeneral !== "Archivado" && e.estadoGeneral !== "Finalizado"),
    [expedientes]
  );

  const filtrados = useMemo(() => {
    return activos.filter(e => {
      if (tipoFiltro !== "Todos" && e.tipo !== tipoFiltro) return false;
      if (zonaFiltro !== "Todas" && e.zona !== zonaFiltro) return false;
      return true;
    });
  }, [activos, tipoFiltro, zonaFiltro]);

  const porCategoria = useMemo(() => {
    const map = {};
    for (const e of activos) {
      const clave = e.tipo + " · " + (e.zona || "Sin zona");
      if (!map[clave]) map[clave] = { categoria: clave, tipo: e.tipo, zona: e.zona || "Sin zona", cantidad: 0 };
      map[clave].cantidad += 1;
    }
    return Object.values(map).sort((a, b) => TIPOS_SERVICIOS.indexOf(a.tipo) - TIPOS_SERVICIOS.indexOf(b.tipo) || a.zona.localeCompare(b.zona));
  }, [activos]);

  const proximosVencer = filtrados.filter(e => { const d = diasRestantes(e.fechaVencimiento); return d >= 0 && d < 90; }).length;
  const frenados = filtrados.filter(e => { const d = diasFrenado(e.observaciones); return d != null && d > 30; }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <ClipboardList size={18} className="text-slate-500" /> Informe de Servicios
          </h2>
          <p className="text-xs text-slate-500">Estado de convocatoria, sector y días de trámite por tipo de servicio y zona</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tipo de servicio</label>
            <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
              <option value="Todos">Todos los tipos</option>
              {TIPOS_SERVICIOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Zona</label>
            <select value={zonaFiltro} onChange={e => setZonaFiltro(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
              <option value="Todas">Todas las zonas</option>
              {ZONAS_SERVICIOS.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No hay expedientes de Servicios activos con esos filtros.
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Expedientes activos</div>
              <div className="text-2xl font-semibold text-slate-900">{filtrados.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Próximos a vencer (&lt; 90 días)</div>
              <div className="text-2xl font-semibold text-slate-900">{proximosVencer}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Frenados hace más de 30 días</div>
              <div className="text-2xl font-semibold text-slate-900">{frenados}</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expedientes por tipo y zona</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-5">Tipo</th>
                    <th className="py-2.5 px-5">Zona</th>
                    <th className="py-2.5 px-5">Expedientes</th>
                  </tr>
                </thead>
                <tbody>
                  {porCategoria.map(c => (
                    <tr key={c.categoria} className="border-b border-slate-50 last:border-0">
                      <td className="py-2 px-5 font-medium text-slate-900">{c.tipo}</td>
                      <td className="py-2 px-5 text-slate-600">{c.zona}</td>
                      <td className="py-2 px-5 text-slate-600">{c.cantidad}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle de expedientes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-5">Expediente</th>
                    <th className="py-2.5 px-5">Objeto</th>
                    <th className="py-2.5 px-5">Sector</th>
                    <th className="py-2.5 px-5">Estado de convocatoria</th>
                    <th className="py-2.5 px-5">Días restantes</th>
                    <th className="py-2.5 px-5">Días frenado</th>
                    <th className="py-2.5 px-5">Agente</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados
                    .slice()
                    .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))
                    .map(e => {
                      const dias = diasRestantes(e.fechaVencimiento);
                      const niv = alerta(dias);
                      const frenado = diasFrenado(e.observaciones);
                      return (
                        <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                          <td className="py-2.5 px-5">
                            <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                            {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                          </td>
                          <td className="py-2.5 px-5 text-slate-600 max-w-[240px] truncate">{e.objeto}</td>
                          <td className="py-2.5 px-5 text-slate-600">{e.sector || "-"}</td>
                          <td className="py-2.5 px-5 text-slate-600">{e.estadoConvocatoria || "-"}</td>
                          <td className="py-2.5 px-5">
                            <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[niv]}>
                              {dias >= 0 ? dias + " días" : Math.abs(dias) + " días vencido"}
                            </span>
                          </td>
                          <td className="py-2.5 px-5 text-slate-600">{frenado != null ? frenado + " días" : "-"}</td>
                          <td className="py-2.5 px-5 text-slate-500">{e.agente}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
