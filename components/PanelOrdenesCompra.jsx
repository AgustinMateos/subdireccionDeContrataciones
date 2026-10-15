"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Download, Trash2, ArrowRight, Users, Check, XCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { ALERTA_ESTILO } from "@/lib/constants";
import { alertaDias } from "@/lib/diasEnSector";
import { fmtFecha } from "@/lib/utils";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { EMAIL_JEFA_SUBDIRECCION, fechaISO } from "@/lib/resoluciones";
import { esFechaISO } from "@/lib/diasHabiles";
import {
  AGENTES_ORDENES_COMPRA, TIPOS_ORDEN_COMPRA, ESTADOS_ORDEN_COMPRA, PASES_ORDEN_COMPRA, PASOS_ORDEN_COMPRA,
  CONTROLADORES_ORDENES_COMPRA, avanceOC, cbuCargado, compararOrdenesCompra, fechaYQuien, textoFechaYQuien, compararPorNumeroOC, diasEnOC, siguienteNumeroOC, diasParaVencerOC, esCompleta, esPrioritariaOC, porVencerOC,
} from "@/lib/ordenesCompra";
import BotonAccion from "./BotonAccion";
import {
  AbrirTodos, BotonOpcion, CLASE_ENTRADA, Campo, ElegirDeLista as ElegirDeListaBase, ElegirDia, Entrada, Paso, Pregunta, SiNo, usePasos,
} from "./FormularioFacil";
import Paginacion, { OPCIONES_POR_PAGINA } from "./Paginacion";
import EtiquetasPrioridad from "./EtiquetasPrioridad";
import PanelNotificaciones44 from "./PanelNotificaciones44";
import { SelectRapido, FiltroColumna, DatoFicha } from "./PanelResoluciones";

const norm = s => String(s || "").trim().toLowerCase();
const fecha = f => (f ? fmtFecha(fechaISO(f)) : "-");
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";

const ETIQUETA_CAMPO = { estado: "Estado", pase: "Pase" };
const CAMPOS_FECHA = ["fechaResol", "ingresoOC", "vencimientoOC"];

function filtroVacio() {
  return { exp: "", texto: "", tipo: "", agente: "" };
}

const VACIO = {
  exp: "", numeroOC: "", ampliacionOC: "", prorrogaOC: "", agente: "", organismo: "", objeto: "", tipo: "",
  plazoEjecucion: "", inicioServicio: "", autoriza: "", numeroResol: "", fechaResol: "", proveedor: "",
  montoResolucion: "", montoAjustado: "", ingresoOC: "", vtoArt44: "", vencimientoOC: "", notificacion44: "",
  cbu: "", informe: "", contabilidad: "", controlada: "", firmaSol: "", notificada: "", itemPendiente: "",
  pase: "", estado: "", fechaPublicacion: "", observaciones: "", prioritario: false,
};

function aFormulario(e, numeroNuevo) {
  if (!e) return { ...VACIO, ...partesControlYFirma(VACIO), ingresoOC: hoyLocalISO(), autoriza: "AG", numeroOC: numeroNuevo || "" };
  const f = {};
  for (const k of Object.keys(VACIO)) f[k] = e[k] ?? "";
  for (const k of CAMPOS_FECHA) f[k] = fechaISO(e[k]);
  Object.assign(f, partesControlYFirma(f));
  // El cuadro de observaciones es para agregar una nueva: las anteriores
  // quedan en el historial.
  f.observaciones = "";
  // Se ajusta si tiene un total distinto del de la resolución.
  f.seAjusta = !!f.montoAjustado && soloDigitos(f.montoAjustado) !== soloDigitos(f.montoResolucion);
  return f;
}

const soloDigitos = m => String(m || "").replace(/\D/g, "");

// Año para las fechas sin año de la planilla ("22/04 CARO"): el del ingreso.
const anioDe = f => Number(String(f.ingresoOC || "").slice(0, 4)) || new Date().getFullYear();
// Quien firma "A la firma de Sol" es Sol, salvo que diga otro nombre.
const firmoOtra = quien => !!quien && !/^SOL$/i.test(quien.trim());

// Control y firma por partes: fecha y quién (en la base siguen siendo un
// texto, como en la planilla).
function partesControlYFirma(f) {
  const control = fechaYQuien(f.controlada, anioDe(f));
  const firma = fechaYQuien(f.firmaSol, anioDe(f));
  return {
    controladaFecha: control.fecha || "", controladaPor: control.quien,
    firmaFecha: firma.fecha || "", firmaOtra: firmoOtra(firma.quien), firmaPor: firmoOtra(firma.quien) ? firma.quien : "",
  };
}

// "8/1/26" o "08/01/2026" → "2026-01-08"; lo que no es una fecha, null.
function deTextoFecha(t) {
  const m = String(t || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const iso = (m[3].length === 2 ? "20" + m[3] : m[3]) + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  return esFechaISO(iso) ? iso : null;
}
const aTextoFecha = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);

// ---- Control y firma, pensados para completar sin dudas: preguntas
// claras, botones grandes con los nombres, "Hoy" a un toque y una frase
// que repite lo cargado. ----

// Nombres de las listas como se leen (las opciones se guardan como en la
// planilla, en mayúsculas).
const ETIQUETAS = {
  "EN TRAMITE": "En trámite", COMPLETO: "Completa", TECNICA: "Técnica", LICITACIONES: "Licitaciones",
  CONTABILIDAD: "Contabilidad", SUBDIRECCION: "Subdirección", PROVISION: "Provisión", SERVICIO: "Servicio",
};
const etiqueta = o => ETIQUETAS[o] || (o.length > 3 ? o.charAt(0) + o.slice(1).toLowerCase() : o);

function ElegirDeLista(props) {
  return <ElegirDeListaBase etiqueta={etiqueta} {...props} />;
}

function ElegirPersona({ valor, onChange }) {
  return <ElegirDeLista opciones={CONTROLADORES_ORDENES_COMPRA} valor={valor} onChange={onChange} otro="Otra persona" />;
}

// Un día guardado como texto "dd/mm/aaaa", como en la planilla. Si lo
// cargado no es una fecha sola ("19/12/2025 y 9-1-26 a contab."), se
// muestra tal cual hasta que se elija un día. `extras`: botones como
// "No lleva".
function ElegirDiaTexto({ valor, onChange, extras = [] }) {
  const t = String(valor || "").trim();
  const { fecha: dia, quien: resto } = fechaYQuien(t);
  const extra = extras.find(x => x.valor.toUpperCase() === t.toUpperCase());
  const soloFecha = !!dia && !resto;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <ElegirDia valor={soloFecha ? dia : ""} onChange={v => onChange(v ? aTextoFecha(v) : "")} />
        {extras.map(x => <BotonOpcion key={x.valor} elegido={extra === x} onClick={() => onChange(x.valor)}>{x.etiqueta}</BotonOpcion>)}
      </div>
      {t && !soloFecha && !extra && (
        <p className="text-sm text-amber-800">
          Está anotado: «{t}». Si elegís un día, se reemplaza.{" "}
          <button type="button" onClick={() => onChange("")} className="underline">Borrar</button>
        </p>
      )}
    </div>
  );
}

