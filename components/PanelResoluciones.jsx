"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Download, Trash2, ArrowRight, Star } from "lucide-react";
import * as XLSX from "xlsx";
import { ALERTA_ESTILO, HOY } from "@/lib/constants";
import { alertaFrenado, fmtFecha } from "@/lib/utils";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import {
  FUEROS_RESOLUCIONES, TIPOS_CONTRATACION_RESOLUCIONES, TIPOS_RESOLUCION, SECTORES_RESOLUCIONES,
  SITUACIONES_RESOLUCIONES, ESTADOS_RESOLUCION, AGENTES_RESOLUCIONES, EMAIL_JEFA_SUBDIRECCION, compararResoluciones, fechaISO,
} from "@/lib/resoluciones";
import FiltroDesplegable from "./FiltroDesplegable";
import BotonAccion from "./BotonAccion";
import { Campo_Input } from "./CamposFormulario";
import { CampoSugerido } from "./FormularioMesa";

const norm = s => String(s || "").trim().toLowerCase();
const fecha = f => (f ? fmtFecha(fechaISO(f)) : "-");
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";

// Días desde el último movimiento (la columna "Días en sector").
function diasEnSector(e) {
  const f = fechaISO(e.fechaUltimoMov);
  if (!f) return null;
  return Math.round((HOY - new Date(f + "T00:00:00")) / 86400000);
}

function FiltroColumna({ valor, etiqueta, opciones, onChange }) {
  return (
    <FiltroDesplegable
      valor={valor}
      onChange={onChange}
      opciones={[{ valor: "", etiqueta }, ...opciones.map(o => ({ valor: o, etiqueta: o }))]}
      clase={"bg-white border-slate-300 " + (valor === "" ? "text-slate-400" : "text-slate-900")}
      anchoCompleto
      flotante
    />
  );
}

function filtroVacio() {
  return {
    exp: "", objeto: "", organismo: "", fuero: "", tipoContratacion: "", tipoResolucion: "",
    estado: "", sectorActual: "", agente: "", situacion: "TRAMITANDO",
  };
}

const VACIO = {
  exp: "", fechaIngreso: "", objeto: "", fuero: "", organismo: "", tipoContratacion: "", numero: "",
  tipoResolucion: "", estado: "", sectorActual: "", fechaUltimoMov: "", agente: "", vencOfertas: "",
  inicioServicio: "", montos: "", observaciones: "", situacion: "TRAMITANDO", prioritario: false,
};

function aFormulario(e) {
  if (!e) return { ...VACIO, fechaIngreso: hoyLocalISO() };
  const f = {};
  for (const k of Object.keys(VACIO)) f[k] = e[k] ?? "";
  for (const k of ["fechaIngreso", "fechaUltimoMov", "vencOfertas"]) f[k] = fechaISO(e[k]);
  return f;
}

