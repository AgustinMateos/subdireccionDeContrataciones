"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ALERTA_ESTILO, ALERTA_LABEL, ZONAS, TIPOS_SERVICIOS, SECTORES, ESTADOS_CONVOCATORIA } from "@/lib/constants";
import { diasRestantes, alerta, alertaFrenado, diasFrenado } from "@/lib/utils";

const norm = s => String(s || "").trim().toLowerCase();

// Niveles de "Días frenado" — mismos colores que alerta() pero sin
// "vencido" (acá no aplica: frenado mide días parado en un sector, no
// vencimiento) y sumando "Sin frenar" para lo que no tiene nada frenado.
const NIVELES_FRENADO = ["rojo", "amarillo", "verde"];

function filtroVacio() {
  return {
    exp: "", fuero: "", domicilio: "",
    zona: "Todas", tipo: "Todos", sector: "Todos", estadoConvocatoria: "Todos",
    diasRestantes: "Todos", diasFrenado: "Todos",
  };
}

// Vista alternativa a las tarjetas para el listado de Servicios: una fila
// por expediente (sin agrupar por trámite), en el mismo estilo que la tabla
// "Detalle de expedientes" del Informe de Servicios — con un filtro propio
// por cada columna, independiente de los filtros generales de arriba. Los
// antecedentes no se muestran, mismo criterio que las tarjetas de grupo (ya
// es cobertura cerrada y reemplazada).
export default function TablaExpedientesServicios({ expedientes, onVer, puedeEditar, onCambiarSector, onCambiarEstadoConvocatoria }) {
  const [f, setF] = useState(filtroVacio);
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }
  function limpiar() { setF(filtroVacio()); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  const base = useMemo(() => (expedientes || []).filter(e => e.rol !== "antecedente"), [expedientes]);

  const filas = useMemo(() => {
    return base.filter(e => {
      if (f.exp && !norm(e.exp + " " + (e.nombreCorto || "")).includes(norm(f.exp))) return false;
      if (f.fuero && !norm((e.fuero || []).join(" ")).includes(norm(f.fuero))) return false;
      if (f.domicilio && !norm((e.domiciliosRenglones || []).join(" ")).includes(norm(f.domicilio))) return false;
      if (f.zona !== "Todas" && e.zona !== f.zona) return false;
      if (f.tipo !== "Todos" && e.tipo !== f.tipo) return false;
      if (f.sector !== "Todos" && e.sector !== f.sector) return false;
      if (f.estadoConvocatoria !== "Todos" && (e.estadoConvocatoria || "") !== f.estadoConvocatoria) return false;
      if (f.diasRestantes !== "Todos" && alerta(diasRestantes(e.fechaVencimiento)) !== f.diasRestantes) return false;
      if (f.diasFrenado !== "Todos") {
        const frenado = diasFrenado(e.observaciones, e.creadoEn);
        if (f.diasFrenado === "sinFrenar") { if (frenado != null) return false; }
        else if (frenado == null || alertaFrenado(frenado) !== f.diasFrenado) return false;
      }
      return true;
    });
  }, [base, f]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-[11px] text-slate-500">{filas.length} de {base.length} expediente{base.length !== 1 ? "s" : ""}</span>
        {hayFiltros && (
          <button type="button" onClick={limpiar} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
            <X size={12} /> Limpiar filtros de la tabla
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="py-2.5 px-5">Expediente</th>
              <th className="py-2.5 px-5">Fuero</th>
              <th className="py-2.5 px-5">Domicilio</th>
              <th className="py-2.5 px-5">Zona</th>
              <th className="py-2.5 px-5">Tipo</th>
              <th className="py-2.5 px-5">Sector</th>
              <th className="py-2.5 px-5">Estado de convocatoria</th>
              <th className="py-2.5 px-5">Días restantes</th>
              <th className="py-2.5 px-5">Días frenado</th>
            </tr>
            <tr className="border-b border-slate-100 bg-slate-50/40">
              <th className="px-5 pb-2">
                <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Buscar..."
                  className="w-full text-xs font-normal border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-800" />
              </th>
              <th className="px-5 pb-2">
                <input value={f.fuero} onChange={e => set("fuero", e.target.value)} placeholder="Buscar..."
                  className="w-full text-xs font-normal border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-800" />
              </th>
              <th className="px-5 pb-2">
                <input value={f.domicilio} onChange={e => set("domicilio", e.target.value)} placeholder="Buscar..."
                  className="w-full text-xs font-normal border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-800" />
              </th>
              <th className="px-5 pb-2">
                <select value={f.zona} onChange={e => set("zona", e.target.value)}
                  className="w-full text-xs font-normal border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800">
                  <option value="Todas">Todas</option>
                  {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </th>
              <th className="px-5 pb-2">
                <select value={f.tipo} onChange={e => set("tipo", e.target.value)}
                  className="w-full text-xs font-normal border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800">
                  <option value="Todos">Todos</option>
                  {TIPOS_SERVICIOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </th>
              <th className="px-5 pb-2">
                <select value={f.sector} onChange={e => set("sector", e.target.value)}
                  className="w-full text-xs font-normal border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800">
                  <option value="Todos">Todos</option>
                  {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
              <th className="px-5 pb-2">
                <select value={f.estadoConvocatoria} onChange={e => set("estadoConvocatoria", e.target.value)}
                  className="w-full text-xs font-normal border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800">
                  <option value="Todos">Todos</option>
                  {ESTADOS_CONVOCATORIA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
              <th className="px-5 pb-2">
                <select value={f.diasRestantes} onChange={e => set("diasRestantes", e.target.value)}
                  className="w-full text-xs font-normal border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800">
                  <option value="Todos">Todos</option>
                  {Object.keys(ALERTA_LABEL).map(n => <option key={n} value={n}>{ALERTA_LABEL[n]}</option>)}
                </select>
              </th>
              <th className="px-5 pb-2">
                <select value={f.diasFrenado} onChange={e => set("diasFrenado", e.target.value)}
                  className="w-full text-xs font-normal border border-slate-300 rounded px-1.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800">
                  <option value="Todos">Todos</option>
                  <option value="sinFrenar">Sin frenar</option>
                  {NIVELES_FRENADO.map(n => <option key={n} value={n}>{ALERTA_LABEL[n]}</option>)}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-10 text-center text-sm text-slate-500">
                  No se encontraron expedientes con esos filtros.
                </td>
              </tr>
            ) : filas.map(e => {
              const yaCerrado = e.estadoGeneral === "Finalizado" || e.estadoGeneral === "Archivado";
              const dias = diasRestantes(e.fechaVencimiento);
              const niv = alerta(dias);
              const frenado = diasFrenado(e.observaciones, e.creadoEn);
              const fuero = (e.fuero || []).join(" · ");
              const domicilio = (e.domiciliosRenglones || []).join(" · ");
              return (
                <tr
                  key={e.id}
                  onClick={() => onVer(e.id)}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                >
                  <td className="py-2.5 px-5">
                    <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                    {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600 max-w-[200px] truncate" title={fuero}>{fuero || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600 max-w-[240px] truncate" title={domicilio}>{domicilio || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.zona || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.tipo}</td>
                  <td className="py-2.5 px-5 text-slate-600">
                    {puedeEditar ? (
                      <button
                        type="button"
                        onClick={e2 => { e2.stopPropagation(); onCambiarSector(e); }}
                        className="underline decoration-dotted underline-offset-2 hover:text-slate-900 hover:decoration-solid"
                        title="Cambiar sector"
                      >
                        {e.sector || "Sin definir"}
                      </button>
                    ) : (e.sector || "-")}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600">
                    {puedeEditar ? (
                      <button
                        type="button"
                        onClick={e2 => { e2.stopPropagation(); onCambiarEstadoConvocatoria(e); }}
                        className="underline decoration-dotted underline-offset-2 hover:text-slate-900 hover:decoration-solid"
                        title="Cambiar estado de convocatoria"
                      >
                        {e.estadoConvocatoria || "Sin definir"}
                      </button>
                    ) : (e.estadoConvocatoria || "-")}
                  </td>
                  <td className="py-2.5 px-5">
                    {yaCerrado ? "-" : (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[niv]}>
                        {dias >= 0 ? dias + " días" : Math.abs(dias) + " días vencido"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-5">
                    {frenado != null ? (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(frenado)]}>
                        {frenado + " días"}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