// Ampliación o prórroga de otra OC: primero qué es, después de cuál.
function ElegirAmpliacion({ f, set }) {
  const [tipo, setTipo] = useState(f.ampliacionOC ? "ampliacionOC" : f.prorrogaOC ? "prorrogaOC" : "");
  function elegir(t) {
    setTipo(t);
    for (const k of ["ampliacionOC", "prorrogaOC"]) if (k !== t && f[k]) set(k, "");
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <BotonOpcion elegido={!tipo} onClick={() => elegir("")}>No</BotonOpcion>
        <BotonOpcion elegido={tipo === "ampliacionOC"} onClick={() => elegir("ampliacionOC")}>Sí, es una ampliación</BotonOpcion>
        <BotonOpcion elegido={tipo === "prorrogaOC"} onClick={() => elegir("prorrogaOC")}>Sí, es una prórroga</BotonOpcion>
      </div>
      {tipo && (
        <div className="max-w-xs">
          <p className="text-sm text-slate-600 mb-1">¿De qué orden de compra?</p>
          <Entrada valor={f[tipo]} onChange={v => set(tipo, v)} ejemplo="53/26" autoFocus />
        </div>
      )}
    </div>
  );
}

// Vencimientos del art. 44 y de la OC: se calculan solos (con la fecha de
// la resolución); se pueden corregir a mano.
function Vencimientos({ f, set, aviso, onRecalcular }) {
  const [corregir, setCorregir] = useState(false);
  const noLleva = /^NO\b/i.test(String(f.vtoArt44 || "").trim());
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
      <div>
        <p className="text-sm text-slate-700 mb-1.5">¿Lleva art. 44?</p>
        <SiNo valor={!noLleva} si="Sí" no="No lleva"
          onChange={v => { set("vtoArt44", v ? "" : "NO LLEVA"); if (v) onRecalcular({ ...f, vtoArt44: "" }); }} />
      </div>
      {!noLleva && (
        <>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <p className="text-sm text-slate-600">Vence el art. 44</p>
              {corregir ? <ElegirDiaTexto valor={f.vtoArt44} onChange={v => set("vtoArt44", v)} />
                : <p className="text-lg font-semibold text-slate-900">{f.vtoArt44 || "Falta la fecha de la resolución"}</p>}
            </div>
            <div>
              <p className="text-sm text-slate-600">Vence la orden de compra</p>
              {corregir ? <ElegirDia valor={f.vencimientoOC} onChange={v => set("vencimientoOC", v)} />
                : <p className="text-lg font-semibold text-slate-900">{f.vencimientoOC ? fecha(f.vencimientoOC) : "Falta la fecha de la resolución"}</p>}
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {aviso || "Se calculan solos, en días hábiles, al poner la fecha de la resolución."}{" "}
            <button type="button" onClick={() => setCorregir(!corregir)} className="underline text-slate-700">{corregir ? "Listo" : "Corregir a mano"}</button>
          </p>
        </>
      )}
    </div>
  );
}

// CBU: cargado, pedido (con la fecha de hoy) o no.
function ElegirCBU({ valor, onChange }) {
  const t = String(valor || "").trim();
  const estado = cbuCargado({ cbu: t }) ? "si" : /PEDI/i.test(t) ? "pedido" : "no";
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        <BotonOpcion elegido={estado === "si"} onClick={() => onChange("OK")}>Sí, está cargado</BotonOpcion>
        <BotonOpcion elegido={estado === "pedido"} onClick={() => estado !== "pedido" && onChange("PEDIDO " + aTextoFecha(hoyLocalISO()))}>Se pidió</BotonOpcion>
        <BotonOpcion elegido={estado === "no"} onClick={() => onChange("")}>No</BotonOpcion>
      </div>
      {estado === "pedido" && <p className="text-sm text-slate-500">Anotado: «{t}»</p>}
    </div>
  );
}

