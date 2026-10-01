"use client";

import { useEffect, useMemo, useState } from "react";
import { X, FilePlus2 } from "lucide-react";
import { ALERTA_ESTILO, ALERTA_LABEL, ZONAS } from "@/lib/constants";
import { alertaFrenado, fmtFecha } from "@/lib/utils";
import { SECTORES_MESA, ultimoMovimiento, diasFrenadoMesa, fechaISO } from "@/lib/mesaEntradas";
import FiltroDesplegable from "./FiltroDesplegable";
import FormularioMesa from "./FormularioMesa";
import DetalleMesa from "./DetalleMesa";

const norm = s => String(s || "").trim().toLowerCase();
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";
const NIVELES_FRENADO = ["rojo", "amarillo", "verde"];

function FiltroColumna({ valor, etiqueta, opciones, onChange }) {
  return (
    <FiltroDesplegable
      valor={valor}
      onChange={onChange}
      opciones={[{ valor: "", etiqueta }, ...opciones.map(o => (typeof o === "string" ? { valor: o, etiqueta: o } : o))]}
      clase={"bg-white border-slate-300 " + (valor === "" ? "text-slate-400" : "text-slate-900")}
      anchoCompleto
      flotante
    />
  );
}

function filtroVacio() {
  return { exp: "", sectorTramita: "", fuero: "", zona: "", caratula: "", vieneDe: "", sector: "", subsector: "", frenado: "" };
}

const fecha = f => (f ? fmtFecha(fechaISO(f)) : "-");

