"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Download, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { fmtFecha } from "@/lib/utils";
import { fechaISO, FUEROS_RESOLUCIONES } from "@/lib/resoluciones";
import { ANIO_PLAN_OBRAS, DEPENDENCIAS_OBRA, ENCUADRES_OBRA, ESTADOS_OBRA } from "@/lib/planObras";
import FiltroDesplegable from "./FiltroDesplegable";
import BotonAccion from "./BotonAccion";
import { Campo_Input } from "./CamposFormulario";
import CampoOpciones from "./CampoOpciones";

const POR_PAGINA = 15;
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const fecha = f => (f ? fmtFecha(fechaISO(f)) : "-");
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";

const VACIO = {
  expediente: "", camara: "", destino: "", objeto: "", monto: "", encuadre: "", estado: "", fechaUltimoMov: "",
  dependenciaActual: "", ordenCompra: "", fechaNotificacionOC: "", plazoEjecucion: "", observaciones: "",
};

function aFormulario(o) {
  if (!o) return { ...VACIO };
  const f = {};
  for (const k of Object.keys(VACIO)) f[k] = o[k] ?? "";
  for (const k of ["fechaUltimoMov", "fechaNotificacionOC"]) f[k] = fechaISO(o[k]);
  return f;
}

function filtroVacio() {
  return { texto: "", camara: "", encuadre: "", estado: "", dependenciaActual: "" };
}

function FiltroColumna({ valor, opciones, onChange }) {
  return (
    <FiltroDesplegable
      valor={valor}
      onChange={onChange}
      opciones={[{ valor: "", etiqueta: "Todos" }, ...opciones.map(o => ({ valor: o, etiqueta: o }))]}
      clase={"bg-white border-slate-300 " + (valor === "" ? "text-slate-400" : "text-slate-900")}
      anchoCompleto
      flotante
    />
  );
}

function AreaTexto({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y" />
    </div>
  );
}

// Alta / edición de una obra del plan.
function FormularioObra({ inicial, camaras, onCerrar, onGuardar, onEliminar }) {
  const [f, setF] = useState(() => aFormulario(inicial));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  function set(campo, valor) {
    setF(prev => ({ ...prev, [campo]: valor }));
    setError("");
  }

  async function guardar() {
    if (!f.camara.trim() || !f.objeto.trim()) { setError("Completá cámara y objeto."); return; }
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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-900">{inicial ? "Obra " + (inicial.expediente || "sin expediente") : "Nueva obra"}</h2>
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
              <p className="text-sm text-red-800">Esta obra se borrará del plan definitivamente.</p>
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
            <Campo_Input label="Expediente" value={f.expediente} onChange={v => set("expediente", v)} placeholder="14-02011/26" />
            <div className="col-span-1 md:col-span-3"><CampoOpciones label="Cámara *" value={f.camara} onChange={v => set("camara", v)} opciones={camaras} /></div>
            <div className="col-span-2 md:col-span-4"><Campo_Input label="Destino" value={f.destino} onChange={v => set("destino", v)} /></div>
            <div className="col-span-2 md:col-span-4"><AreaTexto label="Objeto *" value={f.objeto} onChange={v => set("objeto", v)} /></div>
            <Campo_Input label="Monto" value={f.monto} onChange={v => set("monto", v)} placeholder="$ 110.832.640,00" />
            <CampoOpciones label="Encuadre" value={f.encuadre} onChange={v => set("encuadre", v)} opciones={ENCUADRES_OBRA} />
            <div className="col-span-2"><CampoOpciones label="Estado" value={f.estado} onChange={v => set("estado", v)} opciones={ESTADOS_OBRA} /></div>
            <Campo_Input label="Fecha último movimiento" type="date" value={f.fechaUltimoMov} onChange={v => set("fechaUltimoMov", v)} />
            <CampoOpciones label="Dependencia actual" value={f.dependenciaActual} onChange={v => set("dependenciaActual", v)} opciones={DEPENDENCIAS_OBRA} />
            <Campo_Input label="Orden de compra" value={f.ordenCompra} onChange={v => set("ordenCompra", v)} />
            <Campo_Input label="Fecha notificación OC" type="date" value={f.fechaNotificacionOC} onChange={v => set("fechaNotificacionOC", v)} />
            <div className="col-span-2"><AreaTexto label="Plazo de ejecución" value={f.plazoEjecucion} onChange={v => set("plazoEjecucion", v)} /></div>
            <div className="col-span-2"><AreaTexto label="Observaciones" value={f.observaciones} onChange={v => set("observaciones", v)} /></div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onCerrar} disabled={guardando} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50">Cancelar</button>
            <BotonAccion onClick={guardar} cargando={guardando}
              className="px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
              {inicial ? "Guardar cambios" : "Cargar obra"}
            </BotonAccion>
          </div>
        </div>
      </div>
    </div>
  );
}