// Pasos del circuito hechos y por hacer.
function AvanceCircuito({ f }) {
  const { hechos } = avanceOC(f);
  return (
    <div className="flex flex-wrap gap-1.5">
      {PASOS_ORDEN_COMPRA.map((p, i) => (
        <span key={p.campo} className={"inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border " +
          (i < hechos ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-500")}>
          {i < hechos ? <Check size={12} /> : <span className="w-3 text-center">{i + 1}</span>} {p.etiqueta}
        </span>
      ))}
    </div>
  );
}

// Lo que se ve de cada paso cuando está cerrado.
function resumenPaso(n, f) {
  const partes = {
    1: [f.exp, f.numeroResol && "Resol. " + f.numeroResol, f.fechaResol && fecha(f.fechaResol)],
    2: [f.objeto, f.organismo, f.tipo && etiqueta(f.tipo)],
    3: [f.numeroOC && "OC " + f.numeroOC, f.proveedor, f.agente && "Agente: " + f.agente],
    4: [avanceOC(f).hechos + " de " + PASOS_ORDEN_COMPRA.length + " pasos hechos", f.estado && etiqueta(f.estado.toUpperCase())],
  }[n];
  return partes.filter(Boolean).join(" · ");
}

function Tarjeta({ titulo, resumen, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
      <h4 className="text-base font-semibold text-slate-900">{titulo}</h4>
      {children}
      <p className={"text-sm rounded-lg px-3 py-2 " + (resumen.listo ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-white text-slate-500 border border-slate-200")}>
        {resumen.texto}
      </p>
    </div>
  );
}

function TarjetaControl({ f, onCambio }) {
  const quien = f.controladaPor, dia = f.controladaFecha;
  const texto = quien && dia ? "Controlada por " + quien + " el " + fecha(dia) + "."
    : quien ? "Falta elegir el día en que la controló." : dia ? "Falta elegir quién la controló." : "Todavía no se controló.";
  return (
    <Tarjeta titulo="1. Control de la orden de compra" resumen={{ listo: !!(quien && dia), texto }}>
      <div><Pregunta>¿Quién la controló?</Pregunta><ElegirPersona valor={quien} onChange={v => onCambio({ controladaPor: v })} /></div>
      <div><Pregunta>¿Qué día la controló?</Pregunta><ElegirDia valor={dia} onChange={v => onCambio({ controladaFecha: v })} /></div>
    </Tarjeta>
  );
}

function TarjetaFirma({ f, onCambio }) {
  const dia = f.firmaFecha, otra = !!f.firmaOtra, quien = f.firmaPor;
  const texto = !dia ? "Todavía no pasó a la firma."
    : !otra ? "La firmó Sol el " + fecha(dia) + "."
    : quien ? "La firmó " + quien + " (en lugar de Sol) el " + fecha(dia) + "." : "Falta elegir quién la firmó.";
  return (
    <Tarjeta titulo="2. Firma" resumen={{ listo: !!dia && (!otra || !!quien), texto }}>
      <div><Pregunta>¿Qué día pasó a la firma?</Pregunta><ElegirDia valor={dia} onChange={v => onCambio({ firmaFecha: v })} /></div>
      <div>
        <Pregunta>¿La firmó Sol?</Pregunta>
        <div className="flex flex-wrap gap-2">
          <BotonOpcion elegido={!otra} onClick={() => onCambio({ firmaOtra: false, firmaPor: "" })}>Sí, la firmó Sol</BotonOpcion>
          <BotonOpcion elegido={otra} onClick={() => onCambio({ firmaOtra: true })}>No, Sol no estaba</BotonOpcion>
        </div>
      </div>
      {otra && <div><Pregunta>¿Quién la firmó?</Pregunta><ElegirPersona valor={quien} onChange={v => onCambio({ firmaPor: v })} /></div>}
    </Tarjeta>
  );
}

// Control o firma en la tabla: la fecha y, debajo, quién (en la firma, solo
// si no fue Sol). Lo que no tiene fecha se ve como está en la planilla.
function FechaYQuien({ e, k }) {
  if (!e[k]) return "-";
  const { fecha: dia, quien } = fechaYQuien(e[k], anioDe({ ingresoOC: fechaISO(e.ingresoOC) }));
  if (!dia) return <span className="line-clamp-2" title={e[k]}>{e[k]}</span>;
  const mostrar = k === "firmaSol" ? (firmoOtra(quien) ? "Firmó " + quien : "") : quien;
  return (
    <span title={e[k]}>
      <span className="whitespace-nowrap">{fecha(dia)}</span>
      {mostrar && <span className="block text-[11px] text-slate-500 line-clamp-1">{mostrar}</span>}
    </span>
  );
}

// CBU: tilde si está cargado, cruz si no (el texto de la planilla, al pasar
// el mouse).
function IconoCBU({ e }) {
  const ok = cbuCargado(e);
  return (
    <span title={e.cbu || "Sin cargar"} aria-label={ok ? "CBU cargado" : "CBU sin cargar"}>
      {ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-500" />}
    </span>
  );
}

// Chip del vencimiento de la OC: vencida, por vencer o en plazo.
function Vencimiento({ e }) {
  const d = diasParaVencerOC(e);
  if (!e.vencimientoOC) return <span className="text-slate-400">-</span>;
  const estilo = d == null ? "" : d < 0 ? ALERTA_ESTILO.rojo : porVencerOC(e) ? ALERTA_ESTILO.amarillo : "";
  return (
    <span className="whitespace-nowrap">
      {fecha(e.vencimientoOC)}
      {d != null && (d < 0 || porVencerOC(e)) && (
        <span className={"ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border " + estilo}>
          {d < 0 ? "vencida hace " + -d + " d" : d === 0 ? "vence hoy" : "en " + d + " d"}
        </span>
      )}
    </span>
  );
}

// Alta / edición de una orden de compra, en dos solapas: los datos y el
// circuito (con el historial). Al editar, la jefa ve todo como ficha:
// solo cambia agente y prioridad.
export function FormularioOrdenCompra({ inicial, numeroNuevo, esJefa, onCerrar, onGuardar, onEliminar }) {
  const [f, setF] = useState(() => aFormulario(inicial, numeroNuevo));
  const [solapa, setSolapa] = useState("datos");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [versionAlAbrir] = useState(inicial?.actualizadoEn);
  const cambioMientrasEditaba = !!inicial && inicial.actualizadoEn !== versionAlAbrir;
  const fijo = esJefa && !!inicial;
  const [avisoVencimientos, setAvisoVencimientos] = useState("");
  // Pasos abiertos: en una orden nueva, el primero; en una cargada, el
  // seguimiento (y la jefa, también la orden, donde asigna).
  const pasos = usePasos(!inicial ? { 1: true } : fijo ? { 3: true, 4: true } : { 4: true }, n => resumenPaso(n, f));
  const paso = pasos.paso;

  function set(campo, valor) {
    setF(prev => ({ ...prev, [campo]: valor }));
    setError("");
    if (campo === "fechaResol" || campo === "notificacion44") recalcularVencimientos({ ...f, [campo]: valor });
  }

  // Cambia una parte del control o de la firma y arma el texto que se
  // guarda: "dd/mm/aaaa QUIÉN" (la firma de Sol, solo la fecha).
  function setControlYFirma(cambios) {
    setF(prev => {
      const n = { ...prev, ...cambios };
      if ("controladaFecha" in cambios || "controladaPor" in cambios) n.controlada = textoFechaYQuien(n.controladaFecha, n.controladaPor);
      if ("firmaFecha" in cambios || "firmaOtra" in cambios || "firmaPor" in cambios) {
        n.firmaSol = textoFechaYQuien(n.firmaFecha, n.firmaOtra ? n.firmaPor : "");
      }
      return n;
    });
    setError("");
  }

  // Al cambiar la fecha de la resolución o la de notificación del art. 44,
  // los vencimientos se calculan solos en días hábiles (se pueden
  // corregir a mano). Si no lleva art. 44, no se tocan.
  async function recalcularVencimientos(nuevo) {
    const publicacion = nuevo.fechaResol;
    const notificacion = deTextoFecha(nuevo.notificacion44);
    if (!esFechaISO(publicacion) || /^NO\b/i.test(String(nuevo.vtoArt44 || "").trim())) return;
    setAvisoVencimientos("Calculando vencimientos...");
    try {
      const res = await fetch("/api/ordenes-compra/vencimientos?publicacion=" + publicacion + (notificacion ? "&notificacion44=" + notificacion : ""));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      // Si mientras tanto cambiaron las fechas, este cálculo ya no vale.
      setF(prev => (prev.fechaResol === publicacion && deTextoFecha(prev.notificacion44) === notificacion
        ? { ...prev, vtoArt44: aTextoFecha(data.fechaArt44), vencimientoOC: data.fechaLimiteOC }
        : prev));
      setAvisoVencimientos("Vencimientos calculados en días hábiles" + (notificacion ? " (la OC, desde la notificación del art. 44)" : "") + ".");
    } catch (err) {
      setAvisoVencimientos("No se pudieron calcular los vencimientos" + (err.message ? ": " + err.message : "") + ". Cargalos a mano.");
    }
  }

  async function guardar() {
    if (!f.exp.trim() || !f.objeto.trim()) { setError("Completá N° de expediente y objeto."); setSolapa("datos"); pasos.abrir(1, 2); return; }
    setGuardando(true);
    // Sin observación nueva, queda la última que tenía.
    // Sin ajuste, el total para la O/C es el mismo monto de la resolución.
    const res = await onGuardar({
      ...f,
      montoAjustado: f.seAjusta ? f.montoAjustado : f.montoResolucion,
      observaciones: f.observaciones.trim() || inicial?.observaciones || "",
    });
    setGuardando(false);
    if (res?.error) setError(res.error);
  }

  async function eliminar() {
    setGuardando(true);
    await onEliminar();
    setGuardando(false);
  }

  const historial = [...(inicial?.movimientos || [])].reverse();
  const dias = inicial ? diasEnOC(inicial) : null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[min(92vh,860px)] flex flex-col overflow-hidden">
        <div className="px-6 pt-4 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900">
                {inicial ? <>Orden de compra {inicial.numeroOC ? "N° " + inicial.numeroOC : ""} · <span className="font-mono">{inicial.exp}</span></> : "Nueva orden de compra"}
              </h2>
              {inicial && <p className="text-xs text-slate-500 truncate" title={inicial.objeto}>{[inicial.proveedor, inicial.objeto, inicial.organismo].filter(Boolean).join(" · ")}</p>}
              {inicial && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <EtiquetasPrioridad expediente={inicial} />
                  {[avanceOC(inicial).etapa, inicial.tipo, inicial.pase && "Pase: " + inicial.pase].filter(Boolean).map(t => (
                    <span key={t} className="mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700">{t}</span>
                  ))}
                  {dias != null && (
                    <span className={"mt-1 text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} día{dias !== 1 ? "s" : ""} en OC</span>
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
              { id: "datos", etiqueta: "Datos de la orden" },
              { id: "circuito", etiqueta: "Observaciones e historial" + (inicial ? " (" + historial.length + ")" : "") },
            ].map(t => (
              <button key={t.id} type="button" onClick={() => setSolapa(t.id)}
                className={"px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors " +
                  (solapa === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
                {t.etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {cambioMientrasEditaba && (
            <div className="border border-amber-300 bg-amber-50 rounded-md p-3 text-sm text-amber-900">
              Esta orden cambió mientras la tenías abierta (la modificó otra persona). Cerrá sin guardar y volvé a abrirla para ver los cambios; si guardás ahora, se pisan con lo que tenés en pantalla.
            </div>
          )}
          {confirmarEliminar && (
            <div className="border border-red-200 bg-red-50 rounded-md p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-800">Esta orden de compra y su historial se borrarán definitivamente.</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setConfirmarEliminar(false)} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium">Cancelar</button>
                <BotonAccion onClick={eliminar} cargando={guardando} cargandoTexto="Eliminando..."
                  className="px-3 py-1.5 rounded-md bg-red-700 text-white text-xs font-medium hover:bg-red-800">
                  Eliminar definitivamente
                </BotonAccion>
              </div>
            </div>
          )}

          {solapa === "datos" && <AbrirTodos pasos={pasos} total={4} />}
          {solapa === "datos" && fijo ? (
            // La jefa ve la ficha: solo cambia agente y prioridad.
            <>
              <Paso {...paso(1)} titulo="La resolución">
                <DatoFicha label="N° de expediente" valor={f.exp} mono />
                <DatoFicha label="N° de resolución" valor={f.numeroResol} />
                <DatoFicha label="Fecha de la resolución" valor={fecha(f.fechaResol)} />
                <DatoFicha label="Autoriza" valor={f.autoriza} />
                {(f.ampliacionOC || f.prorrogaOC) && <DatoFicha label={f.ampliacionOC ? "Ampliación de la OC" : "Prórroga de la OC"} valor={f.ampliacionOC || f.prorrogaOC} />}
                <DatoFicha label="Vence el art. 44" valor={f.vtoArt44} />
                <DatoFicha label="Vence la OC" valor={fecha(f.vencimientoOC)} />
              </Paso>
              <Paso {...paso(2)} titulo="Qué se contrata">
                <DatoFicha label="Organismo" valor={f.organismo} />
                <DatoFicha label="Objeto" valor={f.objeto} />
                <DatoFicha label="Provisión o servicio" valor={f.tipo} />
                <DatoFicha label="Plazo de ejecución" valor={f.plazoEjecucion} />
                {f.inicioServicio && <DatoFicha label="Inicio del servicio" valor={f.inicioServicio} />}
              </Paso>
              <Paso {...paso(3)} titulo="La orden de compra">
                <DatoFicha label="N° de OC" valor={f.numeroOC} />
                <DatoFicha label="Proveedor" valor={f.proveedor} />
                <DatoFicha label="Monto de la resolución" valor={f.montoResolucion} />
                <DatoFicha label="Monto para la OC" valor={(f.seAjusta ? f.montoAjustado : f.montoResolucion) || "-"} />
                <DatoFicha label="Ingresó a OC" valor={fecha(f.ingresoOC)} />
                <Campo pregunta="¿A quién se le asigna?">
                  <ElegirDeLista opciones={AGENTES_ORDENES_COMPRA} valor={f.agente} onChange={v => set("agente", v)} vacio="Sin asignar" />
                </Campo>
                <Campo pregunta="¿Es prioritaria?">
                  <SiNo valor={!!f.prioritario} onChange={v => set("prioritario", v)} si="Sí, prioritaria" no="No" />
                </Campo>
              </Paso>
              <Paso {...paso(4)} titulo="Seguimiento · lo carga Órdenes de Compra" avance={<AvanceCircuito f={f} />}>
                <DatoFicha label="Notificación del art. 44" valor={f.notificacion44} />
                <DatoFicha label="CBU" valor={cbuCargado(f) ? "Cargado" : f.cbu || "No cargado"} />
                <DatoFicha label="Contabilidad" valor={f.contabilidad} />
                <DatoFicha label="Controlada" valor={f.controladaFecha ? fecha(f.controladaFecha) + (f.controladaPor ? " · " + f.controladaPor : "") : f.controlada} />
                <DatoFicha label="Firma" valor={f.firmaFecha ? fecha(f.firmaFecha) + " · " + (f.firmaOtra ? f.firmaPor || "otra persona" : "Sol") : f.firmaSol} />
                <DatoFicha label="OC notificada" valor={f.notificada} />
                <DatoFicha label="Pase" valor={f.pase} />
                <DatoFicha label="Estado" valor={f.estado} />
                {f.informe && <DatoFicha label="Informe" valor={f.informe} />}
                {f.fechaPublicacion && <DatoFicha label="Fecha de publicación" valor={f.fechaPublicacion} />}
              </Paso>
            </>
          ) : solapa === "datos" ? (
            <>
              <p className="text-sm text-slate-600">Completá lo que sepas; lo demás se puede cargar después. Lo único obligatorio es el <b>N° de expediente</b> y el <b>objeto</b>. Tocá cada paso para abrirlo.</p>

              <Paso {...paso(1)} titulo="La resolución">
                <Campo pregunta="N° de expediente (obligatorio)">
                  <Entrada valor={f.exp} onChange={v => set("exp", v)} ejemplo="13-05999/25" mono />
                </Campo>
                <Campo pregunta="N° de resolución">
                  <Entrada valor={f.numeroResol} onChange={v => set("numeroResol", v)} ejemplo="4369/25" />
                </Campo>
                <Campo pregunta="¿Qué día salió la resolución?" ayuda="Con esta fecha se calculan solos los vencimientos.">
                  <ElegirDia valor={f.fechaResol} onChange={v => set("fechaResol", v)} />
                </Campo>
                <Campo pregunta="¿Quién autoriza?" ayuda="Casi siempre es AG.">
                  <Entrada valor={f.autoriza} onChange={v => set("autoriza", v)} ejemplo="AG" />
                </Campo>
                <Campo pregunta="¿Es una ampliación o una prórroga de otra orden de compra?" ancho>
                  <ElegirAmpliacion f={f} set={set} />
                </Campo>
                <Campo pregunta="Vencimientos" ancho>
                  <Vencimientos f={f} set={set} aviso={avisoVencimientos} onRecalcular={recalcularVencimientos} />
                </Campo>
              </Paso>

              <Paso {...paso(2)} titulo="Qué se contrata">
                <Campo pregunta="Organismo" ancho>
                  <Entrada valor={f.organismo} onChange={v => set("organismo", v)} ejemplo="CAMARA FEDERAL DE SAN MARTIN" />
                </Campo>
                <Campo pregunta="¿Qué se contrata? (objeto, obligatorio)" ancho>
                  <Entrada valor={f.objeto} onChange={v => set("objeto", v)} ejemplo="LIMPIEZA o MANT. AIRE ACONDICIONADO" />
                </Campo>
                <Campo pregunta="¿Es una provisión o un servicio?">
                  <ElegirDeLista opciones={TIPOS_ORDEN_COMPRA} valor={f.tipo} onChange={v => set("tipo", v)} />
                </Campo>
                <Campo pregunta="Plazo de ejecución">
                  <Entrada valor={f.plazoEjecucion} onChange={v => set("plazoEjecucion", v)} ejemplo="30 DH o MARZO X 12 MESES" />
                </Campo>
                {(/SERVICIO/i.test(f.tipo) || f.inicioServicio) && (
                  <Campo pregunta="¿Cuándo empieza el servicio?">
                    <Entrada valor={f.inicioServicio} onChange={v => set("inicioServicio", v)} ejemplo="1/4/26 X 12 MESES" />
                  </Campo>
                )}
              </Paso>

              <Paso {...paso(3)} titulo="La orden de compra">
                <Campo pregunta="N° de orden de compra" ayuda={inicial ? "" : "Ya viene puesto el que sigue al último cargado."}>
                  <Entrada valor={f.numeroOC} onChange={v => set("numeroOC", v)} ejemplo="146" />
                </Campo>
                <Campo pregunta="Proveedor">
                  <Entrada valor={f.proveedor} onChange={v => set("proveedor", v)} ejemplo="LIMPRO SAS" />
                </Campo>
                <Campo pregunta="Monto de la resolución">
                  <Entrada valor={f.montoResolucion} onChange={v => set("montoResolucion", v)} ejemplo="$ 49.355.142,75" />
                </Campo>
                <Campo pregunta="¿El monto cambió para la orden de compra?">
                  <SiNo valor={!!f.seAjusta} si="Sí, se ajustó" no="No, es el mismo"
                    onChange={v => setF(prev => ({ ...prev, seAjusta: v, montoAjustado: v ? prev.montoAjustado : "" }))} />
                  {f.seAjusta && <div className="mt-2"><Entrada valor={f.montoAjustado} onChange={v => set("montoAjustado", v)} ejemplo="$ 51.000.000,00" /></div>}
                </Campo>
                <Campo pregunta="¿Qué día ingresó a Órdenes de Compra?">
                  {inicial ? <ElegirDia valor={f.ingresoOC} onChange={v => set("ingresoOC", v)} />
                    : <p className="text-base text-slate-800 py-2">Hoy, {fecha(f.ingresoOC)} <span className="text-sm text-slate-500">(se pone solo)</span></p>}
                </Campo>
                <Campo pregunta="Agente asignado">
                  {esJefa ? <ElegirDeLista opciones={AGENTES_ORDENES_COMPRA} valor={f.agente} onChange={v => set("agente", v)} vacio="Sin asignar" />
                    : <p className="text-base text-slate-800 py-2">{f.agente || "Sin asignar"} <span className="text-sm text-slate-500">(lo asigna la jefa)</span></p>}
                </Campo>
                {esJefa && (
                  <Campo pregunta="¿Es prioritaria?">
                    <SiNo valor={!!f.prioritario} onChange={v => set("prioritario", v)} si="Sí, prioritaria" no="No" />
                  </Campo>
                )}
              </Paso>

              <Paso {...paso(4)} titulo="Seguimiento" avance={<AvanceCircuito f={f} />}>
                <Campo pregunta="¿Qué día se notificó el art. 44?" ancho>
                  <ElegirDiaTexto valor={f.notificacion44} onChange={v => set("notificacion44", v)} extras={[{ etiqueta: "No lleva", valor: "NO LLEVA" }]} />
                </Campo>
                <Campo pregunta="¿Está cargado el CBU?" ancho>
                  <ElegirCBU valor={f.cbu} onChange={v => set("cbu", v)} />
                </Campo>
                <Campo pregunta="¿Qué día fue a Contabilidad?" ancho>
                  <ElegirDiaTexto valor={f.contabilidad} onChange={v => set("contabilidad", v)} />
                </Campo>
                <div className="md:col-span-2 grid lg:grid-cols-2 gap-4">
                  <TarjetaControl f={f} onCambio={setControlYFirma} />
                  <TarjetaFirma f={f} onCambio={setControlYFirma} />
                </div>
                <Campo pregunta="¿Qué día se notificó la orden de compra?" ancho>
                  <ElegirDiaTexto valor={f.notificada} onChange={v => set("notificada", v)} />
                </Campo>
                <Campo pregunta="¿A dónde pasó el expediente?" ancho>
                  <ElegirDeLista opciones={PASES_ORDEN_COMPRA} valor={f.pase} onChange={v => set("pase", v)} otro="Otro lugar" vacio="Todavía no" />
                </Campo>
                <Campo pregunta="¿Cómo está la orden?" ancho>
                  <ElegirDeLista opciones={ESTADOS_ORDEN_COMPRA} valor={f.estado} onChange={v => set("estado", v)} otro="Otro" />
                </Campo>
                <Campo pregunta="Fecha de publicación" ancho>
                  <ElegirDiaTexto valor={f.fechaPublicacion} onChange={v => set("fechaPublicacion", v)} />
                </Campo>
                <Campo pregunta="Informe (si hace falta)" ayuda="Al guardar, lo que escribas queda anotado en Observaciones e historial." ancho>
                  <textarea value={f.informe || ""} onChange={e => set("informe", e.target.value)} rows={2} className={CLASE_ENTRADA + " resize-y"} />
                </Campo>
              </Paso>
            </>
          ) : (
            <>
              <section className="space-y-2">
                <Pregunta>{inicial ? "¿Querés dejar una observación?" : "Observaciones"}</Pregunta>
                <textarea value={f.observaciones} onChange={e => set("observaciones", e.target.value)} rows={4}
                  placeholder="Escribí acá. Al guardar, queda anotada con la fecha y tu nombre."
                  className={CLASE_ENTRADA + " resize-y"} />
              </section>

              {inicial && (
                <section className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-900">Lo que pasó con esta orden ({historial.length})</h3>
                  {historial.length === 0 ? (
                    <p className="text-sm text-slate-500">Todavía no hay nada anotado.</p>
                  ) : (
                    <ol className="relative border-l border-slate-200 ml-1.5 space-y-4">
                      {historial.map(m => {
                        // Observaciones e informes se leen como texto, no como "antes → después".
                        const esObs = m.campo === "Observaciones" || m.campo === "Informe";
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
          {error && <p className="mr-auto text-sm font-medium text-red-700">{error}</p>}
          <button onClick={onCerrar} disabled={guardando} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50">
            {fijo ? "Cerrar" : "Cancelar sin guardar"}
          </button>
          <BotonAccion onClick={guardar} cargando={guardando}
            className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
            {inicial ? "Guardar cambios" : "Guardar la orden de compra"}
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}

// Cuántas órdenes en trámite tiene cada agente. Tocar uno filtra.
function ResumenAgentes({ lista, onElegir }) {
  const enTramite = lista.filter(e => !esCompleta(e));
  const agentes = [...new Set([...AGENTES_ORDENES_COMPRA, ...enTramite.map(e => e.agente).filter(Boolean)])];
  const cuenta = a => enTramite.filter(e => e.agente === a).length;
  const sinAsignar = enTramite.filter(e => !String(e.agente || "").trim()).length;
  const vencidas = enTramite.filter(e => (diasParaVencerOC(e) ?? 0) < 0).length;
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Users size={15} className="text-slate-400" />
        <span>En trámite:</span>
        <span className="font-semibold text-slate-900 tabular-nums">{enTramite.length}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {agentes.map(a => (
          <button key={a} type="button" onClick={() => onElegir(a)} title={"Ver las de " + a}
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
      {vencidas > 0 && (
        <span className="ml-auto text-[11px] font-medium px-2 py-1 rounded-md border border-red-200 bg-red-50 text-red-700">
          {vencidas} vencida{vencidas !== 1 ? "s" : ""} sin completar
        </span>
      )}
    </div>
  );
}

// Solapas del panel: qué órdenes muestra cada una (el Inicio de la jefa
// cuenta con las mismas) y, si no es el de siempre, en qué orden.
export const SOLAPAS = [
  { id: "general", etiqueta: "General", incluye: () => true, orden: compararPorNumeroOC },
  { id: "escritorio", etiqueta: "En trámite", incluye: e => !esCompleta(e) },
  { id: "porVencer", etiqueta: "Vencidas y por vencer", incluye: porVencerOC },
  { id: "prioritarios", etiqueta: "Prioritarias", incluye: e => !esCompleta(e) && esPrioritariaOC(e) },
  { id: "completas", etiqueta: "Completas", incluye: esCompleta },
  // Para que la jefa de la Subdirección asigne lo pendiente.
  { id: "sinAsignar", etiqueta: "Sin asignar", incluye: e => !esCompleta(e) && !String(e.agente || "").trim(), soloJefa: true },
];

function exportarExcel(filas, solapa) {
  const datos = [
    ["EXP", "AMPLIACION OC", "PRORROGA O/C N°", "AGENTE", "FECHA RESOL", "INGRESO A OC", "VTO. ART 44", "VENCIMIENTO OC",
      "ORGANISMO", "OBJETO", "PLAZO DE EJECUCION", "PROV/SERVICIO", "AG", "N° RESOL", "OC", "PROVEEDOR", "MONTO POR RESOLUCION",
      "TOTAL CON ULTIMO AJUSTE PARA O/C", "FECHA 44/NOTIF.", "CBU", "INFORME", "CONTABILIDAD", "O/C CONTROLADA POR Y FECHA",
      "A LA FIRMA DE SOL FECHA", "FECHA DE O/C NOTIFICADA", "ITEM PENDIENTE", "PASE", "ESTADO", "INICIO SERVICIO",
      "OBSERVACIONES", "FECHA DE PUBLICACION", "ETAPA", "DIAS EN OC", "PRIORITARIA"],
    ...filas.map(e => [
      e.exp, e.ampliacionOC || "", e.prorrogaOC || "", e.agente || "", e.fechaResol ? fecha(e.fechaResol) : "", e.ingresoOC ? fecha(e.ingresoOC) : "",
      e.vtoArt44 || "", e.vencimientoOC ? fecha(e.vencimientoOC) : "", e.organismo || "", e.objeto, e.plazoEjecucion || "", e.tipo || "",
      e.autoriza || "", e.numeroResol || "", e.numeroOC || "", e.proveedor || "", e.montoResolucion || "", e.montoAjustado || "",
      e.notificacion44 || "", e.cbu || "", e.informe || "", e.contabilidad || "", e.controlada || "", e.firmaSol || "", e.notificada || "",
      e.itemPendiente || "", e.pase || "", e.estado || "", e.inicioServicio || "", e.observaciones || "", e.fechaPublicacion || "",
      avanceOC(e).etapa, diasEnOC(e) ?? "", e.enPlanObras ? "SI (PLAN DE OBRAS)" : e.prioritario ? "SI" : "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ordenes de compra");
  XLSX.writeFile(wb, "ordenes-compra-" + (solapa === "general" ? "" : solapa + "-") + hoyLocalISO() + ".xlsx");
}

// Sistema del Departamento de Órdenes de Compra: sus dos planillas, las
// órdenes de compra y los expedientes que solo llevan la notificación del
// art. 44. La jefa de la Subdirección también lo usa. Las dos quedan
// montadas para no perder filtros ni página al cambiar.
export default function PanelOrdenesCompra(props) {
  const [hoja, setHoja] = useState("ordenes");
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
        {[["ordenes", "Órdenes de compra"], ["notificaciones", "Notificaciones art. 44 (sin OC)"]].map(([id, etiqueta]) => (
          <button key={id} type="button" onClick={() => setHoja(id)}
            className={"px-3 py-1.5 rounded-md text-xs font-medium transition-colors " + (hoja === id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>
            {etiqueta}
          </button>
        ))}
      </div>
      <div className={hoja === "ordenes" ? "" : "hidden"}><PanelOrdenes {...props} /></div>
      <div className={hoja === "notificaciones" ? "" : "hidden"}><PanelNotificaciones44 sesion={props.sesion} mostrarToast={props.mostrarToast} /></div>
    </div>
  );
}

// La planilla de seguimiento de las órdenes de compra.
function PanelOrdenes({ sesion, mostrarToast, solapaInicial }) {
  // La jefa de la Subdirección asigna agentes y marca prioridades.
  const esJefa = sesion.email === EMAIL_JEFA_SUBDIRECCION;
  const [ordenes, setOrdenes] = useState(null);
  const [f, setF] = useState(filtroVacio);
  const [solapa, setSolapa] = useState(solapaInicial || "general");
  const [form, setForm] = useState(null); // null | "nuevo" | id de la orden
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(OPCIONES_POR_PAGINA[0]);
  // Cambiar un filtro o la solapa vuelve a la primera página.
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); setPagina(0); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/ordenes-compra");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (activo) setOrdenes(data.expedientes || []);
      } catch (err) {
        if (activo) { setOrdenes([]); mostrarToast(err.message || "No se pudieron cargar las órdenes de compra"); }
      }
    })();
    return () => { activo = false; };
    // Solo al montar: mostrarToast del Dashboard cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = ordenes || [];
  const opciones = useMemo(() => {
    const de = (valores, base) => [...new Set([...base, ...valores.filter(Boolean)])].sort((a, b) => a.localeCompare(b));
    return {
      tipo: de(lista.map(e => e.tipo), TIPOS_ORDEN_COMPRA),
      agente: de(lista.map(e => e.agente), AGENTES_ORDENES_COMPRA),
    };
  }, [lista]);

  const solapas = SOLAPAS.filter(s => !s.soloJefa || esJefa);
  const deSolapa = SOLAPAS.find(s => s.id === solapa);
  const deLaSolapa = useMemo(() => lista.filter(deSolapa.incluye), [lista, deSolapa]);
  const filas = useMemo(() => deLaSolapa.filter(e => {
    if (f.exp && !norm(e.exp + " " + (e.numeroOC || "")).includes(norm(f.exp))) return false;
    if (f.texto && !norm([e.objeto, e.organismo, e.proveedor, e.observaciones].join(" ")).includes(norm(f.texto))) return false;
    if (f.tipo && e.tipo !== f.tipo) return false;
    if (f.agente && e.agente !== f.agente) return false;
    return true;
  }).sort(deSolapa.orden || compararOrdenesCompra), [deLaSolapa, deSolapa, f]);

  const totalPaginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const filasPagina = filas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);

  const seleccionada = form && form !== "nuevo" ? lista.find(e => e.id === form) : null;

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
      ? await enviar("/api/ordenes-compra/" + seleccionada.id, "PUT", datos)
      : await enviar("/api/ordenes-compra", "POST", datos);
    if (data.error) return data;
    setOrdenes(prev => seleccionada ? prev.map(e => (e.id === data.expediente.id ? data.expediente : e)) : [...prev, data.expediente]);
    setForm(null);
    // Un informe nuevo queda en el historial: se avisa.
    const informeNuevo = String(datos.informe || "").trim() && String(datos.informe || "").trim() !== String(seleccionada?.informe || "").trim();
    mostrarToast(informeNuevo ? "Se cargó lo informado en el historial y el circuito"
      : seleccionada ? "Orden de compra actualizada" : "Orden de compra cargada");
  }

  // Cambio rápido desde la tabla: estado o pase (el departamento),
  // asignación o prioridad (la jefa). Se muestra al instante; si el
  // servidor lo rechaza, se vuelve atrás.
  async function cambiarRapido(e, cambios) {
    const anteriores = Object.fromEntries(Object.keys(cambios).map(k => [k, e[k]]));
    setOrdenes(prev => prev.map(x => (x.id === e.id ? { ...x, ...cambios } : x)));
    const data = await enviar("/api/ordenes-compra/" + e.id, "PATCH", cambios);
    if (data.error) {
      setOrdenes(prev => prev.map(x => (x.id === e.id ? { ...x, ...anteriores } : x)));
      mostrarToast(data.error);
      return;
    }
    setOrdenes(prev => prev.map(x => (x.id === data.expediente.id ? data.expediente : x)));
    const [campo, valor] = Object.entries(cambios)[0];
    const nombre = "OC " + (e.numeroOC || e.exp);
    mostrarToast(campo === "prioritario"
      ? (valor ? nombre + " marcada como prioritaria" : nombre + " ya no es prioritaria")
      : campo === "agente"
        ? nombre + " asignada a " + (valor || "nadie")
        : nombre + ": " + ETIQUETA_CAMPO[campo] + " → " + (valor || "sin definir"));
  }

  async function eliminar() {
    const data = await enviar("/api/ordenes-compra/" + seleccionada.id, "DELETE");
    if (data.error) { mostrarToast(data.error); return; }
    setOrdenes(prev => prev.filter(e => e.id !== seleccionada.id));
    setForm(null);
    mostrarToast("Orden de compra eliminada");
  }

  if (ordenes === null) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando órdenes de compra...</div>;
  }

  // Para la jefa, pase y estado son texto: la celda abre la ficha.
  const celdaRapida = esJefa ? undefined : ev => ev.stopPropagation();
  const txt = k => e => <span className="line-clamp-2" title={e[k] || ""}>{e[k] || "-"}</span>;
  // Columnas en el orden de la planilla del departamento. `filtro`: el
  // control de la segunda fila del encabezado.
  const columnas = [
    { titulo: "Exp.", ancho: "min-w-[150px]", fija: true,
      filtro: <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Exp. u OC" className={CLASE_INPUT} />,
      celda: e => <span className="font-mono font-semibold text-slate-900 max-w-[150px] whitespace-normal break-words" title={e.exp}>{e.exp}</span> },
    { titulo: "Ampliación OC", ancho: "min-w-[90px]", celda: txt("ampliacionOC") },
    { titulo: "Prórroga O/C N°", ancho: "min-w-[90px]", celda: txt("prorrogaOC") },
    { titulo: "Agente", ancho: "min-w-[100px]",
      filtro: <FiltroColumna valor={f.agente} etiqueta="Todos" opciones={opciones.agente} onChange={v => set("agente", v)} />,
      alTocar: esJefa ? ev => ev.stopPropagation() : undefined,
      celda: e => (esJefa ? (
        <select value={e.agente || ""} onChange={ev => cambiarRapido(e, { agente: ev.target.value })} title="Cambiar asignación"
          className="text-xs bg-white border border-slate-300 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-800">
          <option value="">Sin asignar</option>
          {[...new Set([...AGENTES_ORDENES_COMPRA, ...(e.agente ? [e.agente] : [])])].map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      ) : (e.agente || "-")) },
    { titulo: "Fecha resol.", ancho: "min-w-[90px] whitespace-nowrap", celda: e => fecha(e.fechaResol) },
    { titulo: "Ingreso a OC", ancho: "min-w-[100px] whitespace-nowrap", celda: e => {
      const dias = diasEnOC(e);
      return (
        <>
          {fecha(e.ingresoOC)}
          {dias != null && (
            <span className={"block w-fit mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded border " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} día{dias !== 1 ? "s" : ""} en OC</span>
          )}
        </>
      );
    } },
    { titulo: "Vto. art. 44", ancho: "min-w-[90px]", celda: txt("vtoArt44") },
    { titulo: "Vencimiento OC", ancho: "min-w-[110px]", celda: e => <Vencimiento e={e} /> },
    { titulo: "Organismo", ancho: "min-w-[180px] max-w-[220px]", celda: txt("organismo") },
    { titulo: "Objeto", ancho: "min-w-[220px] max-w-[280px]",
      filtro: <input value={f.texto} onChange={e => set("texto", e.target.value)} placeholder="Objeto, organismo, proveedor" className={CLASE_INPUT} />,
      celda: txt("objeto") },
    { titulo: "Plazo de ejecución", ancho: "min-w-[130px] max-w-[160px]", celda: txt("plazoEjecucion") },
    { titulo: "Prov./Servicio", ancho: "min-w-[110px]",
      filtro: <FiltroColumna valor={f.tipo} etiqueta="Todos" opciones={opciones.tipo} onChange={v => set("tipo", v)} />,
      celda: txt("tipo") },
    { titulo: "AG", ancho: "min-w-[50px]", celda: txt("autoriza") },
    { titulo: "N° resol.", ancho: "min-w-[80px] whitespace-nowrap", celda: txt("numeroResol") },
    { titulo: "OC", ancho: "min-w-[50px]", fondo: " bg-blue-950 text-white", celda: e => <span className="font-semibold tabular-nums">{e.numeroOC || "-"}</span> },
    { titulo: "Proveedor", ancho: "min-w-[170px] max-w-[220px]", celda: txt("proveedor") },
    { titulo: "Por resolución", grupo: "Monto", ancho: "min-w-[130px] whitespace-nowrap tabular-nums", celda: e => e.montoResolucion || "-" },
    { titulo: "Ajuste para O/C", grupo: "Monto", ancho: "min-w-[130px] whitespace-nowrap tabular-nums", celda: e => e.montoAjustado || e.montoResolucion || "-" },
    { titulo: "Fecha 44/notif.", ancho: "min-w-[100px]", celda: txt("notificacion44") },
    { titulo: "CBU", ancho: "min-w-[50px]", celda: e => <IconoCBU e={e} /> },
    { titulo: "Contabilidad", ancho: "min-w-[110px] max-w-[150px]", celda: txt("contabilidad") },
    { titulo: "O/C controlada por y fecha", ancho: "min-w-[120px] max-w-[170px]", celda: e => <FechaYQuien e={e} k="controlada" /> },
    { titulo: "A la firma de Sol (fecha)", ancho: "min-w-[120px] max-w-[170px]", celda: e => <FechaYQuien e={e} k="firmaSol" /> },
    { titulo: "Fecha de O/C notificada", ancho: "min-w-[110px]", celda: txt("notificada") },
    { titulo: "Pase", ancho: "min-w-[120px]", alTocar: celdaRapida,
      celda: e => (esJefa ? (e.pase || "-") : <SelectRapido valor={e.pase} opciones={PASES_ORDEN_COMPRA} onChange={v => cambiarRapido(e, { pase: v })} className="max-w-[170px]" />) },
    { titulo: "Estado", ancho: "min-w-[130px]", alTocar: celdaRapida,
      celda: e => (esJefa
        ? <span className={esCompleta(e) ? "font-medium text-emerald-700" : ""}>{e.estado || "-"}</span>
        : <SelectRapido valor={e.estado} opciones={ESTADOS_ORDEN_COMPRA} onChange={v => cambiarRapido(e, { estado: v })} fuerte className="max-w-[170px]" />) },
    { titulo: "Inicio servicio", ancho: "min-w-[120px] max-w-[160px]", celda: txt("inicioServicio") },
    { titulo: "Fecha de publicación", ancho: "min-w-[100px]", celda: txt("fechaPublicacion") },
  ];
  // La primera columna queda fija al desplazar la tabla a los costados.
  const fija = c => (c.fija ? " sticky left-0 z-10 bg-white group-hover:bg-slate-50 border-r border-slate-100" : "");
  const claseTh = c => fija(c).replace("group-hover:bg-slate-50", "").replace("bg-white", "bg-slate-50") + (c.fondo || "");
  // Columnas con `grupo` (Monto): un título común arriba y el suyo debajo.
  const enGrupo = c => columnas.filter(o => o.grupo === c.grupo).length;
  const abreGrupo = (c, i) => c.grupo && columnas[i - 1]?.grupo !== c.grupo;

  return (
    <div className="space-y-4">
    <ResumenAgentes lista={lista} onElegir={a => { setSolapa("escritorio"); setF({ ...filtroVacio(), agente: a }); setPagina(0); }} />
    <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
      {solapas.map(s => (
        <button key={s.id} type="button" onClick={() => { setSolapa(s.id); setPagina(0); }}
          className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap " +
            (solapa === s.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
          {s.etiqueta}
          <span className={"text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums " +
            (s.id === "porVencer" && lista.some(s.incluye) ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600")}>
            {lista.filter(s.incluye).length}
          </span>
        </button>
      ))}
    </div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{SOLAPAS.find(s => s.id === solapa).etiqueta}</h3>
          <span className="text-[11px] text-slate-500">{filas.length} de {deLaSolapa.length} orden{deLaSolapa.length !== 1 ? "es" : ""} de compra</span>
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
            <Plus size={14} /> Cargar orden de compra
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left bg-slate-50 text-[11px] font-medium text-slate-500 uppercase tracking-wide align-bottom">
              {columnas.map((c, i) => (c.grupo
                ? abreGrupo(c, i) && <th key={c.grupo} colSpan={enGrupo(c)} className="pt-2 px-3 text-center border-b border-slate-200">{c.grupo}</th>
                : <th key={c.titulo} rowSpan={2} className={"pt-2 px-3 " + c.ancho + claseTh(c)}>{c.titulo}</th>))}
            </tr>
            <tr className="text-left border-b border-slate-100 bg-slate-50 text-[11px] font-medium text-slate-500 uppercase tracking-wide align-bottom">
              {columnas.filter(c => c.grupo).map(c => <th key={c.titulo} className={"pt-1 px-3 " + c.ancho + claseTh(c)}>{c.titulo}</th>)}
            </tr>
            <tr className="text-left border-b border-slate-100 bg-slate-50">
              {columnas.map(c => <th key={c.titulo} className={"py-2 px-3 align-top" + claseTh(c)}>{c.filtro || null}</th>)}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={columnas.length} className="py-10 text-center text-sm text-slate-500">No hay órdenes de compra con esos filtros.</td></tr>
            ) : filasPagina.map(e => (
              <tr key={e.id} onClick={() => setForm(e.id)} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer align-top text-xs text-slate-700">
                {columnas.map(c => (
                  <td key={c.titulo} onClick={c.alTocar} className={"py-2.5 px-3 " + c.ancho + fija(c) + (c.fondo || "")}>{c.celda(e)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacion total={filas.length} pagina={paginaActual} porPagina={porPagina}
        onPagina={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(0); }} />

      {form && (
        <FormularioOrdenCompra
          key={form}
          inicial={seleccionada}
          numeroNuevo={siguienteNumeroOC(lista)}
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