// Vista principal del departamento Mesa de Entradas: el control de entrada
// y salida de expedientes, con las mismas columnas que la planilla
// "CONTROL MESA DE ENTRADA". Sector, de dónde viene, fecha de ingreso y
// observaciones salen del último movimiento registrado.
export default function MesaDeEntradas({ sesion, busqueda, mostrarToast }) {
  const [expedientes, setExpedientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [f, setF] = useState(filtroVacio);
  const [seleccionadoId, setSeleccionadoId] = useState(null);
  const [form, setForm] = useState(null); // 'caratular' | 'editar'

  const puedeEditar = sesion.rol === "admin" || sesion.rol === "operador";
  const puedeEliminar = sesion.rol === "admin" || sesion.rol === "soporte";

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/mesa-entradas");
        const data = await res.json();
        if (activo) setExpedientes(data.expedientes || []);
      } catch {
        if (activo) mostrarToast("No se pudieron cargar los expedientes");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }
  const hayFiltros = Object.values(f).some(Boolean);

  // Sugerencias de sector: la lista base más lo ya cargado (la planilla
  // importada viene en mayúsculas, ej. "SUBDIRECCION").
  const sectores = useMemo(() => {
    const valores = new Set(SECTORES_MESA);
    for (const e of expedientes) {
      if (e.sectorTramita) valores.add(e.sectorTramita);
      for (const m of e.movimientos || []) {
        [m.vieneDe, m.sector, m.subsector].filter(Boolean).forEach(v => valores.add(v));
      }
    }
    return [...valores].sort((a, b) => a.localeCompare(b));
  }, [expedientes]);

  const opcionesDe = (obtener) => [...new Set(expedientes.map(obtener).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const opciones = useMemo(() => ({
    sectorTramita: opcionesDe(e => e.sectorTramita),
    vieneDe: opcionesDe(e => ultimoMovimiento(e)?.vieneDe),
    sector: opcionesDe(e => ultimoMovimiento(e)?.sector),
    subsector: opcionesDe(e => ultimoMovimiento(e)?.subsector),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [expedientes]);

  const filas = useMemo(() => {
    const q = norm(busqueda);
    return expedientes.filter(e => {
      const ult = ultimoMovimiento(e);
      if (q) {
        const texto = [e.exp, e.objeto, e.agente, ...(e.fuero || []), ...(e.organismos || []), ...(e.domiciliosRenglones || []), ult?.sector, ult?.observacion].map(norm).join(" ");
        if (!texto.includes(q)) return false;
      }
      if (f.exp && !norm(e.exp).includes(norm(f.exp))) return false;
      if (f.fuero && !norm((e.fuero || []).join(" ")).includes(norm(f.fuero))) return false;
      if (f.caratula && !norm(e.objeto).includes(norm(f.caratula))) return false;
      if (f.sectorTramita && e.sectorTramita !== f.sectorTramita) return false;
      if (f.zona && e.zona !== f.zona) return false;
      if (f.vieneDe && ult?.vieneDe !== f.vieneDe) return false;
      if (f.sector && ult?.sector !== f.sector) return false;
      if (f.subsector && ult?.subsector !== f.subsector) return false;
      if (f.frenado) {
        const d = diasFrenadoMesa(e);
        if (d == null || alertaFrenado(d) !== f.frenado) return false;
      }
      return true;
    });
  }, [expedientes, busqueda, f]);

  const seleccionado = expedientes.find(e => e.id === seleccionadoId) || null;

  function reemplazar(exp) {
    setExpedientes(prev => prev.some(e => e.id === exp.id) ? prev.map(e => (e.id === exp.id ? exp : e)) : [exp, ...prev]);
  }

  async function enviar(url, method, body) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "No se pudo guardar" };
    return data;
  }

  async function caratular(datos) {
    const data = await enviar("/api/mesa-entradas", "POST", datos);
    if (data.error) return data;
    reemplazar(data.expediente);
    setForm(null);
    mostrarToast("Expediente " + data.expediente.exp + " caratulado");
  }

  async function editar(datos) {
    const data = await enviar("/api/mesa-entradas/" + seleccionado.id, "PUT", datos);
    if (data.error) return data;
    reemplazar(data.expediente);
    setForm(null);
    mostrarToast("Expediente actualizado");
  }

  async function registrarMovimiento(movimiento) {
    const data = await enviar("/api/mesa-entradas/" + seleccionado.id, "PUT", { movimiento });
    if (data.error) return data;
    reemplazar(data.expediente);
    mostrarToast("Movimiento registrado");
  }

  async function eliminar() {
    const res = await fetch("/api/mesa-entradas/" + seleccionado.id, { method: "DELETE" });
    if (!res.ok) { mostrarToast("No se pudo eliminar el expediente"); return; }
    setExpedientes(prev => prev.filter(e => e.id !== seleccionado.id));
    setSeleccionadoId(null);
    mostrarToast("Expediente eliminado");
  }

  if (cargando) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando...</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Control de Mesa de Entradas</h3>
          <span className="text-[11px] text-slate-500">{filas.length} de {expedientes.length} expediente{expedientes.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          {hayFiltros && (
            <button type="button" onClick={() => setF(filtroVacio())} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
              <X size={12} /> Limpiar filtros de la tabla
            </button>
          )}
          {puedeEditar && (
            <button type="button" onClick={() => setForm("caratular")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              <FilePlus2 size={14} /> Caratular
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1700px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              <th className="pt-2 px-3">Exp</th>
              <th className="pt-2 px-3">Sector que tramita</th>
              <th className="pt-2 px-3">Fuero</th>
              <th className="pt-2 px-3">Zona</th>
              <th className="pt-2 px-3">Fecha de inicio</th>
              <th className="pt-2 px-3">Carátula</th>
              <th className="pt-2 px-3">Tipo de contratación</th>
              <th className="pt-2 px-3">Ingreso Subdirección</th>
              <th className="pt-2 px-3">Fecha de ingreso</th>
              <th className="pt-2 px-3">Viene del sector</th>
              <th className="pt-2 px-3">Sector</th>
              <th className="pt-2 px-3">Subsector</th>
              <th className="pt-2 px-3">WD</th>
              <th className="pt-2 px-3">R</th>
              <th className="pt-2 px-3">Observaciones</th>
              <th className="pt-2 px-3">Días frenado</th>
            </tr>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              <th className="py-2 px-3 align-top w-[120px]"><input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top w-[140px]"><FiltroColumna valor={f.sectorTramita} etiqueta="Todos" opciones={opciones.sectorTramita} onChange={v => set("sectorTramita", v)} /></th>
              <th className="py-2 px-3 align-top w-[170px]"><input value={f.fuero} onChange={e => set("fuero", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top w-[100px]"><FiltroColumna valor={f.zona} etiqueta="Todas" opciones={ZONAS} onChange={v => set("zona", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[220px]"><input value={f.caratula} onChange={e => set("caratula", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[140px]"><FiltroColumna valor={f.vieneDe} etiqueta="Todos" opciones={opciones.vieneDe} onChange={v => set("vieneDe", v)} /></th>
              <th className="py-2 px-3 align-top w-[140px]"><FiltroColumna valor={f.sector} etiqueta="Todos" opciones={opciones.sector} onChange={v => set("sector", v)} /></th>
              <th className="py-2 px-3 align-top w-[140px]"><FiltroColumna valor={f.subsector} etiqueta="Todos" opciones={opciones.subsector} onChange={v => set("subsector", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[110px]">
                <FiltroColumna valor={f.frenado} etiqueta="Todos" onChange={v => set("frenado", v)}
                  opciones={NIVELES_FRENADO.map(n => ({ valor: n, etiqueta: ALERTA_LABEL[n] }))} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={16} className="py-10 text-center text-sm text-slate-500">
                  No se encontraron expedientes con los filtros aplicados.
                </td>
              </tr>
            ) : filas.map(e => {
              const ult = ultimoMovimiento(e);
              const frenado = diasFrenadoMesa(e);
              return (
                <tr key={e.id} onClick={() => setSeleccionadoId(e.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer align-top">
                  <td className="py-2.5 px-3 font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{e.exp}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{e.sectorTramita || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{(e.fuero || []).join(" · ") || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{e.zona || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-nowrap">{fecha(e.fechaInicio)}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700"><span className="line-clamp-2" title={e.objeto}>{e.objeto || "-"}</span></td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{e.tipoContratacion || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-nowrap">{fecha(e.ingresoSubdireccion)}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700 whitespace-nowrap">{fecha(ult?.fecha)}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{ult?.vieneDe || "-"}</td>
                  <td className="py-2.5 px-3 text-xs font-medium text-slate-900">{ult?.sector || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{ult?.subsector || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{e.wd || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-700">{e.r || "-"}</td>
                  <td className="py-2.5 px-3 text-xs text-slate-600 max-w-[260px]"><span className="line-clamp-2" title={ult?.observacion || ""}>{ult?.observacion || "-"}</span></td>
                  <td className="py-2.5 px-3">
                    {frenado != null ? (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap " + ALERTA_ESTILO[alertaFrenado(frenado)]}>{frenado} días</span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {seleccionado && !form && (
        <DetalleMesa
          exp={seleccionado}
          sectores={sectores}
          puedeEditar={puedeEditar}
          puedeEliminar={puedeEliminar}
          onCerrar={() => setSeleccionadoId(null)}
          onMovimiento={registrarMovimiento}
          onEditar={() => setForm("editar")}
          onEliminar={eliminar}
        />
      )}

      {form && (
        <FormularioMesa
          inicial={form === "editar" ? seleccionado : null}
          sectores={sectores}
          onCerrar={() => setForm(null)}
          onGuardar={form === "editar" ? editar : caratular}
        />
      )}
    </div>
  );
}
