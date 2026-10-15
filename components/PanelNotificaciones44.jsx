"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Download, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import { ALERTA_ESTILO } from "@/lib/constants";
import { alertaDias } from "@/lib/diasEnSector";
import { fmtFecha } from "@/lib/utils";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { EMAIL_JEFA_SUBDIRECCION, fechaISO } from "@/lib/resoluciones";
import {
  AGENTES_ORDENES_COMPRA, CAMPOS_NOTIFICACION_44, compararNotificaciones44, diasSinNotificar44, estaNotificada44,
} from "@/lib/ordenesCompra";
import BotonAccion from "./BotonAccion";
import Paginacion, { OPCIONES_POR_PAGINA } from "./Paginacion";
import EstrellaPrioridad from "./EstrellaPrioridad";
import { Campo_Input } from "./CamposFormulario";
import CampoOpciones from "./CampoOpciones";
import { FiltroColumna, Seccion, DatoFicha } from "./PanelResoluciones";

const API = "/api/ordenes-compra/notificaciones";
const norm = s => String(s || "").trim().toLowerCase();
const fecha = f => (f ? fmtFecha(fechaISO(f)) : "-");
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";
// Columnas largas: más ancho y texto en dos líneas.
const ANCHOS = {
  exp: "min-w-[140px]", fechaIngreso: "min-w-[130px] whitespace-nowrap", tipoContratacion: "min-w-[150px] max-w-[190px]", objeto: "min-w-[200px] max-w-[260px]",
  organismo: "min-w-[180px] max-w-[240px]", estadoActual: "min-w-[130px] max-w-[180px]", estado: "min-w-[170px] max-w-[230px]",
  pase: "min-w-[150px] max-w-[200px]",
};

function filtroVacio() {
  return { exp: "", texto: "", agente: "" };
}

function aFormulario(n) {
  const f = { observaciones: "", prioritario: false };
  for (const [k] of CAMPOS_NOTIFICACION_44) f[k] = n?.[k] ?? "";
  if (!n) f.fechaIngreso = hoyLocalISO();
  else { f.fechaIngreso = fechaISO(n.fechaIngreso); f.observaciones = n.observaciones || ""; f.prioritario = !!n.prioritario; }
  return f;
}

