"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { fmtFecha } from "@/lib/utils";
import { EVENTO_ABRIR_RESOLUCION, fechaISO } from "@/lib/resoluciones";

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

const fechaCorta = f => (f ? fmtFecha(fechaISO(f)) : "-");
const cuandoIngreso = e => (e.tipo === "reingreso" ? e.detalle : "Ingresó");

// Columnas de las tablas de expedientes (las que ingresaron y las que se
// cargaron): título y valor como texto (para el Excel).
const COLUMNAS_EXP = [
  ["Hora", e => hora(e.hora)], ["Exp.", e => e.exp], ["Objeto", e => e.objeto], ["Ingreso al sector", e => fechaCorta(e.fechaIngreso)],
  ["Fuero", e => e.fuero], ["Organismo", e => e.organismo], ["Tipo de contratación", e => e.tipoContratacion], ["Número", e => e.numero],
  ["Tipo de resolución", e => e.tipoResolucion], ["Agente", e => e.agente],
];
const COLUMNAS_INGRESO = [...COLUMNAS_EXP, ["Cómo", cuandoIngreso], ["Usuario", e => e.usuario]];
const COLUMNAS_CARGADO = [...COLUMNAS_EXP, ["Cargó", e => e.usuario]];

function hojaExpedientes(wb, nombre, columnas, filas) {
  if (!filas.length) return;
  const ws = XLSX.utils.aoa_to_sheet([columnas.map(([t]) => t.toUpperCase()), ...filas.map(e => columnas.map(([, v]) => v(e) || ""))]);
  ws["!cols"] = columnas.map(([t]) => ({ wch: t === "Objeto" || t === "Cómo" ? 40 : t === "Exp." ? 16 : 18 }));
  XLSX.utils.book_append_sheet(wb, ws, nombre);
}

function exportarExcel({ ingresos, cargados, movimientos }, dia) {
  const wb = XLSX.utils.book_new();
  hojaExpedientes(wb, "Ingresaron", COLUMNAS_INGRESO, ingresos);
  hojaExpedientes(wb, "Cargados", COLUMNAS_CARGADO, cargados);
  if (movimientos.length) {
    const ws = XLSX.utils.aoa_to_sheet([
      ["HORA", "EXP.", "OBJETO", "AGENTE", "CAMPO", "ANTES", "AHORA", "USUARIO"],
      ...movimientos.map(m => [hora(m.creadoEn), m.expediente.exp, m.expediente.objeto, m.expediente.agente || "", m.campo, m.sectorAnterior || "", m.sector, m.usuario]),
    ]);
    ws["!cols"] = [8, 16, 40, 10, 18, 30, 50, 20].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
  }
  XLSX.writeFile(wb, "resoluciones-informe-" + dia + ".xlsx");
}