// Alta / edición de un expediente, con su historial de movimientos.
function FormularioResolucion({ inicial, esJefa, onCerrar, onGuardar, onEliminar }) {
  const [f, setF] = useState(() => aFormulario(inicial));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  function set(campo, valor) {
    setF(prev => {
      const nuevo = { ...prev, [campo]: valor };
      // Un pase de sector: la fecha del movimiento pasa a ser hoy (editable).
      if (campo === "sectorActual" && valor !== (inicial?.sectorActual || "")) nuevo.fechaUltimoMov = hoyLocalISO();
      return nuevo;
    });
    setError("");
  }

  async function guardar() {
    if (!f.exp.trim() || !f.objeto.trim()) { setError("Completá N° de expediente y objeto."); return; }
    setGuardando(true);
    const res = await onGuardar(f);
    setGuardando(false);
    if (res?.error) setError(res.error);
  }

  async function eliminar() {
    setGuardando(true);
    await onEliminar();
    setGuardando(false);
  }

  const historial = [...(inicial?.movimientos || [])].reverse();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-900">{inicial ? "Expediente " + inicial.exp : "Nuevo expediente"}</h2>
          <div className="flex items-center gap-1">
            {inicial && (
              <button onClick={() => setConfirmarEliminar(true)} title="Eliminar" className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={16} /></button>
            )}
            <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {confirmarEliminar && (
            <div className="border border-red-200 bg-red-50 rounded-md p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-800">Este expediente y su historial se borrarán definitivamente.</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setConfirmarEliminar(false)} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium">Cancelar</button>
                <BotonAccion onClick={eliminar} cargando={guardando} cargandoTexto="Eliminando..."
                  className="px-3 py-1.5 rounded-md bg-red-700 text-white text-xs font-medium hover:bg-red-800">
                  Eliminar definitivamente
                </BotonAccion>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Campo_Input label="Exp. *" value={f.exp} onChange={v => set("exp", v)} placeholder="13-05999/25" />
            <Campo_Input label="Fecha ingreso al sector" type="date" value={f.fechaIngreso} onChange={v => set("fechaIngreso", v)} />
            {esJefa ? (
              <CampoSugerido label="Agente (asignación)" id="res-agente" value={f.agente} onChange={v => set("agente", v)} opciones={AGENTES_RESOLUCIONES} />
            ) : (
              <Campo_Input label="Agente (lo asigna la jefa)" value={f.agente} onChange={() => {}} disabled />
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Situación</label>
              <select value={f.situacion} onChange={e => set("situacion", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
                {SITUACIONES_RESOLUCIONES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-4">
              <Campo_Input label="Objeto *" value={f.objeto} onChange={v => set("objeto", v)} />
            </div>
            <div className="col-span-2"><CampoSugerido label="Fuero" id="res-fuero" value={f.fuero} onChange={v => set("fuero", v)} opciones={FUEROS_RESOLUCIONES} /></div>
            <div className="col-span-2"><Campo_Input label="Organismo" value={f.organismo} onChange={v => set("organismo", v)} /></div>
            <CampoSugerido label="Tipo de contratación" id="res-tipo-contratacion" value={f.tipoContratacion} onChange={v => set("tipoContratacion", v)} opciones={TIPOS_CONTRATACION_RESOLUCIONES} />
            <Campo_Input label="Número" value={f.numero} onChange={v => set("numero", v)} placeholder="139/26" />
            <CampoSugerido label="Tipo de resolución" id="res-tipo-resolucion" value={f.tipoResolucion} onChange={v => set("tipoResolucion", v)} opciones={TIPOS_RESOLUCION} />
            <CampoSugerido label="Estado" id="res-estado" value={f.estado} onChange={v => set("estado", v)} opciones={ESTADOS_RESOLUCION} />
            <CampoSugerido label="Sector actual" id="res-sector" value={f.sectorActual} onChange={v => set("sectorActual", v)} opciones={SECTORES_RESOLUCIONES} />
            <Campo_Input label="Último movimiento" type="date" value={f.fechaUltimoMov} onChange={v => set("fechaUltimoMov", v)} />
            <Campo_Input label="Venc. ofertas" type="date" value={f.vencOfertas} onChange={v => set("vencOfertas", v)} />
            <Campo_Input label="Inicio de servicio" value={f.inicioServicio} onChange={v => set("inicioServicio", v)} placeholder="1/12/2026 o A PARTIR DE LA OC" />
            <div className="col-span-2 md:col-span-4"><Campo_Input label="Montos" value={f.montos} onChange={v => set("montos", v)} placeholder="$ 61.096.888,00" /></div>
            <div className="col-span-2 md:col-span-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado / observaciones</label>
              <textarea value={f.observaciones} onChange={e => set("observaciones", e.target.value)} rows={3}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y" />
            </div>
          </div>

          <label className={"flex items-center gap-2 text-sm " + (esJefa ? "text-slate-700" : "text-slate-400")}>
            <input type="checkbox" checked={!!f.prioritario} disabled={!esJefa} onChange={e => set("prioritario", e.target.checked)} className="rounded border-slate-300" />
            Prioritario{!esJefa && " (lo marca la jefa de la Subdirección)"}
          </label>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onCerrar} disabled={guardando} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50">Cancelar</button>
            <BotonAccion onClick={guardar} cargando={guardando}
              className="px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
              {inicial ? "Guardar cambios" : "Cargar expediente"}
            </BotonAccion>
          </div>

          {inicial && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movimientos ({historial.length})</h3>
              {historial.length === 0 ? (
                <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
              ) : (
                <ul className="space-y-1.5">
                  {historial.map(m => (
                    <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm border border-slate-200 rounded-md px-3 py-2">
                      <span className="text-slate-500 w-20 shrink-0">{fecha(m.fecha)}</span>
                      {m.sectorAnterior && (<><span className="text-slate-600">{m.sectorAnterior}</span><ArrowRight size={13} className="text-slate-400" /></>)}
                      <span className="font-medium text-slate-900">{m.sector}</span>
                      <span className="ml-auto text-[11px] text-slate-400">{m.usuario}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function exportarExcel(filas) {
  const datos = [
    ["EXP.", "FECHA INGRESO AL SECTOR", "OBJETO", "FUERO", "ORGANISMO", "TIPO DE CONTRATACION", "NUMERO", "DIAS EN SECTOR",
      "TIPO DE RESOLUCION", "ESTADO", "ULTIMO MOV", "SECTOR ACTUAL", "AGENTE", "VENC. OFERTAS", "INICIO DE SERV", "MONTOS",
      "ESTADO/OBSERVACIONES", "SITUACION", "PRIORITARIO"],
    ...filas.map(e => [
      e.exp, fecha(e.fechaIngreso), e.objeto, e.fuero || "", e.organismo || "", e.tipoContratacion || "", e.numero || "",
      diasEnSector(e) ?? "", e.tipoResolucion || "", e.estado || "", fecha(e.fechaUltimoMov), e.sectorActual || "", e.agente || "",
      fecha(e.vencOfertas), e.inicioServicio || "", e.montos || "", e.observaciones || "", e.situacion, e.prioritario ? "SI" : "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws["!cols"] = [14, 12, 40, 30, 30, 14, 10, 8, 18, 18, 12, 16, 8, 12, 16, 18, 50, 14, 12].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resoluciones");
  XLSX.writeFile(wb, "resoluciones-" + hoyLocalISO() + ".xlsx");
}

// Sistema del sector de Resoluciones: la planilla de seguimiento de
// expedientes, sin conexión con el resto de la app.
export default function PanelResoluciones({ sesion, mostrarToast }) {
  // La jefa de la Subdirección asigna agentes y marca prioridades.
  const esJefa = sesion.email === EMAIL_JEFA_SUBDIRECCION;
  const [expedientes, setExpedientes] = useState(null);
  const [f, setF] = useState(filtroVacio);
  const [form, setForm] = useState(null); // null | "nuevo" | id del expediente
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/resoluciones");
        // Si el servidor falla sin respuesta, el cuerpo viene vacío.
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (activo) setExpedientes(data.expedientes || []);
      } catch (err) {
        if (activo) { setExpedientes([]); mostrarToast(err.message || "No se pudieron cargar los expedientes"); }
      }
    })();
    return () => { activo = false; };
    // Solo al montar: mostrarToast del Dashboard cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = expedientes || [];
  // Opciones de cada filtro: la lista base más lo que ya está cargado.
  const opciones = useMemo(() => {
    const de = (campo, base) => [...new Set([...base, ...lista.map(e => e[campo]).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
    return {
      fuero: de("fuero", []),
      tipoContratacion: de("tipoContratacion", TIPOS_CONTRATACION_RESOLUCIONES),
      tipoResolucion: de("tipoResolucion", TIPOS_RESOLUCION),
      estado: de("estado", ESTADOS_RESOLUCION),
      sectorActual: de("sectorActual", []),
      agente: de("agente", AGENTES_RESOLUCIONES),
      situacion: de("situacion", SITUACIONES_RESOLUCIONES),
    };
  }, [lista]);

  const filas = useMemo(() => lista.filter(e => {
    if (f.exp && !norm(e.exp + " " + (e.numero || "")).includes(norm(f.exp))) return false;
    if (f.objeto && !norm(e.objeto + " " + (e.observaciones || "")).includes(norm(f.objeto))) return false;
    if (f.organismo && !norm(e.organismo).includes(norm(f.organismo))) return false;
    for (const campo of ["fuero", "tipoContratacion", "tipoResolucion", "estado", "sectorActual", "agente", "situacion"]) {
      if (f[campo] && e[campo] !== f[campo]) return false;
    }
    return true;
  }).sort(compararResoluciones), [lista, f]);

  const seleccionado = form && form !== "nuevo" ? lista.find(e => e.id === form) : null;

  async function enviar(url, method, body) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "No se pudo guardar" };
    return data;
  }

  async function guardar(datos) {
    const data = seleccionado
      ? await enviar("/api/resoluciones/" + seleccionado.id, "PUT", datos)
      : await enviar("/api/resoluciones", "POST", datos);
    if (data.error) return data;
    setExpedientes(prev => seleccionado ? prev.map(e => (e.id === data.expediente.id ? data.expediente : e)) : [...prev, data.expediente]);
    setForm(null);
    mostrarToast(seleccionado ? "Expediente actualizado" : "Expediente " + data.expediente.exp + " cargado");
  }

  // Cambio rápido de la jefa desde la tabla (asignación o prioridad).
  async function cambiarRapido(e, cambios) {
    const data = await enviar("/api/resoluciones/" + e.id, "PATCH", cambios);
    if (data.error) { mostrarToast(data.error); return; }
    setExpedientes(prev => prev.map(x => (x.id === data.expediente.id ? data.expediente : x)));
    mostrarToast("prioritario" in cambios
      ? (cambios.prioritario ? e.exp + " marcado como prioritario" : e.exp + " ya no es prioritario")
      : e.exp + " asignado a " + (cambios.agente || "nadie"));
  }

  async function eliminar() {
    const data = await enviar("/api/resoluciones/" + seleccionado.id, "DELETE");
    if (data.error) { mostrarToast(data.error); return; }
    setExpedientes(prev => prev.filter(e => e.id !== seleccionado.id));
    setForm(null);
    mostrarToast("Expediente eliminado");
  }

  if (expedientes === null) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando expedientes...</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Resoluciones</h3>
          <span className="text-[11px] text-slate-500">{filas.length} de {lista.length} expediente{lista.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          {hayFiltros && (
            <button type="button" onClick={() => setF(filtroVacio())} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
              <X size={12} /> Limpiar filtros
            </button>
          )}
          <button type="button" onClick={() => exportarExcel(filas)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">
            <Download size={14} /> Exportar a Excel
          </button>
          <button type="button" onClick={() => setForm("nuevo")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
            <Plus size={14} /> Cargar expediente
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[2100px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              {["Exp.", "Ingreso al sector", "Objeto", "Fuero", "Organismo", "Tipo de contratación", "Número", "Días en sector",
                "Tipo de resolución", "Estado", "Último mov.", "Sector actual", "Agente", "Venc. ofertas", "Inicio de serv.",
                "Montos", "Estado / observaciones", "Situación"].map(t => <th key={t} className="pt-2 px-3">{t}</th>)}
            </tr>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              <th className="py-2 px-3 align-top w-[130px]"><input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[240px]"><input value={f.objeto} onChange={e => set("objeto", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top w-[200px]"><FiltroColumna valor={f.fuero} etiqueta="Todos" opciones={opciones.fuero} onChange={v => set("fuero", v)} /></th>
              <th className="py-2 px-3 align-top w-[200px]"><input value={f.organismo} onChange={e => set("organismo", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top w-[130px]"><FiltroColumna valor={f.tipoContratacion} etiqueta="Todos" opciones={opciones.tipoContratacion} onChange={v => set("tipoContratacion", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[150px]"><FiltroColumna valor={f.tipoResolucion} etiqueta="Todos" opciones={opciones.tipoResolucion} onChange={v => set("tipoResolucion", v)} /></th>
              <th className="py-2 px-3 align-top w-[160px]"><FiltroColumna valor={f.estado} etiqueta="Todos" opciones={opciones.estado} onChange={v => set("estado", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[150px]"><FiltroColumna valor={f.sectorActual} etiqueta="Todos" opciones={opciones.sectorActual} onChange={v => set("sectorActual", v)} /></th>
              <th className="py-2 px-3 align-top w-[90px]"><FiltroColumna valor={f.agente} etiqueta="Todos" opciones={opciones.agente} onChange={v => set("agente", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[130px]"><FiltroColumna valor={f.situacion} etiqueta="Todas" opciones={opciones.situacion} onChange={v => set("situacion", v)} /></th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={18} className="py-10 text-center text-sm text-slate-500">No hay expedientes con esos filtros.</td></tr>
            ) : filas.map(e => {
              const dias = diasEnSector(e);
              return (
                <tr key={e.id} onClick={() => setForm(e.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer align-top text-xs text-slate-700">
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {esJefa && (
                        <button
                          type="button"
                          onClick={ev => { ev.stopPropagation(); cambiarRapido(e, { prioritario: !e.prioritario }); }}
                          title={e.prioritario ? "Quitar prioridad" : "Marcar como prioritario"}
                          className={"p-0.5 rounded hover:bg-amber-50 " + (e.prioritario ? "text-amber-500" : "text-slate-300 hover:text-amber-500")}
                        >
                          <Star size={14} fill={e.prioritario ? "currentColor" : "none"} />
                        </button>
                      )}
                      <span className="font-mono font-semibold text-slate-900">{e.exp}</span>
                    </div>
                    {e.prioritario && (
                      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">
                        Prioritario
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{fecha(e.fechaIngreso)}</td>
                  <td className="py-2.5 px-3"><span className="line-clamp-2" title={e.objeto}>{e.objeto}</span></td>
                  <td className="py-2.5 px-3">{e.fuero || "-"}</td>
                  <td className="py-2.5 px-3"><span className="line-clamp-2" title={e.organismo || ""}>{e.organismo || "-"}</span></td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{e.tipoContratacion || "-"}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{e.numero || "-"}</td>
                  <td className="py-2.5 px-3">
                    {dias != null ? (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap " + ALERTA_ESTILO[alertaFrenado(dias)]}>{dias} día{dias !== 1 ? "s" : ""}</span>
                    ) : "-"}
                  </td>
                  <td className="py-2.5 px-3">{e.tipoResolucion || "-"}</td>
                  <td className="py-2.5 px-3">{e.estado || "-"}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{fecha(e.fechaUltimoMov)}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-900">{e.sectorActual || "-"}</td>
                  <td className="py-2.5 px-3" onClick={esJefa ? ev => ev.stopPropagation() : undefined}>
                    {esJefa ? (
                      <select
                        value={e.agente || ""}
                        onChange={ev => cambiarRapido(e, { agente: ev.target.value })}
                        title="Cambiar asignación"
                        className="text-xs bg-white border border-slate-300 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                      >
                        <option value="">Sin asignar</option>
                        {[...new Set([...AGENTES_RESOLUCIONES, ...(e.agente ? [e.agente] : [])])].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    ) : (e.agente || "-")}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{fecha(e.vencOfertas)}</td>
                  <td className="py-2.5 px-3">{e.inicioServicio || "-"}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{e.montos || "-"}</td>
                  <td className="py-2.5 px-3 max-w-[320px]"><span className="line-clamp-3 whitespace-pre-line" title={e.observaciones || ""}>{e.observaciones || "-"}</span></td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{e.situacion}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <FormularioResolucion
          key={form}
          inicial={seleccionado}
          esJefa={esJefa}
          onCerrar={() => setForm(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
        />
      )}
    </div>
  );
}