// Alta / edición, con los campos en el orden de la hoja. La jefa ve la
// ficha fija: solo cambia agente y prioridad.
function FormularioNotificacion({ inicial, esJefa, onCerrar, onGuardar, onEliminar }) {
  const [f, setF] = useState(() => aFormulario(inicial));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const fijo = esJefa && !!inicial;
  const set = (k, v) => { setF(prev => ({ ...prev, [k]: v })); setError(""); };

  async function guardar() {
    if (!f.exp.trim()) { setError("Completá el N° de expediente."); return; }
    setGuardando(true);
    const res = await onGuardar(f);
    setGuardando(false);
    if (res?.error) setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">
              {inicial ? <>Notificación art. 44 · <span className="font-mono">{inicial.exp}</span></> : "Nueva notificación art. 44"}
            </h2>
            {inicial && <p className="text-xs text-slate-500 truncate">{[inicial.objeto, inicial.organismo, inicial.estado].filter(Boolean).join(" · ")}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {inicial && <button onClick={() => setConfirmarEliminar(true)} title="Eliminar" className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={16} /></button>}
            <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {confirmarEliminar && (
            <div className="border border-red-200 bg-red-50 rounded-md p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-800">Este expediente se borrará definitivamente de las notificaciones.</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setConfirmarEliminar(false)} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium">Cancelar</button>
                <BotonAccion onClick={async () => { setGuardando(true); await onEliminar(); setGuardando(false); }} cargando={guardando} cargandoTexto="Eliminando..."
                  className="px-3 py-1.5 rounded-md bg-red-700 text-white text-xs font-medium hover:bg-red-800">Eliminar definitivamente</BotonAccion>
              </div>
            </div>
          )}
          <label className={"inline-flex items-center gap-2 text-sm " + (esJefa ? "text-slate-700" : "text-slate-400")}>
            <input type="checkbox" checked={!!f.prioritario} disabled={!esJefa} onChange={e => set("prioritario", e.target.checked)} className="rounded border-slate-300" />
            Prioritario (estrella){!esJefa && " · lo marca la jefa de la Subdirección"}
          </label>
          <Seccion titulo={"Datos" + (fijo ? " · los carga Órdenes de Compra" : "")}>
            {CAMPOS_NOTIFICACION_44.map(([k, etiqueta]) => {
              const ancho = ["objeto", "organismo", "estado"].includes(k) ? "col-span-2" : "";
              if (k === "agente") {
                return esJefa
                  ? <CampoOpciones key={k} label="Agente (asignación)" value={f.agente} onChange={v => set("agente", v)} opciones={AGENTES_ORDENES_COMPRA} />
                  : <Campo_Input key={k} label="Agente (lo asigna la jefa)" value={f.agente} onChange={() => {}} disabled />;
              }
              if (fijo) return <div key={k} className={ancho}><DatoFicha label={etiqueta} valor={k === "fechaIngreso" ? fecha(f[k]) : f[k] || "-"} mono={k === "exp"} /></div>;
              return (
                <div key={k} className={ancho}>
                  <Campo_Input label={etiqueta + (k === "exp" ? " *" : "")} value={f[k]} onChange={v => set(k, v)} type={k === "fechaIngreso" ? "date" : "text"} />
                </div>
              );
            })}
            <div className="col-span-2 md:col-span-4">
              {fijo ? <DatoFicha label="Observaciones" valor={f.observaciones || "-"} /> : (
                <>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
                  <textarea value={f.observaciones} onChange={e => set("observaciones", e.target.value)} rows={2}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y" />
                </>
              )}
            </div>
          </Seccion>
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-xs text-red-600">{error}</p>}
          <button onClick={onCerrar} disabled={guardando} className="px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50">Cancelar</button>
          <BotonAccion onClick={guardar} cargando={guardando} className="px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
            {inicial ? "Guardar cambios" : "Cargar"}
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}

const SOLAPAS = [
  { id: "todas", etiqueta: "Todas", incluye: () => true },
  { id: "pendientes", etiqueta: "Sin notificar", incluye: n => !estaNotificada44(n) },
  { id: "notificadas", etiqueta: "Notificadas", incluye: estaNotificada44 },
  { id: "sinAsignar", etiqueta: "Sin asignar", incluye: n => !String(n.agente || "").trim(), soloJefa: true },
];

function exportarExcel(filas) {
  const datos = [
    [...CAMPOS_NOTIFICACION_44.map(([, e]) => e.toUpperCase()), "OBSERVACIONES"],
    ...filas.map(n => [...CAMPOS_NOTIFICACION_44.map(([k]) => (k === "fechaIngreso" ? (n[k] ? fecha(n[k]) : "") : n[k] || "")), n.observaciones || ""]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(datos), "Notificaciones art 44");
  XLSX.writeFile(wb, "notificaciones-art44-" + hoyLocalISO() + ".xlsx");
}

// Expedientes que no llevan orden de compra: solo la notificación del
// art. 44 (hoja "NOT. AÑO 2026" de la planilla).
export default function PanelNotificaciones44({ sesion, mostrarToast }) {
  const esJefa = sesion.email === EMAIL_JEFA_SUBDIRECCION;
  const [lista, setLista] = useState(null);
  const [f, setF] = useState(filtroVacio);
  const [solapa, setSolapa] = useState("todas");
  const [form, setForm] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(OPCIONES_POR_PAGINA[0]);
  const set = (k, v) => { setF(prev => ({ ...prev, [k]: v })); setPagina(0); };
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch(API);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (activo) setLista(data.expedientes || []);
      } catch (err) {
        if (activo) { setLista([]); mostrarToast(err.message); }
      }
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todos = lista || [];
  const agentes = useMemo(() => [...new Set([...AGENTES_ORDENES_COMPRA, ...todos.map(n => n.agente).filter(Boolean)])].sort(), [todos]);
  const deLaSolapa = useMemo(() => todos.filter(SOLAPAS.find(s => s.id === solapa).incluye), [todos, solapa]);
  const filas = useMemo(() => deLaSolapa.filter(n => {
    if (f.exp && !norm(n.exp).includes(norm(f.exp))) return false;
    if (f.texto && !norm([n.objeto, n.organismo, n.estado, n.tipoContratacion, n.pase].join(" ")).includes(norm(f.texto))) return false;
    if (f.agente && n.agente !== f.agente) return false;
    return true;
  }).sort(compararNotificaciones44), [deLaSolapa, f]);
  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const filasPagina = filas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);
  const seleccionada = form && form !== "nuevo" ? todos.find(n => n.id === form) : null;

  async function enviar(url, method, body) {
    let res;
    try {
      res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    } catch {
      return { error: "Sin conexión: no se guardó el cambio" };
    }
    const data = await res.json().catch(() => ({}));
    return res.ok ? data : { error: data.error || "No se pudo guardar" };
  }

  async function guardar(datos) {
    const data = seleccionada ? await enviar(API + "/" + seleccionada.id, "PUT", datos) : await enviar(API, "POST", datos);
    if (data.error) return data;
    setLista(prev => (seleccionada ? prev.map(n => (n.id === data.expediente.id ? data.expediente : n)) : [...prev, data.expediente]));
    setForm(null);
    mostrarToast(seleccionada ? "Notificación actualizada" : "Notificación cargada");
  }

  async function cambiarRapido(n, cambios) {
    const anteriores = Object.fromEntries(Object.keys(cambios).map(k => [k, n[k]]));
    setLista(prev => prev.map(x => (x.id === n.id ? { ...x, ...cambios } : x)));
    const data = await enviar(API + "/" + n.id, "PATCH", cambios);
    if (data.error) {
      setLista(prev => prev.map(x => (x.id === n.id ? { ...x, ...anteriores } : x)));
      mostrarToast(data.error);
      return;
    }
    setLista(prev => prev.map(x => (x.id === data.expediente.id ? data.expediente : x)));
    mostrarToast("prioritario" in cambios
      ? n.exp + (cambios.prioritario ? " marcado como prioritario" : " ya no es prioritario")
      : n.exp + " asignado a " + (cambios.agente || "nadie"));
  }

  async function eliminar() {
    const data = await enviar(API + "/" + seleccionada.id, "DELETE");
    if (data.error) { mostrarToast(data.error); return; }
    setLista(prev => prev.filter(n => n.id !== seleccionada.id));
    setForm(null);
    mostrarToast("Notificación eliminada");
  }

  if (lista === null) return <div className="py-16 text-center text-sm text-slate-500">Cargando notificaciones...</div>;

  const filtros = {
    exp: <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} />,
    agente: <FiltroColumna valor={f.agente} etiqueta="Todos" opciones={agentes} onChange={v => set("agente", v)} />,
    objeto: <input value={f.texto} onChange={e => set("texto", e.target.value)} placeholder="Objeto, organismo, estado" className={CLASE_INPUT} />,
  };
  const celda = (n, k) => {
    if (k === "exp") {
      return (
        <div className="flex items-center gap-1.5">
          {esJefa && <EstrellaPrioridad prioritario={n.prioritario} onClick={() => cambiarRapido(n, { prioritario: !n.prioritario })} />}
          <span className="font-mono font-semibold text-slate-900">{n.exp}</span>
        </div>
      );
    }
    if (k === "agente" && esJefa) {
      return (
        <select value={n.agente || ""} onChange={ev => cambiarRapido(n, { agente: ev.target.value })} title="Cambiar asignación"
          className="text-xs bg-white border border-slate-300 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-800">
          <option value="">Sin asignar</option>
          {agentes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      );
    }
    if (k === "fechaIngreso") {
      const d = diasSinNotificar44(n);
      return (
        <>
          {fecha(n.fechaIngreso)}
          {d != null && <span className={"block w-fit mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border " + ALERTA_ESTILO[alertaDias(d)]}>{d} d sin notificar</span>}
        </>
      );
    }
    return <span className="line-clamp-2" title={n[k] || ""}>{n[k] || "-"}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {SOLAPAS.filter(s => !s.soloJefa || esJefa).map(s => (
          <button key={s.id} type="button" onClick={() => { setSolapa(s.id); setPagina(0); }}
            className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap " +
              (solapa === s.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {s.etiqueta}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">{todos.filter(s.incluye).length}</span>
          </button>
        ))}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Notificaciones art. 44 · {SOLAPAS.find(s => s.id === solapa).etiqueta}</h3>
            <span className="text-[11px] text-slate-500">{filas.length} de {deLaSolapa.length} expediente{deLaSolapa.length !== 1 ? "s" : ""} sin orden de compra</span>
          </div>
          <div className="flex items-center gap-3">
            {hayFiltros && (
              <button type="button" onClick={() => { setF(filtroVacio()); setPagina(0); }} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
                <X size={12} /> Limpiar filtros
              </button>
            )}
            <button type="button" onClick={() => exportarExcel(filas)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">
              <Download size={14} /> Exportar a Excel
            </button>
            <button type="button" onClick={() => setForm("nuevo")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              <Plus size={14} /> Cargar notificación
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-100 bg-slate-50 text-[11px] font-medium text-slate-500 uppercase tracking-wide align-bottom">
                {CAMPOS_NOTIFICACION_44.map(([k, e]) => (
                  <th key={k} className={"pt-2 px-3 " + (ANCHOS[k] || "min-w-[90px]") + (k === "exp" ? " sticky left-0 z-10 bg-slate-50 border-r border-slate-100" : "")}>{e}</th>
                ))}
              </tr>
              <tr className="text-left border-b border-slate-100 bg-slate-50">
                {CAMPOS_NOTIFICACION_44.map(([k]) => (
                  <th key={k} className={"py-2 px-3 align-top" + (k === "exp" ? " sticky left-0 z-10 bg-slate-50 border-r border-slate-100" : "")}>{filtros[k] || null}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 ? (
                <tr><td colSpan={CAMPOS_NOTIFICACION_44.length} className="py-10 text-center text-sm text-slate-500">No hay expedientes con esos filtros.</td></tr>
              ) : filasPagina.map(n => (
                <tr key={n.id} onClick={() => setForm(n.id)} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer align-top text-xs text-slate-700">
                  {CAMPOS_NOTIFICACION_44.map(([k]) => (
                    <td key={k} onClick={k === "agente" && esJefa ? ev => ev.stopPropagation() : undefined}
                      className={"py-2.5 px-3 " + (ANCHOS[k] || "min-w-[90px]") + (k === "exp" ? " sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100" : "")}>
                      {celda(n, k)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion total={filas.length} pagina={paginaActual} porPagina={porPagina}
          onPagina={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(0); }} />
      </div>

      {form && (
        <FormularioNotificacion key={form} inicial={seleccionada} esJefa={esJefa}
          onCerrar={() => setForm(null)} onGuardar={guardar} onEliminar={eliminar} />
      )}
    </div>
  );
}
