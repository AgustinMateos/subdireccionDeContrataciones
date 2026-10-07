"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ALERTA_ESTILO, ESTADOS_CONVOCATORIA } from "@/lib/constants";
import FiltroDesplegable from "./FiltroDesplegable";
import { alerta, alertaFrenado, diasFrenado, diasRestantes, fechaUltimoMovimiento, fmtFecha, soloFechaLocal } from "@/lib/utils";

const norm = s => String(s || "").trim().toLowerCase();

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// "2027-12" → "Diciembre 2027"
const etiquetaMes = ym => MESES[Number(ym.slice(5, 7)) - 1] + " " + ym.slice(0, 4);

const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";

// Mismo filtro de columna que la tabla de Servicios: el nombre de la
// columna como primera opción, en gris mientras no se elige un valor.
function FiltroColumna({ valor, etiqueta, opciones, onChange }) {
  return (
    <FiltroDesplegable
      valor={valor}
      onChange={onChange}
      opciones={[{ valor: "Todos", etiqueta }, ...opciones.map(x => ({ valor: x, etiqueta: x }))]}
      clase={"bg-white border-slate-300 " + (valor === "Todos" ? "text-slate-400" : "text-slate-900")}
      anchoCompleto
      flotante
    />
  );
}

function filtroVacio() {
  return {
    organismo: "", domicilio: "", objeto: "", exp: "",
    contratacion: "Todos", mesInicio: "Todos", sector: "Todos", estadoConvocatoria: "Todos",
  };
}

const organismosDe = e => (e.organismos?.length ? e.organismos : e.fuero || []);
const domiciliosDe = e => (e.domiciliosRenglones?.length ? e.domiciliosRenglones : e.domicilio ? [e.domicilio] : []);

// Fechas de la API como día local (igual que normalizarExpediente en el
// Dashboard), para reutilizar fechaUltimoMovimiento / diasFrenado.
function normalizar(e) {
  const observaciones = (e.observaciones || []).map(o => ({ ...o, fecha: soloFechaLocal(o.fecha) }));
  const creadoEn = soloFechaLocal(e.creadoEn);
  return {
    ...e,
    creadoEn,
    fechaInicio: e.fechaInicio ? String(e.fechaInicio).slice(0, 10) : "",
    observaciones,
    vigentes: (e.vigentes || []).map(v => ({ ...v, fechaVencimiento: String(v.fechaVencimiento).slice(0, 10) })),
    contratacion: e.encuadre || "",
    ultimoMovimiento: fechaUltimoMovimiento(observaciones),
    frenado: diasFrenado(observaciones, creadoEn),
  };
}