function exportarExcel(filas) {
  const datos = [
    ["Expediente", "Cámara", "Destino", "Objeto", "Monto", "Encuadre", "Estado", "Fecha último Movimiento", "Dependencia actual",
      "Orden de Compra", "Fecha notificación OC", "Plazo de ejecución", "Observaciones"],
    ...filas.map(o => [
      o.expediente || "", o.camara, o.destino || "", o.objeto, o.monto || "", o.encuadre || "", o.estado || "",
      o.fechaUltimoMov ? fecha(o.fechaUltimoMov) : "", o.dependenciaActual || "", o.ordenCompra || "",
      o.fechaNotificacionOC ? fecha(o.fechaNotificacionOC) : "", o.plazoEjecucion || "", o.observaciones || "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws["!cols"] = [14, 40, 40, 50, 18, 22, 30, 12, 20, 16, 12, 18, 60].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plan de Obras " + ANIO_PLAN_OBRAS);
  XLSX.writeFile(wb, "plan-de-obras-" + ANIO_PLAN_OBRAS + ".xlsx");
}

// Plan de Obras del año: la planilla de seguimiento de la jefa de la
// Subdirección, en el orden de su planilla original.
export default function PlanObras({ mostrarToast }) {
  const [obras, setObras] = useState(null);
  const [f, setF] = useState(filtroVacio);
  const [pagina, setPagina] = useState(0);
  const [form, setForm] = useState(null); // null | "nuevo" | id de la obra
  // Cambiar un filtro vuelve a la primera página.
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); setPagina(0); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/plan-obras");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (activo) setObras(data.obras || []);
      } catch (err) {
        if (activo) { setObras([]); mostrarToast(err.message || "No se pudo cargar el Plan de Obras"); }
      }
    })();
    return () => { activo = false; };
    // Solo al montar: mostrarToast del Dashboard cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = obras || [];
  // Opciones de cada filtro: la lista base más lo que ya está cargado.
  const opciones = useMemo(() => {
    const de = (campo, base) => [...new Set([...base, ...lista.map(o => o[campo]).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
    return {
      camara: de("camara", []),
      encuadre: de("encuadre", ENCUADRES_OBRA),
      estado: [...new Set([...ESTADOS_OBRA, ...lista.map(o => o.estado).filter(Boolean)])],
      dependenciaActual: de("dependenciaActual", DEPENDENCIAS_OBRA),
    };
  }, [lista]);
  const camaras = useMemo(() => [...new Set([...FUEROS_RESOLUCIONES, ...opciones.camara])].sort((a, b) => a.localeCompare(b)), [opciones]);

  const filas = useMemo(() => lista.filter(o => {
    if (f.texto && !norm([o.expediente, o.destino, o.objeto, o.observaciones].join(" ")).includes(norm(f.texto))) return false;
    for (const campo of ["camara", "encuadre", "estado", "dependenciaActual"]) {
      if (f[campo] && o[campo] !== f[campo]) return false;
    }
    return true;
  }), [lista, f]);

  const totalPaginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const filasPagina = filas.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);

  const seleccionada = form && form !== "nuevo" ? lista.find(o => o.id === form) : null;

  async function enviar(url, method, body) {
    let res;
    try {
      res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    } catch {
      return { error: "Sin conexión: no se guardó el cambio" };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "No se pudo guardar" };
    return data;
  }

  async function guardar(datos) {
    const data = seleccionada
      ? await enviar("/api/plan-obras/" + seleccionada.id, "PUT", datos)
      : await enviar("/api/plan-obras", "POST", datos);
    if (data.error) return data;
    setObras(prev => seleccionada ? prev.map(o => (o.id === data.obra.id ? data.obra : o)) : [...prev, data.obra]);
    setForm(null);
    mostrarToast(seleccionada ? "Obra actualizada" : "Obra cargada al plan");
  }

  async function eliminar() {
    const data = await enviar("/api/plan-obras/" + seleccionada.id, "DELETE");
    if (data.error) { mostrarToast(data.error); return; }
    setObras(prev => prev.filter(o => o.id !== seleccionada.id));
    setForm(null);
    mostrarToast("Obra eliminada del plan");
  }

  if (obras === null) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando el Plan de Obras...</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Plan de Obras {ANIO_PLAN_OBRAS}</h3>
          <span className="text-[11px] text-slate-500">{filas.length} de {lista.length} obra{lista.length !== 1 ? "s" : ""}</span>
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
            <Plus size={14} /> Cargar obra
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[2000px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              {["Expediente", "Cámara", "Destino", "Objeto", "Monto", "Encuadre", "Estado", "Último mov.", "Dependencia actual",
                "Orden de compra", "Notif. OC", "Plazo de ejecución", "Observaciones"].map(t => <th key={t} className="pt-2 px-3">{t}</th>)}
            </tr>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              <th className="py-2 px-3 align-top w-[130px]"><input value={f.texto} onChange={e => set("texto", e.target.value)} placeholder="Exp., destino, objeto..." className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top w-[200px]"><FiltroColumna valor={f.camara} opciones={opciones.camara} onChange={v => set("camara", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[160px]"><FiltroColumna valor={f.encuadre} opciones={opciones.encuadre} onChange={v => set("encuadre", v)} /></th>
              <th className="py-2 px-3 align-top w-[200px]"><FiltroColumna valor={f.estado} opciones={opciones.estado} onChange={v => set("estado", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[160px]"><FiltroColumna valor={f.dependenciaActual} opciones={opciones.dependenciaActual} onChange={v => set("dependenciaActual", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={13} className="py-10 text-center text-sm text-slate-500">No hay obras con esos filtros.</td></tr>
            ) : filasPagina.map(o => (
              <tr key={o.id} onClick={() => setForm(o.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer align-top text-xs text-slate-700">
                <td className="py-2.5 px-3 whitespace-nowrap font-mono font-semibold text-slate-900">{o.expediente || <span className="font-sans font-normal text-slate-400">Sin expediente</span>}</td>
                <td className="py-2.5 px-3"><span className="line-clamp-2" title={o.camara}>{o.camara}</span></td>
                <td className="py-2.5 px-3 max-w-[220px]"><span className="line-clamp-2" title={o.destino || ""}>{o.destino || "-"}</span></td>
                <td className="py-2.5 px-3 max-w-[280px]"><span className="line-clamp-3 whitespace-pre-line" title={o.objeto}>{o.objeto}</span></td>
                <td className="py-2.5 px-3 whitespace-nowrap">{o.monto || "-"}</td>
                <td className="py-2.5 px-3">{o.encuadre || "-"}</td>
                <td className="py-2.5 px-3 font-medium text-slate-900">{o.estado || "-"}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{fecha(o.fechaUltimoMov)}</td>
                <td className="py-2.5 px-3">{o.dependenciaActual || "-"}</td>
                <td className="py-2.5 px-3">{o.ordenCompra || "-"}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">{fecha(o.fechaNotificacionOC)}</td>
                <td className="py-2.5 px-3 whitespace-pre-line">{o.plazoEjecucion || "-"}</td>
                <td className="py-2.5 px-3 max-w-[320px]"><span className="line-clamp-3 whitespace-pre-line" title={o.observaciones || ""}>{o.observaciones || "-"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-t border-slate-100 text-xs text-slate-500">
          <span>{paginaActual * POR_PAGINA + 1}–{paginaActual * POR_PAGINA + filasPagina.length} de {filas.length}</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 0} title="Página anterior"
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white">
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPaginas }, (_, i) => (
              <button key={i} type="button" onClick={() => setPagina(i)}
                className={"min-w-[26px] px-1.5 py-1 rounded-md text-xs font-medium tabular-nums " +
                  (i === paginaActual ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {i + 1}
              </button>
            ))}
            <button type="button" onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas - 1} title="Página siguiente"
              className="p-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {form && (
        <FormularioObra
          key={form}
          inicial={seleccionada}
          camaras={camaras}
          onCerrar={() => setForm(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
        />
      )}
    </div>
  );
}
