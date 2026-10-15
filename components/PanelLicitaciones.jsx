"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Download, Trash2, ArrowRight, ChevronDown, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { ALERTA_ESTILO } from "@/lib/constants";
import { alertaDias } from "@/lib/diasEnSector";
import { fmtFecha } from "@/lib/utils";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { EMAIL_JEFA_SUBDIRECCION, fechaISO } from "@/lib/resoluciones";
import {
  JURISDICCIONES_LICITACIONES, RUBROS_LICITACIONES, ENCUADRES_LICITACIONES, SECTORES_LICITACIONES,
  ESTADOS_INTERNOS_LICITACIONES, ESTADOS_CONVOCATORIA_LICITACIONES, AGENTES_LICITACIONES, AGENTE_POR_JURISDICCION,
  agentePorJurisdiccion, compararLicitaciones, diasEnSectorLicitacion, esPrioritarioLicitacion, esTerminada, estaEnLicitaciones,
} from "@/lib/licitaciones";
import BotonAccion from "./BotonAccion";
import Paginacion, { OPCIONES_POR_PAGINA } from "./Paginacion";
import EstrellaPrioridad from "./EstrellaPrioridad";
import EtiquetasPrioridad from "./EtiquetasPrioridad";
import { Campo_Input } from "./CamposFormulario";
import CampoOpciones from "./CampoOpciones";
import { SelectRapido, FiltroColumna, Seccion, DatoFicha } from "./PanelResoluciones";

const norm = s => String(s || "").trim().toLowerCase();
const fecha = f => (f ? fmtFecha(fechaISO(f)) : "-");
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";


const ETIQUETA_CAMPO = { sector: "Sector", estadoInterno: "Estado interno", estadoConvocatoria: "Estado convocatoria" };

function filtroVacio() {
  return { exp: "", objeto: "", jurisdiccion: "", rubro: "", encuadre: "", sector: "", estadoInterno: "", estadoConvocatoria: "", agente: "" };
}

const VACIO = {
  exp: "", jurisdiccion: "", organismo: "", domicilio: "", rubro: "", objeto: "", monto: "", plazoEjecucion: "",
  encuadre: "", fechaUltimoMov: "", sector: "", estadoInterno: "", estadoConvocatoria: "", observaciones: "",
  agente: "", paseFirma: "", prioritario: false,
};

function aFormulario(e) {
  if (!e) return { ...VACIO, fechaUltimoMov: hoyLocalISO(), sector: "Licitaciones" };
  const f = {};
  for (const k of Object.keys(VACIO)) f[k] = e[k] ?? "";
  for (const k of ["fechaUltimoMov", "paseFirma"]) f[k] = fechaISO(e[k]);
  // El cuadro de observaciones es para agregar una nueva: las anteriores
  // quedan en el historial.
  f.observaciones = "";
  return f;
}

// "COMODORO RIVADAVIA" → "Comodoro Rivadavia".
const tituloJurisdiccion = s => s.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase());

