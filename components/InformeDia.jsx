"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { EVENTO_ABRIR_RESOLUCION } from "@/lib/resoluciones";

// Observaciones y renovaciones de ofertas se leen como texto (como en el
// historial del expediente).
const esTexto = m => m.campo === "Observaciones" || m.campo === "Renovación de ofertas";
const hora = f => (f ? new Date(f).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "-");

// "2026-10-21" ± n días.
function moverDia(dia, n) {
  const d = new Date(dia + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function diaLargo(dia) {
  return new Date(dia + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const COLUMNAS_INGRESO = [
  ["Hora", e => hora(e.hora)], ["Exp.", e => e.exp], ["Objeto", e => e.objeto], ["Fuero", e => e.fuero], ["Organismo", e => e.organismo],
  ["Tipo de contratación", e => e.tipoContratacion], ["Número", e => e.numero], ["Tipo de resolución", e => e.tipoResolucion],
  ["Agente", e => e.agente], ["Cómo", e => (e.tipo === "reingreso" ? e.detalle : "Ingresó")], ["Usuario", e => e.usuario],
];

function exportarExcel(ingresos, movimientos, dia) {
  const wb = XLSX.utils.book_new();
  if (ingresos.length) {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNAS_INGRESO.map(([t]) => t.toUpperCase()), ...ingresos.map(e => COLUMNAS_INGRESO.map(([, v]) => v(e) || ""))]);
    ws["!cols"] = [8, 16, 40, 24, 24, 16, 10, 18, 10, 40, 20].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Ingresaron");
  }
  const datos = [
    ["HORA", "EXP.", "OBJETO", "AGENTE", "CAMPO", "ANTES", "AHORA", "USUARIO"],
    ...movimientos.map(m => [hora(m.creadoEn), m.expediente.exp, m.expediente.objeto, m.expediente.agente || "", m.campo, m.sectorAnterior || "", m.sector, m.usuario]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws["!cols"] = [8, 16, 40, 10, 18, 30, 50, 20].map(wch => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
  XLSX.writeFile(wb, "resoluciones-movimientos-" + dia + ".xlsx");
}

// Informe del día de Resoluciones: los expedientes que ingresaron (se
// cargaron o reingresaron) y todo lo que quedó en el historial en una
// fecha, agrupado por expediente, con quién lo hizo.
export default function InformeDia() {
  const hoy = hoyLocalISO();
  const [dia, setDia] = useState(hoy);
  const [datos, setDatos] = useState(null); // { fecha, movimientos } | { error }
  const [usuario, setUsuario] = useState("");

  useEffect(() => {
    let activo = true;
    setDatos(null);
    fetch("/api/resoluciones/informe-dia?fecha=" + dia)
      .then(r => r.json())
      .then(d => activo && setDatos(d))
      .catch(() => activo && setDatos({ error: "No se pudo cargar el informe" }));
    return () => { activo = false; };
  }, [dia]);

  const todos = datos?.movimientos || [];
  const usuarios = useMemo(() => {
    const cuenta = {};
    for (const m of todos) cuenta[m.usuario] = (cuenta[m.usuario] || 0) + 1;
    return Object.entries(cuenta).sort((a, b) => b[1] - a[1]);
  }, [todos]);
  const movimientos = usuario ? todos.filter(m => m.usuario === usuario) : todos;
  const ingresos = (datos?.ingresos || []).filter(e => !usuario || e.usuario === usuario);
  // Por expediente, en el orden del primer movimiento del día.
  const grupos = useMemo(() => {
    const porExp = new Map();
    for (const m of movimientos) {
      if (!porExp.has(m.expedienteId)) porExp.set(m.expedienteId, { e: m.expediente, movimientos: [] });
      porExp.get(m.expedienteId).movimientos.push(m);
    }
    return [...porExp.values()];
  }, [movimientos]);
  const altas = ingresos.filter(e => e.tipo === "alta").length;
  const reingresos = ingresos.length - altas;

  function elegirDia(v) { if (v) { setDia(v); setUsuario(""); } }
  const abrir = id => window.dispatchEvent(new CustomEvent(EVENTO_ABRIR_RESOLUCION, { detail: { id } }));

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Informe del día</h3>
          <span className="text-[11px] text-slate-500 first-letter:uppercase inline-block">{diaLargo(dia)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => elegirDia(moverDia(dia, -1))} title="Día anterior" aria-label="Día anterior"
            className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"><ChevronLeft size={14} /></button>
          <input type="date" value={dia} max={hoy} onChange={e => elegirDia(e.target.value)}
            className="text-xs bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 focus:outline-none focus:border-slate-500" />
          <button type="button" onClick={() => elegirDia(moverDia(dia, 1))} disabled={dia >= hoy} title="Día siguiente" aria-label="Día siguiente"
            className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"><ChevronRight size={14} /></button>
          {dia !== hoy && (
            <button type="button" onClick={() => elegirDia(hoy)} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">Hoy</button>
          )}
          <button type="button" onClick={() => exportarExcel(ingresos, movimientos, dia)} disabled={!movimientos.length && !ingresos.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40">
            <Download size={14} /> Exportar a Excel
          </button>
        </div>
      </div>

      {datos === null ? (
        <div className="py-16 text-center text-sm text-slate-500">Cargando el informe...</div>
      ) : datos.error ? (
        <div className="py-16 text-center text-sm text-red-700">{datos.error}</div>
      ) : todos.length === 0 && !datos.ingresos?.length ? (
        <div className="py-16 text-center text-sm text-slate-500">Ese día no hubo movimientos en Resoluciones.</div>
      ) : (
        <>
          <div className="px-5 py-3 border-b border-slate-100 space-y-2">
            <p className="text-sm text-slate-700">
              <b>{movimientos.length}</b> movimiento{movimientos.length !== 1 ? "s" : ""} en <b>{grupos.length}</b> expediente{grupos.length !== 1 ? "s" : ""}
              {altas > 0 && <> · <b>{altas}</b> ingresado{altas !== 1 ? "s" : ""}</>}
              {reingresos > 0 && <> · <b>{reingresos}</b> reingreso{reingresos !== 1 ? "s" : ""}</>}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {usuarios.map(([u, n]) => (
                <button key={u} type="button" onClick={() => setUsuario(usuario === u ? "" : u)}
                  className={"px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors " +
                    (usuario === u ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-300 text-slate-600 hover:border-slate-500")}>
                  {u} ({n})
                </button>
              ))}
              {usuario && (
                <button type="button" onClick={() => setUsuario("")} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
                  <X size={12} /> Ver todos
                </button>
              )}
            </div>
          </div>

          {ingresos.length > 0 && (
            <section className="border-b border-slate-100">
              <h4 className="px-5 pt-3 pb-2 text-xs font-semibold text-slate-900 uppercase tracking-wide">Ingresaron a Resoluciones ({ingresos.length})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead>
                    <tr className="text-left border-y border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                      {COLUMNAS_INGRESO.map(([t]) => <th key={t} className="py-2 px-3 first:pl-5">{t}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ingresos.map(e => (
                      <tr key={e.id} className="align-top">
                        <td className="py-2 px-3 pl-5 text-[11px] text-slate-500 tabular-nums">{hora(e.hora)}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          <button type="button" onClick={() => abrir(e.id)} title="Abrir el expediente"
                            className="font-mono font-semibold text-slate-900 underline decoration-slate-300 hover:decoration-slate-900">{e.exp}</button>
                        </td>
                        <td className="py-2 px-3 text-slate-800 max-w-[280px]">{e.objeto}</td>
                        <td className="py-2 px-3 text-slate-600">{e.fuero || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{e.organismo || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{e.tipoContratacion || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{e.numero || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{e.tipoResolucion || "-"}</td>
                        <td className="py-2 px-3 text-slate-600">{e.agente || "-"}</td>
                        <td className="py-2 px-3 max-w-[260px]">
                          {e.tipo === "reingreso"
                            ? <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 text-xs whitespace-pre-line">{e.detalle}</span>
                            : <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium">Ingresó</span>}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-slate-500 whitespace-nowrap">{e.usuario || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {grupos.length > 0 && <h4 className="px-5 pt-3 pb-1 text-xs font-semibold text-slate-900 uppercase tracking-wide">Movimientos</h4>}
          <ul className="divide-y divide-slate-100">
            {grupos.map(({ e, movimientos: ms }) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <button type="button" onClick={() => abrir(e.id)} title="Abrir el expediente"
                    className="font-mono text-sm font-semibold text-slate-900 underline decoration-slate-300 hover:decoration-slate-900">{e.exp}</button>
                  {e.alta && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium">Cargado ese día</span>}
                  <span className="text-sm text-slate-600">{e.objeto}</span>
                  {e.agente && <span className="ml-auto text-[11px] text-slate-500">Agente: {e.agente}</span>}
                </div>
                <ol className="mt-2 space-y-1.5">
                  {ms.map(m => (
                    <li key={m.id} className="flex flex-wrap items-start gap-x-2 gap-y-0.5 text-sm">
                      <span className="w-12 shrink-0 text-[11px] text-slate-500 tabular-nums pt-0.5">{hora(m.creadoEn)}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">{m.campo}</span>
                      {esTexto(m) ? (
                        <p className="flex-1 min-w-[200px] text-slate-800 whitespace-pre-line">{m.sector}</p>
                      ) : (
                        <p className="flex-1 min-w-[200px] flex flex-wrap items-center gap-1.5">
                          {m.sectorAnterior && (<><span className="text-slate-500 line-through">{m.sectorAnterior}</span><ArrowRight size={13} className="text-slate-400" /></>)}
                          <span className="font-medium text-slate-900">{m.sector}</span>
                        </p>
                      )}
                      <span className="shrink-0 text-[11px] text-slate-500 pt-0.5">{m.usuario}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