// Tabla de expedientes del día (los que ingresaron o los que se cargaron).
// `columnas`: COLUMNAS_INGRESO | COLUMNAS_CARGADO. Vacía, lo avisa.
function TablaExpedientes({ titulo, columnas, filas, vacia, abrir }) {
  if (!filas.length) return <p className="px-5 py-8 text-center text-sm text-slate-500 border-b border-slate-100">{vacia}</p>;
  return (
    <section className="border-b border-slate-100">
      <h4 className="px-5 pt-3 pb-2 text-xs font-semibold text-slate-900 uppercase tracking-wide">{titulo} ({filas.length})</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="text-left border-y border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              {columnas.map(([t]) => <th key={t} className="py-2 px-3 first:pl-5">{t}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filas.map(e => (
              <tr key={e.id} className="align-top">
                {columnas.map(([t, v]) => (
                  <td key={t} className={"py-2 px-3 first:pl-5 " + (t === "Objeto" ? "text-slate-800 max-w-[280px]" : t === "Cómo" ? "max-w-[260px]" : "text-slate-600 " + (t === "Hora" || t === "Usuario" || t === "Cargó" ? "text-[11px] whitespace-nowrap tabular-nums" : ""))}>
                    {t === "Exp." ? (
                      <button type="button" onClick={() => abrir(e.id)} title="Abrir el expediente"
                        className="font-mono font-semibold text-slate-900 underline decoration-slate-300 hover:decoration-slate-900 whitespace-nowrap">{e.exp}</button>
                    ) : t === "Cómo" ? (
                      e.tipo === "reingreso"
                        ? <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 text-xs whitespace-pre-line">{e.detalle}</span>
                        : <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[11px] font-medium">Ingresó</span>
                    ) : v(e) || "-"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// Informe del día de Resoluciones: los expedientes que ingresaron (por
// fecha de ingreso al sector o reingreso), los que se cargaron en el
// sistema y todo lo que quedó en el historial en una fecha, agrupado por
// expediente, con quién lo hizo.
export default function InformeDia() {
  const hoy = hoyLocalISO();
  const [dia, setDia] = useState(hoy);
  const [datos, setDatos] = useState(null); // { fecha, movimientos } | { error }
  const [usuario, setUsuario] = useState("");
  const [ver, setVer] = useState("todo"); // "todo" | "ingresos" | "cargados" | "movimientos"

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
  const cargados = (datos?.cargados || []).filter(e => !usuario || e.usuario === usuario);
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
  const verIngresos = ver === "todo" || ver === "ingresos", verCargados = ver === "todo" || ver === "cargados";
  const verMovimientos = ver === "todo" || ver === "movimientos";
  const visible = { ingresos: verIngresos ? ingresos : [], cargados: verCargados ? cargados : [], movimientos: verMovimientos ? movimientos : [] };

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
          <button type="button" onClick={() => exportarExcel(visible, dia)}
            disabled={!visible.ingresos.length && !visible.cargados.length && !visible.movimientos.length}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 disabled:opacity-40">
            <Download size={14} /> Exportar a Excel
          </button>
        </div>
      </div>

      {datos === null ? (
        <div className="py-16 text-center text-sm text-slate-500">Cargando el informe...</div>
      ) : datos.error ? (
        <div className="py-16 text-center text-sm text-red-700">{datos.error}</div>
      ) : todos.length === 0 && !datos.ingresos?.length && !datos.cargados?.length ? (
        <div className="py-16 text-center text-sm text-slate-500">Ese día no hubo movimientos en Resoluciones.</div>
      ) : (
        <>
          <div className="px-5 py-3 border-b border-slate-100 space-y-2">
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
              {[["todo", "Todo"], ["ingresos", "Ingresaron (" + ingresos.length + ")"], ["cargados", "Cargados ese día (" + cargados.length + ")"], ["movimientos", "Movimientos (" + movimientos.length + ")"]].map(([v, etiqueta]) => (
                <button key={v} type="button" onClick={() => setVer(v)}
                  className={"px-3 py-1 rounded-md text-xs font-medium transition-colors " + (ver === v ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>
                  {etiqueta}
                </button>
              ))}
            </div>
            <p className="text-sm text-slate-700">
              <b>{movimientos.length}</b> movimiento{movimientos.length !== 1 ? "s" : ""} en <b>{grupos.length}</b> expediente{grupos.length !== 1 ? "s" : ""}
              {altas > 0 && <> · <b>{altas}</b> ingresado{altas !== 1 ? "s" : ""}</>}
              {reingresos > 0 && <> · <b>{reingresos}</b> reingreso{reingresos !== 1 ? "s" : ""}</>}
              {cargados.length > 0 && <> · <b>{cargados.length}</b> cargado{cargados.length !== 1 ? "s" : ""} en el sistema</>}
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

          {verIngresos && (
            <TablaExpedientes titulo="Ingresaron a Resoluciones" columnas={COLUMNAS_INGRESO} filas={ingresos} abrir={abrir}
              vacia={"Ese día no ingresaron expedientes" + (usuario ? " de " + usuario : "") + "."} />
          )}
          {verCargados && (
            <TablaExpedientes titulo="Cargados en el sistema ese día" columnas={COLUMNAS_CARGADO} filas={cargados} abrir={abrir}
              vacia={"Ese día no se cargaron expedientes" + (usuario ? " de " + usuario : "") + "."} />
          )}

          {verMovimientos && grupos.length > 0 && <h4 className="px-5 pt-3 pb-1 text-xs font-semibold text-slate-900 uppercase tracking-wide">Movimientos</h4>}
          {verMovimientos && (grupos.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">Ese día no hubo movimientos{usuario ? " de " + usuario : ""}.</p>
          ) : (
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
          ))}
        </>
      )}
    </div>
  );
}