// Alta / edición de un expediente, en dos solapas: los datos y sus
// movimientos y estados (con el historial). Al editar, la jefa ve los
// datos como ficha: solo cambia agente y prioridad.
export function FormularioLicitacion({ inicial, esJefa, onCerrar, onGuardar, onEliminar }) {
  const [f, setF] = useState(() => aFormulario(inicial));
  const [solapa, setSolapa] = useState("datos");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [versionAlAbrir] = useState(inicial?.actualizadoEn);
  const cambioMientrasEditaba = !!inicial && inicial.actualizadoEn !== versionAlAbrir;
  const fijo = esJefa && !!inicial;

  function set(campo, valor) {
    setF(prev => {
      const nuevo = { ...prev, [campo]: valor };
      // En un alta de la jefa, el agente sigue a la jurisdicción mientras
      // no lo haya cambiado a mano.
      if (campo === "jurisdiccion" && !inicial && (!prev.agente || prev.agente === agentePorJurisdiccion(prev.jurisdiccion))) {
        nuevo.agente = agentePorJurisdiccion(valor) || "";
      }
      return nuevo;
    });
    setError("");
  }

  async function guardar() {
    if (!f.exp.trim() || !f.objeto.trim()) { setError("Completá N° de expediente y objeto."); setSolapa("datos"); return; }
    setGuardando(true);
    // Sin observación nueva, queda la última que tenía.
    const res = await onGuardar({ ...f, observaciones: f.observaciones.trim() || inicial?.observaciones || "" });
    setGuardando(false);
    if (res?.error) setError(res.error);
  }

  async function eliminar() {
    setGuardando(true);
    await onEliminar();
    setGuardando(false);
  }

  const historial = [...(inicial?.movimientos || [])].reverse();
  const dias = inicial ? diasEnSectorLicitacion(inicial) : null;
  const sugerido = agentePorJurisdiccion(f.jurisdiccion);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[min(92vh,820px)] flex flex-col overflow-hidden">
        <div className="px-6 pt-4 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                {inicial ? <>Expediente <span className="font-mono">{inicial.exp}</span></> : "Nuevo expediente"}
              </h2>
              {inicial && <p className="text-xs text-slate-500 truncate" title={inicial.objeto}>{inicial.objeto}</p>}
              {inicial && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <EtiquetasPrioridad expediente={inicial} />
                  {[inicial.sector, inicial.estadoConvocatoria, inicial.estadoInterno].filter(Boolean).map(t => (
                    <span key={t} className="mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700">{t}</span>
                  ))}
                  {dias != null && (
                    <span className={"mt-1 text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} día{dias !== 1 ? "s" : ""} en sector</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {inicial && (
                <button onClick={() => setConfirmarEliminar(true)} title="Eliminar" className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={16} /></button>
              )}
              <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3">
            {[
              { id: "datos", etiqueta: "Datos del expediente" },
              { id: "movimientos", etiqueta: "Movimientos y estados" + (inicial ? " (" + historial.length + ")" : "") },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSolapa(t.id)}
                className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors " +
                  (solapa === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
              >
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cambioMientrasEditaba && (
            <div className="border border-amber-300 bg-amber-50 rounded-md p-3 text-sm text-amber-900">
              Este expediente cambió mientras lo tenías abierto (lo modificó otra persona). Cerrá sin guardar y volvé a abrirlo para ver los cambios; si guardás ahora, se pisan con lo que tenés en pantalla.
            </div>
          )}
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

          {solapa === "datos" && fijo ? (
            <>
              <Seccion titulo="Identificación">
                <DatoFicha label="Exp." valor={f.exp} mono />
                <div className="col-span-1 md:col-span-2"><DatoFicha label="Jurisdicción" valor={f.jurisdiccion} /></div>
                <CampoOpciones label="Agente (asignación)" value={f.agente} onChange={v => set("agente", v)} opciones={AGENTES_LICITACIONES} />
                <div className="col-span-2 md:col-span-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={!!f.prioritario} onChange={e => set("prioritario", e.target.checked)} className="rounded border-slate-300" />
                    Prioritario (estrella)
                  </label>
                </div>
              </Seccion>
              <Seccion titulo="Contratación">
                <div className="col-span-2 md:col-span-4"><DatoFicha label="Objeto" valor={f.objeto} /></div>
                <div className="col-span-2"><DatoFicha label="Organismo" valor={f.organismo} /></div>
                <div className="col-span-2"><DatoFicha label="Domicilio" valor={f.domicilio} /></div>
                <DatoFicha label="Rubro" valor={f.rubro} />
                <DatoFicha label="Encuadre" valor={f.encuadre} />
                <div className="col-span-2"><DatoFicha label="Monto" valor={f.monto} /></div>
                <div className="col-span-2 md:col-span-3"><DatoFicha label="Plazo de ejecución (DH)" valor={f.plazoEjecucion} /></div>
                <DatoFicha label="Pase a la firma" valor={fecha(f.paseFirma)} />
              </Seccion>
            </>
          ) : solapa === "datos" ? (
            <>
              <Seccion titulo="Identificación">
                <Campo_Input label="Exp. *" value={f.exp} onChange={v => set("exp", v)} placeholder="13-05999/25" />
                <div className="col-span-1 md:col-span-2">
                  <CampoOpciones label="Jurisdicción" value={f.jurisdiccion} onChange={v => set("jurisdiccion", v)} opciones={JURISDICCIONES_LICITACIONES} />
                </div>
                {esJefa ? (
                  <CampoOpciones label="Agente (asignación)" value={f.agente} onChange={v => set("agente", v)} opciones={AGENTES_LICITACIONES} />
                ) : (
                  <Campo_Input
                    label={inicial ? "Agente (lo asigna la jefa)" : "Agente (por jurisdicción)"}
                    value={inicial ? f.agente : (sugerido || "")}
                    placeholder={inicial ? "" : "Lo asigna la jefa"}
                    onChange={() => {}}
                    disabled
                  />
                )}
                <div className="col-span-2 md:col-span-4">
                  <label className={"inline-flex items-center gap-2 text-sm " + (esJefa ? "text-slate-700" : "text-slate-400")}>
                    <input type="checkbox" checked={!!f.prioritario} disabled={!esJefa} onChange={e => set("prioritario", e.target.checked)} className="rounded border-slate-300" />
                    Prioritario (estrella){!esJefa && " · lo marca la jefa de la Subdirección"}
                  </label>
                </div>
              </Seccion>

              <Seccion titulo="Contratación">
                <div className="col-span-2 md:col-span-4"><Campo_Input label="Objeto *" value={f.objeto} onChange={v => set("objeto", v)} /></div>
                <div className="col-span-2"><Campo_Input label="Organismo" value={f.organismo} onChange={v => set("organismo", v)} /></div>
                <div className="col-span-2"><Campo_Input label="Domicilio" value={f.domicilio} onChange={v => set("domicilio", v)} /></div>
                <CampoOpciones label="Rubro" value={f.rubro} onChange={v => set("rubro", v)} opciones={RUBROS_LICITACIONES} />
                <CampoOpciones label="Encuadre" value={f.encuadre} onChange={v => set("encuadre", v)} opciones={ENCUADRES_LICITACIONES} />
                <div className="col-span-2"><Campo_Input label="Monto" value={f.monto} onChange={v => set("monto", v)} placeholder="$ 61.096.888,00" /></div>
                <div className="col-span-2 md:col-span-3"><Campo_Input label="Plazo de ejecución (DH)" value={f.plazoEjecucion} onChange={v => set("plazoEjecucion", v)} placeholder="30 o Reng 1 y 2: 20 DH" /></div>
                <Campo_Input label="Pase a la firma" type="date" value={f.paseFirma} onChange={v => set("paseFirma", v)} />
              </Seccion>
            </>
          ) : (
            <>
              <Seccion titulo={"Estado actual" + (fijo ? " · lo modifica Licitaciones" : "")}>
                <CampoOpciones label="Sector" value={f.sector} onChange={v => set("sector", v)} opciones={SECTORES_LICITACIONES} disabled={fijo} />
                <CampoOpciones label="Estado interno" value={f.estadoInterno} onChange={v => set("estadoInterno", v)} opciones={ESTADOS_INTERNOS_LICITACIONES} disabled={fijo} />
                <CampoOpciones label="Estado convocatoria" value={f.estadoConvocatoria} onChange={v => set("estadoConvocatoria", v)} opciones={ESTADOS_CONVOCATORIA_LICITACIONES} disabled={fijo} />
                <Campo_Input label="Último movimiento" type="date" value={f.fechaUltimoMov} onChange={v => set("fechaUltimoMov", v)} />
              </Seccion>

              <Seccion titulo={inicial ? "Nueva observación" : "Observaciones"}>
                <div className="col-span-2 md:col-span-4">
                  <textarea value={f.observaciones} onChange={e => set("observaciones", e.target.value)} rows={3}
                    placeholder={inicial ? "Agregar una observación (queda en el historial)..." : ""}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y" />
                </div>
              </Seccion>

              {inicial && (
                <section className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Historial ({historial.length})</h3>
                  {historial.length === 0 ? (
                    <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
                  ) : (
                    <ol className="relative border-l border-slate-200 ml-1.5 space-y-4">
                      {historial.map(m => {
                        const esObs = m.campo === "Observaciones";
                        return (
                          <li key={m.id} className="pl-5 relative">
                            <span className={"absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white " + (esObs ? "bg-slate-400" : "bg-slate-800")} />
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                              <span className="font-medium text-slate-700">{fecha(m.fecha)}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{m.campo}</span>
                              <span className="ml-auto">{m.usuario}</span>
                            </div>
                            {esObs ? (
                              <p className="mt-1 text-sm text-slate-800 whitespace-pre-line bg-slate-50 border border-slate-100 rounded-md px-3 py-2">{m.valor}</p>
                            ) : (
                              <p className="mt-1 text-sm flex flex-wrap items-center gap-1.5">
                                {m.anterior && (<><span className="text-slate-500 line-through">{m.anterior}</span><ArrowRight size={13} className="text-slate-400" /></>)}
                                <span className="font-medium text-slate-900">{m.valor}</span>
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-xs text-red-600">{error}</p>}
          <button onClick={onCerrar} disabled={guardando} className="px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50">Cancelar</button>
          <BotonAccion onClick={guardar} cargando={guardando}
            className="px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
            {inicial ? "Guardar cambios" : "Cargar expediente"}
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}

// Cuadro de la planilla: cuántos expedientes tiene cada agente en el
// departamento y qué jurisdicciones atiende. Tocar un agente filtra.
function ResumenAgentes({ lista, onElegir }) {
  const [verReparto, setVerReparto] = useState(false);
  const enDepto = lista.filter(e => estaEnLicitaciones(e) && !esTerminada(e));
  const agentes = [...new Set([...AGENTES_LICITACIONES, ...enDepto.map(e => e.agente).filter(Boolean)])];
  const cuenta = a => enDepto.filter(e => e.agente === a).length;
  const sinAsignar = enDepto.filter(e => !String(e.agente || "").trim()).length;
  const reparto = AGENTES_LICITACIONES
    .map(a => [a, AGENTE_POR_JURISDICCION.filter(([, ag]) => ag === a).map(([j]) => tituloJurisdiccion(j))])
    .filter(([, js]) => js.length);

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Users size={15} className="text-slate-400" />
          <span>En el departamento:</span>
          <span className="font-semibold text-slate-900 tabular-nums">{enDepto.length}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {agentes.map(a => (
            <button key={a} type="button" onClick={() => onElegir(a)} title={"Ver los de " + a}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400">
              {a} <span className="font-semibold tabular-nums text-slate-900">{cuenta(a)}</span>
            </button>
          ))}
          {sinAsignar > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border border-amber-200 bg-amber-50 text-amber-800">
              Sin asignar <span className="font-semibold tabular-nums">{sinAsignar}</span>
            </span>
          )}
        </div>
        <button type="button" onClick={() => setVerReparto(v => !v)} className="ml-auto flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
          Reparto por jurisdicción <ChevronDown size={12} className={"transition-transform " + (verReparto ? "rotate-180" : "")} />
        </button>
      </div>
      {verReparto && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 pt-2 border-t border-slate-100 text-xs">
          {reparto.map(([a, js]) => (
            <div key={a}><span className="font-semibold text-slate-900">{a}</span> <span className="text-slate-500">· {js.join(", ")}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

// Solapas del panel: qué expedientes muestra cada una (el Inicio de la
// jefa cuenta con las mismas).
export const SOLAPAS = [
  { id: "general", etiqueta: "General", incluye: () => true },
  { id: "escritorio", etiqueta: "Escritorio", incluye: e => !esTerminada(e) },
  { id: "enDepto", etiqueta: "En Licitaciones", incluye: e => !esTerminada(e) && estaEnLicitaciones(e) },
  { id: "prioritarios", etiqueta: "Prioritarios", incluye: e => !esTerminada(e) && esPrioritarioLicitacion(e) },
  { id: "fuera", etiqueta: "Fuera de Licitaciones", incluye: e => !esTerminada(e) && !!String(e.sector || "").trim() && !estaEnLicitaciones(e) },
  { id: "terminados", etiqueta: "Concluidos y archivados", incluye: esTerminada },
  // Para que la jefa de la Subdirección asigne lo pendiente.
  { id: "sinAsignar", etiqueta: "Sin asignar", incluye: e => !esTerminada(e) && !String(e.agente || "").trim(), soloJefa: true },
];

function exportarExcel(filas, solapa) {
  const datos = [
    ["EXP", "JURISDICCION", "ORGANISMO", "DOMICILIO", "RUBRO", "OBJETO", "MONTO", "PLAZO DE EJECUCION (DH)", "ENCUADRE",
      "ULTIMO MOVIMIENTO", "DIAS EN EL SECTOR", "SECTOR", "ESTADO INTERNO", "ESTADO CONVOCATORIA", "OBSERVACIONES", "AGENTE",
      "PASE A LA FIRMA", "PRIORITARIO"],
    ...filas.map(e => [
      e.exp, e.jurisdiccion || "", e.organismo || "", e.domicilio || "", e.rubro || "", e.objeto, e.monto || "", e.plazoEjecucion || "",
      e.encuadre || "", fecha(e.fechaUltimoMov), diasEnSectorLicitacion(e) ?? "", e.sector || "", e.estadoInterno || "",
      e.estadoConvocatoria || "", e.observaciones || "", e.agente || "", e.paseFirma ? fecha(e.paseFirma) : "",
      e.enPlanObras ? "SI (PLAN DE OBRAS)" : e.prioritario ? "SI" : "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws["!cols"] = [16, 30, 30, 30, 16, 50, 18, 16, 14, 12, 8, 14, 12, 22, 50, 10, 12, 12].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Licitaciones");
  XLSX.writeFile(wb, "licitaciones-" + (solapa === "general" ? "" : solapa + "-") + hoyLocalISO() + ".xlsx");
}

// Sistema del Departamento de Licitaciones: la planilla de seguimiento y
// control de licitaciones. La jefa de la Subdirección también lo usa.
export default function PanelLicitaciones({ sesion, mostrarToast, solapaInicial }) {
  // La jefa de la Subdirección asigna agentes y marca prioridades.
  const esJefa = sesion.email === EMAIL_JEFA_SUBDIRECCION;
  const [expedientes, setExpedientes] = useState(null);
  const [f, setF] = useState(filtroVacio);
  const [solapa, setSolapa] = useState(solapaInicial || "general");
  const [form, setForm] = useState(null); // null | "nuevo" | id del expediente
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(OPCIONES_POR_PAGINA[0]);
  // Cambiar un filtro o la solapa vuelve a la primera página.
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); setPagina(0); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/licitaciones");
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
      jurisdiccion: de("jurisdiccion", []),
      rubro: de("rubro", RUBROS_LICITACIONES),
      encuadre: de("encuadre", ENCUADRES_LICITACIONES),
      sector: de("sector", SECTORES_LICITACIONES),
      estadoInterno: de("estadoInterno", ESTADOS_INTERNOS_LICITACIONES),
      estadoConvocatoria: de("estadoConvocatoria", ESTADOS_CONVOCATORIA_LICITACIONES),
      agente: de("agente", AGENTES_LICITACIONES),
    };
  }, [lista]);

  const solapas = SOLAPAS.filter(s => !s.soloJefa || esJefa);
  const deLaSolapa = useMemo(() => lista.filter(SOLAPAS.find(s => s.id === solapa).incluye), [lista, solapa]);
  // En Concluidos y archivados no se cuentan días en el sector.
  const enTerminados = solapa === "terminados";
  const filas = useMemo(() => deLaSolapa.filter(e => {
    if (f.exp && !norm(e.exp).includes(norm(f.exp))) return false;
    if (f.objeto && !norm(e.objeto + " " + (e.organismo || "") + " " + (e.observaciones || "")).includes(norm(f.objeto))) return false;
    for (const campo of ["jurisdiccion", "rubro", "encuadre", "sector", "estadoInterno", "estadoConvocatoria", "agente"]) {
      if (f[campo] && e[campo] !== f[campo]) return false;
    }
    return true;
  }).sort(compararLicitaciones), [deLaSolapa, f]);

  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const filasPagina = filas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);

  const seleccionado = form && form !== "nuevo" ? lista.find(e => e.id === form) : null;

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
    const data = seleccionado
      ? await enviar("/api/licitaciones/" + seleccionado.id, "PUT", datos)
      : await enviar("/api/licitaciones", "POST", datos);
    if (data.error) return data;
    setExpedientes(prev => seleccionado ? prev.map(e => (e.id === data.expediente.id ? data.expediente : e)) : [...prev, data.expediente]);
    setForm(null);
    mostrarToast(seleccionado ? "Expediente actualizado" : "Expediente " + data.expediente.exp + " cargado");
  }

  // Cambio rápido desde la tabla: sector o estados (el departamento),
  // asignación o prioridad (la jefa). Se muestra al instante; si el
  // servidor lo rechaza, se vuelve atrás.
  async function cambiarRapido(e, cambios) {
    const anteriores = Object.fromEntries(Object.keys(cambios).map(k => [k, e[k]]));
    setExpedientes(prev => prev.map(x => (x.id === e.id ? { ...x, ...cambios } : x)));
    const data = await enviar("/api/licitaciones/" + e.id, "PATCH", cambios);
    if (data.error) {
      setExpedientes(prev => prev.map(x => (x.id === e.id ? { ...x, ...anteriores } : x)));
      mostrarToast(data.error);
      return;
    }
    setExpedientes(prev => prev.map(x => (x.id === data.expediente.id ? data.expediente : x)));
    const [campo, valor] = Object.entries(cambios)[0];
    mostrarToast(campo === "prioritario"
      ? (valor ? e.exp + " marcado como prioritario" : e.exp + " ya no es prioritario")
      : campo === "agente"
        ? e.exp + " asignado a " + (valor || "nadie")
        : e.exp + ": " + ETIQUETA_CAMPO[campo] + " → " + (valor || "sin definir"));
  }

  async function eliminar() {
    const data = await enviar("/api/licitaciones/" + seleccionado.id, "DELETE");
    if (data.error) { mostrarToast(data.error); return; }
    setExpedientes(prev => prev.filter(e => e.id !== seleccionado.id));
    setForm(null);
    mostrarToast("Expediente eliminado");
  }

  if (expedientes === null) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando expedientes...</div>;
  }

  const columnas = ["Exp.", "Jurisdicción", "Organismo", "Rubro", "Objeto", "Encuadre", ...(enTerminados ? [] : ["Días en sector"]),
    "Sector", "Estado interno", "Estado convocatoria", "Último mov.", "Agente", "Pase a la firma"];
  // Para la jefa, sector y estados son texto: la celda abre la ficha.
  const celdaRapida = esJefa ? undefined : ev => ev.stopPropagation();

  return (
    <div className="space-y-4">
    <ResumenAgentes lista={lista} onElegir={a => { setSolapa("enDepto"); setF({ ...filtroVacio(), agente: a }); setPagina(0); }} />
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
      {solapas.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => { setSolapa(s.id); setPagina(0); }}
          className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap " +
            (solapa === s.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
        >
          {s.etiqueta}
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
            {lista.filter(s.incluye).length}
          </span>
        </button>
      ))}
    </div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{SOLAPAS.find(s => s.id === solapa).etiqueta}</h3>
          <span className="text-[11px] text-slate-500">{filas.length} de {deLaSolapa.length} expediente{deLaSolapa.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          {hayFiltros && (
            <button type="button" onClick={() => { setF(filtroVacio()); setPagina(0); }} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
              <X size={12} /> Limpiar filtros
            </button>
          )}
          <button type="button" onClick={() => exportarExcel(filas, solapa)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">
            <Download size={14} /> Exportar a Excel
          </button>
          <button type="button" onClick={() => setForm("nuevo")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
            <Plus size={14} /> Cargar expediente
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1600px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              {columnas.map(t => <th key={t} className="pt-2 px-3">{t}</th>)}
            </tr>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              <th className="py-2 px-3 align-top w-[140px]"><input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top w-[200px]"><FiltroColumna valor={f.jurisdiccion} etiqueta="Todas" opciones={opciones.jurisdiccion} onChange={v => set("jurisdiccion", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[150px]"><FiltroColumna valor={f.rubro} etiqueta="Todos" opciones={opciones.rubro} onChange={v => set("rubro", v)} /></th>
              <th className="py-2 px-3 align-top w-[240px]"><input value={f.objeto} onChange={e => set("objeto", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} /></th>
              <th className="py-2 px-3 align-top w-[130px]"><FiltroColumna valor={f.encuadre} etiqueta="Todos" opciones={opciones.encuadre} onChange={v => set("encuadre", v)} /></th>
              {!enTerminados && <th className="py-2 px-3" />}
              <th className="py-2 px-3 align-top w-[150px]"><FiltroColumna valor={f.sector} etiqueta="Todos" opciones={opciones.sector} onChange={v => set("sector", v)} /></th>
              <th className="py-2 px-3 align-top w-[130px]"><FiltroColumna valor={f.estadoInterno} etiqueta="Todos" opciones={opciones.estadoInterno} onChange={v => set("estadoInterno", v)} /></th>
              <th className="py-2 px-3 align-top w-[190px]"><FiltroColumna valor={f.estadoConvocatoria} etiqueta="Todos" opciones={opciones.estadoConvocatoria} onChange={v => set("estadoConvocatoria", v)} /></th>
              <th className="py-2 px-3" />
              <th className="py-2 px-3 align-top w-[110px]"><FiltroColumna valor={f.agente} etiqueta="Todos" opciones={opciones.agente} onChange={v => set("agente", v)} /></th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={columnas.length} className="py-10 text-center text-sm text-slate-500">No hay expedientes con esos filtros.</td></tr>
            ) : filasPagina.map(e => {
              const dias = diasEnSectorLicitacion(e);
              return (
                <tr key={e.id} onClick={() => setForm(e.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer align-top text-xs text-slate-700">
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {esJefa && <EstrellaPrioridad prioritario={e.prioritario} onClick={() => cambiarRapido(e, { prioritario: !e.prioritario })} />}
                      <span className="font-mono font-semibold text-slate-900 max-w-[190px] whitespace-normal break-words" title={e.exp}>{e.exp}</span>
                    </div>
                    <EtiquetasPrioridad expediente={e} />
                  </td>
                  <td className="py-2.5 px-3"><span className="line-clamp-2" title={e.jurisdiccion || ""}>{e.jurisdiccion || "-"}</span></td>
                  <td className="py-2.5 px-3"><span className="line-clamp-2" title={e.organismo || ""}>{e.organismo || "-"}</span></td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{e.rubro || "-"}</td>
                  <td className="py-2.5 px-3"><span className="line-clamp-2" title={e.objeto}>{e.objeto}</span></td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{e.encuadre || "-"}</td>
                  {!enTerminados && (
                    <td className="py-2.5 px-3">
                      {dias != null ? (
                        <span className={"text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} día{dias !== 1 ? "s" : ""}</span>
                      ) : "-"}
                    </td>
                  )}
                  <td className="py-2.5 px-3" onClick={celdaRapida}>
                    {esJefa
                      ? <span className="font-medium text-slate-900">{e.sector || "-"}</span>
                      : <SelectRapido valor={e.sector} opciones={SECTORES_LICITACIONES} onChange={v => cambiarRapido(e, { sector: v })} fuerte />}
                  </td>
                  <td className="py-2.5 px-3" onClick={celdaRapida}>
                    {esJefa ? (e.estadoInterno || "-") : <SelectRapido valor={e.estadoInterno} opciones={ESTADOS_INTERNOS_LICITACIONES} onChange={v => cambiarRapido(e, { estadoInterno: v })} />}
                  </td>
                  <td className="py-2.5 px-3" onClick={celdaRapida}>
                    {esJefa ? (e.estadoConvocatoria || "-") : <SelectRapido valor={e.estadoConvocatoria} opciones={ESTADOS_CONVOCATORIA_LICITACIONES} onChange={v => cambiarRapido(e, { estadoConvocatoria: v })} />}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{fecha(e.fechaUltimoMov)}</td>
                  <td className="py-2.5 px-3" onClick={esJefa ? ev => ev.stopPropagation() : undefined}>
                    {esJefa ? (
                      <SelectRapido valor={e.agente} opciones={AGENTES_LICITACIONES} vacio="Sin asignar" onChange={v => cambiarRapido(e, { agente: v })} className="min-w-[110px]" />
                    ) : (e.agente || "-")}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{fecha(e.paseFirma)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Paginacion total={filas.length} pagina={paginaActual} porPagina={porPagina}
        onPagina={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(0); }} />

      {form && (
        <FormularioLicitacion
          key={form}
          inicial={seleccionado}
          esJefa={esJefa}
          onCerrar={() => setForm(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
        />
      )}
    </div>
    </div>
  );
}