// Panel de control de Servicios (solo para EMAIL_CONTROL_SERVICIOS): una
// fila por parche o renovación en trámite de Servicios, con las columnas de la
// planilla de seguimiento. Solo lectura: sector y estado de convocatoria
// los sigue cargando Servicios.
export default function PanelControlServicios({ mostrarToast }) {
  const [expedientes, setExpedientes] = useState(null);
  const [f, setF] = useState(filtroVacio);
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/control-servicios");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (activo) setExpedientes((data.expedientes || []).map(normalizar));
      } catch (err) {
        if (activo) { setExpedientes([]); mostrarToast(err.message || "No se pudieron cargar los expedientes"); }
      }
    })();
    return () => { activo = false; };
    // Solo al montar: mostrarToast del Dashboard cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = expedientes || [];
  const opcionesContratacion = useMemo(() => [...new Set(lista.map(e => e.contratacion).filter(Boolean))].sort(), [lista]);
  // Meses de inicio presentes, del más cercano al más lejano.
  const opcionesMesInicio = useMemo(() => [...new Set(lista.map(e => e.fechaInicio.slice(0, 7)).filter(Boolean))].sort(), [lista]);
  const opcionesSector = useMemo(() => [...new Set(lista.map(e => e.sector || "Sin definir"))].sort(), [lista]);
  const opcionesEstado = useMemo(() => {
    const presentes = new Set(lista.map(e => e.estadoConvocatoria || "Sin definir"));
    return [...ESTADOS_CONVOCATORIA.filter(x => presentes.has(x)), ...[...presentes].filter(x => !ESTADOS_CONVOCATORIA.includes(x))];
  }, [lista]);

  const filas = useMemo(() => lista.filter(e => {
    if (f.organismo && !norm(organismosDe(e).join(" ")).includes(norm(f.organismo))) return false;
    if (f.domicilio && !norm(domiciliosDe(e).join(" ")).includes(norm(f.domicilio))) return false;
    if (f.objeto && !norm(e.objeto).includes(norm(f.objeto))) return false;
    if (f.exp && !norm(e.exp + " " + (e.nombreCorto || "")).includes(norm(f.exp))) return false;
    if (f.contratacion !== "Todos" && e.contratacion !== f.contratacion) return false;
    if (f.mesInicio !== "Todos" && (f.mesInicio === "sinFecha" ? e.fechaInicio : e.fechaInicio.slice(0, 7) !== f.mesInicio)) return false;
    if (f.sector !== "Todos" && (e.sector || "Sin definir") !== f.sector) return false;
    if (f.estadoConvocatoria !== "Todos" && (e.estadoConvocatoria || "Sin definir") !== f.estadoConvocatoria) return false;
    return true;
  }), [lista, f]);

  if (expedientes === null) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando expedientes...</div>;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Panel de control de Servicios</h3>
          <span className="text-[11px] text-slate-500">{filas.length} de {lista.length} expediente{lista.length !== 1 ? "s" : ""} · parches y renovaciones en trámite</span>
        </div>
        {hayFiltros && (
          <button type="button" onClick={() => setF(filtroVacio())} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1200px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              <th className="py-2 px-3 align-top"><input value={f.organismo} onChange={e => set("organismo", e.target.value)} placeholder="Organismo" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top"><input value={f.domicilio} onChange={e => set("domicilio", e.target.value)} placeholder="Domicilio" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top"><input value={f.objeto} onChange={e => set("objeto", e.target.value)} placeholder="Objeto" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top"><input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Exp." className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top">
                <FiltroColumna valor={f.contratacion} etiqueta="Contratación" opciones={opcionesContratacion} onChange={v => set("contratacion", v)} />
              </th>
              <th className="py-2 px-3 align-top">
                <FiltroDesplegable
                  valor={f.mesInicio}
                  onChange={v => set("mesInicio", v)}
                  opciones={[
                    { valor: "Todos", etiqueta: "Inicio" },
                    ...opcionesMesInicio.map(ym => ({ valor: ym, etiqueta: etiquetaMes(ym) })),
                    { valor: "sinFecha", etiqueta: "Sin fecha de inicio" },
                  ]}
                  clase={"bg-white border-slate-300 " + (f.mesInicio === "Todos" ? "text-slate-400" : "text-slate-900")}
                  anchoCompleto
                  flotante
                />
              </th>
              <th className="py-2 px-3 align-top"><span className="text-xs text-slate-400">Vto. vigente</span></th>
              <th className="py-2 px-3 align-top"><span className="text-xs text-slate-400">Último mov.</span></th>
              <th className="py-2 px-3 align-top">
                <FiltroColumna valor={f.sector} etiqueta="Sector" opciones={opcionesSector} onChange={v => set("sector", v)} />
              </th>
              <th className="py-2 px-3 align-top">
                <FiltroColumna valor={f.estadoConvocatoria} etiqueta="Estado de convocatoria" opciones={opcionesEstado} onChange={v => set("estadoConvocatoria", v)} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-slate-500">
                  {lista.length === 0 ? "No hay parches ni renovaciones en trámite." : "No se encontraron expedientes con esos filtros."}
                </td>
              </tr>
            ) : filas.map(e => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0 align-top hover:bg-slate-50/60">
                <td className="py-2.5 px-3 text-xs text-slate-700 max-w-[180px]">{organismosDe(e).join(" · ") || "-"}</td>
                <td className="py-2.5 px-3 text-xs text-slate-700 max-w-[160px]">
                  {domiciliosDe(e).length === 0 ? "-" : domiciliosDe(e).map(d => <div key={d}>{d}</div>)}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-700 max-w-[260px]">{e.objeto}</td>
                <td className="py-2.5 px-3 whitespace-nowrap">
                  <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                  {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-700">
                  {e.contratacion || "-"}
                  {e.nroContratacion && <div className="text-[11px] text-slate-500">N° {e.nroContratacion}</div>}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">{e.fechaInicio ? fmtFecha(e.fechaInicio) : "Sin fecha"}</td>
                <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                  {e.vigentes.length === 0 ? "Sin vigente" : e.vigentes.map(v => {
                    const dias = diasRestantes(v.fechaVencimiento);
                    return (
                      <div key={v.exp} className="mb-2 last:mb-0">
                        <div className="font-mono text-[11px] font-semibold text-slate-900">{v.exp}</div>
                        {fmtFecha(v.fechaVencimiento)}
                        <div className="mt-1">
                          <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alerta(dias)]}>
                            {dias >= 0 ? dias + " días" : Math.abs(dias) + " días vencido"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                  {e.ultimoMovimiento ? fmtFecha(e.ultimoMovimiento) : "Sin movimientos"}
                  {e.frenado != null && (
                    <div className="mt-1">
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(e.frenado)]}>
                        {e.frenado} días en el sector
                      </span>
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-700">{e.sector || "-"}</td>
                <td className="py-2.5 px-3 text-xs text-slate-700">{e.estadoConvocatoria || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
