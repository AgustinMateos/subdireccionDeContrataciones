"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { X, Plus, Download, Trash2, Pencil, ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import { ALERTA_ESTILO } from "@/lib/constants";
import { alertaDias, diasEnSector } from "@/lib/diasEnSector";
import { fmtFecha } from "@/lib/utils";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { sumarDiasHabiles } from "@/lib/diasHabiles";
import {
  FUEROS_RESOLUCIONES, TIPOS_CONTRATACION_RESOLUCIONES, TIPOS_RESOLUCION, SECTORES_RESOLUCIONES,
  ESTADOS_RESOLUCION, AGENTES_RESOLUCIONES, EMAIL_JEFA_SUBDIRECCION, compararResoluciones, esFracasoODesierta, esFinalizado, ESTADOS_GENERALES, ETIQUETA_ESTADO_GENERAL, estadoGeneral, esParaAdjudicar, esPrioritario,
  estaFueraDeResoluciones, faltaDelDictamen, fechaISO, EVENTO_CAMBIOS_RESOLUCIONES,
} from "@/lib/resoluciones";
import FiltroDesplegable from "./FiltroDesplegable";
import BotonAccion from "./BotonAccion";
import Paginacion, { OPCIONES_POR_PAGINA } from "./Paginacion";
import EstrellaPrioridad from "./EstrellaPrioridad";
import EtiquetasPrioridad from "./EtiquetasPrioridad";
import CampoOpciones from "./CampoOpciones";
import {
  AbrirTodos, BotonOpcion, CLASE_ENTRADA, Campo, ElegirDeLista, ElegirDia, Entrada, Paso, Pregunta, SiNo, usePasos,
} from "./FormularioFacil";
import { expParaBuscar, mismoExp } from "@/lib/numeroExpediente";

const CLAVE_OCULTAS = "resoluciones.columnasOcultas";
const norm = s => String(s || "").trim().toLowerCase();
const fecha = f => (f ? fmtFecha(fechaISO(f)) : "-");
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";


const ETIQUETA_CAMPO = { sectorActual: "Sector actual", tipoResolucion: "Tipo de resolución", estado: "Estado", situacion: "Estado gral." };

// Desplegable para cambiar un campo desde la tabla, sin abrir el
// expediente (propio, no el <select> del navegador; la lista flota sobre
// la tabla para que no la recorte el scroll). Suma el valor actual si no
// está en la lista. `vacio`: cómo se lee la opción vacía.
export function SelectRapido({ valor, opciones, onChange, fuerte, className = "", vacio = "-" }) {
  const lista = [...new Set([...opciones, ...(valor ? [valor] : [])])];
  return (
    <div className={"min-w-[165px] " + className}>
      <FiltroDesplegable
        valor={valor || ""}
        onChange={onChange}
        opciones={[{ valor: "", etiqueta: vacio }, ...lista.map(o => ({ valor: o, etiqueta: o }))]}
        clase={"bg-white border-slate-200 " + (fuerte ? "font-medium text-slate-900" : "text-slate-700")}
        anchoCompleto
        flotante
      />
    </div>
  );
}

export function FiltroColumna({ valor, etiqueta, opciones, onChange }) {
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
    estado: "", situacion: "", sectorActual: "", agente: "",
  };
}

const VACIO = {
  exp: "", fechaIngreso: "", objeto: "", fuero: "", organismo: "", tipoContratacion: "", numero: "",
  cantidadOfertas: "", cantidadRenglones: "", situacion: "TRAMITANDO",
  tipoResolucion: "", estado: "", sectorActual: "", fechaUltimoMov: "", agente: "", vencOfertas: "",
  inicioServicio: "", montos: "", observaciones: "", prioritario: false,
  renovacionAutomatica: false, renovacionDias: "", renovacionHabiles: true,
  enPrestamo: false, dictamenNumero: "", dictamenVence: "",
};

function aFormulario(e) {
  if (!e) return { ...VACIO, fechaIngreso: hoyLocalISO(), fechaUltimoMov: hoyLocalISO() };
  const f = {};
  for (const k of Object.keys(VACIO)) f[k] = e[k] ?? "";
  for (const k of ["fechaIngreso", "fechaUltimoMov", "vencOfertas", "dictamenVence"]) f[k] = fechaISO(e[k]);
  // El cuadro de observaciones es para agregar una nueva: las anteriores
  // quedan en el historial.
  f.observaciones = "";
  return f;
}

// Alta / edición de un expediente, en dos solapas: los datos del
// expediente y sus movimientos y estados (con el historial).
export function FormularioResolucion({ inicial, esJefa, expedientes, onCerrar, onGuardar, onEliminar, onCambiarMovimiento }) {
  const [f, setF] = useState(() => aFormulario(inicial));
  // Un expediente cargado abre en "Información" (todo a la vista, sin
  // editar); uno nuevo, directo en la carga de datos.
  const [solapa, setSolapa] = useState(inicial ? "info" : "datos");
  const [alAbrir] = useState(() => JSON.stringify(aFormulario(inicial)));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  // Versión del expediente al abrir el formulario: si la planilla se
  // recarga con una más nueva (lo cambió otra persona), se avisa.
  const [versionAlAbrir, setVersionAlAbrir] = useState(inicial?.actualizadoEn);
  const cambioMientrasEditaba = !!inicial && inicial.actualizadoEn !== versionAlAbrir;

  // Al editar, la jefa solo cambia agente y prioridad de los datos.
  const fijo = esJefa && !!inicial;
  // Pasos abiertos: en un alta, el primero; al editar, dónde está y cómo
  // sigue (la jefa, el expediente, donde asigna).
  const pasos = usePasos(!inicial ? { 1: true } : fijo ? { 1: true } : { 4: true }, n => resumenPaso(n, f));
  const paso = pasos.paso;
  const proxima = useProximaRenovacion(f);

  // Al cambiar el sector, el último movimiento pasa a ser hoy (se puede
  // corregir a mano); si vuelve al sector que tenía, vuelve su fecha.
  const sectorAlAbrir = inicial?.sectorActual || "";
  const fechaAlAbrir = inicial ? fechaISO(inicial.fechaUltimoMov) : "";
  function set(campo, valor) {
    setF(prev => {
      const n = { ...prev, [campo]: valor };
      if (inicial && campo === "sectorActual" && valor && valor !== prev.sectorActual) {
        n.fechaUltimoMov = valor === sectorAlAbrir ? fechaAlAbrir : hoyLocalISO();
      }
      // Otro estado general: hay que volver a contestar si es un reingreso.
      if (campo === "situacion") delete n.reingreso;
      return n;
    });
    setError("");
  }

  // Estaba Finalizado y se lo vuelve a poner en trámite: se pregunta si es
  // un reingreso (o fue un error de clic).
  const vuelveDeFinalizado = !!inicial && esFinalizado(inicial) && !esFinalizado(f);

  async function guardar() {
    // Los campos que faltan están en la solapa de datos: se vuelve a ella.
    const falta = !f.exp.trim() || !f.objeto.trim() ? "Completá N° de expediente y objeto."
      : esJefa && f.renovacionAutomatica && !(Number(f.renovacionDias) > 0) ? "Completá los días de la renovación automática."
        : esJefa && f.renovacionAutomatica && !f.vencOfertas ? (fijo ? "Para la renovación automática falta el vencimiento de ofertas: lo carga Resoluciones." : "Para la renovación automática cargá el vencimiento de ofertas.")
          : vuelveDeFinalizado && f.reingreso === undefined ? "Estaba Finalizado: indicá si es un reingreso o fue un error."
          : !fijo && faltaDelDictamen(f) ? faltaDelDictamen(f)
          : "";
    const pasoConFalta = !f.exp.trim() || !f.objeto.trim() ? [1, 2] : !fijo && faltaDelDictamen(f) ? [1]
      : [vuelveDeFinalizado && f.reingreso === undefined ? 4 : 3];
    if (falta) { setError(falta); setSolapa("datos"); pasos.abrir(...pasoConFalta); return; }
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

  // Corregir una observación (texto) o borrar un registro del historial (null). Es un
  // cambio propio: no se avisa que lo modificó otra persona.
  async function cambiarMovimiento(movId, texto) {
    const data = await onCambiarMovimiento(movId, texto);
    if (!data.error) setVersionAlAbrir(data.expediente.actualizadoEn);
    return data;
  }

  const historial = [...(inicial?.movimientos || [])].reverse();
  const dias = inicial ? diasEnSector(inicial) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      {/* Alto fijo: no salta al cambiar de solapa. */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[min(92vh,820px)] flex flex-col overflow-hidden">
        {/* Encabezado: a la vista en las dos solapas. */}
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
                  {[ETIQUETA_ESTADO_GENERAL[estadoGeneral(inicial)], inicial.sectorActual, inicial.estado, inicial.tipoResolucion].filter(Boolean).map(t => (
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
              inicial && { id: "info", etiqueta: "Información" },
              { id: "datos", etiqueta: "Carga de datos" },
              { id: "movimientos", etiqueta: inicial ? "Observaciones e historial (" + historial.length + ")" : "Observaciones" },
            ].filter(Boolean).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSolapa(t.id)}
                className={"px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors " +
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

          {solapa === "datos" && <AbrirTodos pasos={pasos} total={4} />}
          {solapa === "info" ? (
            <InfoExpediente e={inicial} historial={historial} irA={setSolapa} />
          ) : solapa === "datos" && fijo ? (
            // La jefa ve la ficha: solo cambia agente y prioridad.
            <>
              <Paso {...paso(1)} titulo="El expediente">
                <DatoFicha label="N° de expediente" valor={f.exp} mono />
                <DatoFicha label="Número de contratación" valor={f.numero} />
                <Campo pregunta="¿Cuántas ofertas hay?">
                  <EntradaCantidad valor={f.cantidadOfertas} onChange={v => set("cantidadOfertas", v)} ejemplo="3" />
                </Campo>
                <Campo pregunta="¿Cuántos renglones tiene?">
                  <EntradaCantidad valor={f.cantidadRenglones} onChange={v => set("cantidadRenglones", v)} ejemplo="12" />
                </Campo>
                <DatoFicha label="Ingresó al sector" valor={fecha(f.fechaIngreso)} />
                <DatoFicha label="En préstamo" valor={textoPrestamo(f)} />
                <Campo pregunta="¿A quién se le asigna?" ancho>
                  <ElegirDeLista opciones={AGENTES_RESOLUCIONES} valor={f.agente} onChange={v => set("agente", v)} vacio="Sin asignar" />
                  <CargaPorAgente expedientes={expedientes} elegido={f.agente} onElegir={v => set("agente", v)} />
                </Campo>
                <Campo pregunta="¿Es prioritario?">
                  <SiNo valor={!!f.prioritario} onChange={v => set("prioritario", v)} si="Sí, prioritario" no="No" />
                </Campo>
              </Paso>
              <Paso {...paso(2)} titulo="Qué se contrata">
                <DatoFicha label="Objeto" valor={f.objeto} />
                <DatoFicha label="Fuero" valor={f.fuero} />
                <DatoFicha label="Organismo" valor={f.organismo} />
                <DatoFicha label="Tipo de contratación" valor={f.tipoContratacion} />
                <DatoFicha label="Montos" valor={f.montos} />
              </Paso>
              <Paso {...paso(3)} titulo="Plazos">
                <DatoFicha label="Vencen las ofertas" valor={fecha(f.vencOfertas)} />
                <DatoFicha label="Inicio del servicio" valor={f.inicioServicio} />
                <Campo pregunta="Cuando vencen, ¿las ofertas se renuevan solas?" ayuda="Si se renuevan, queda anotado en el historial y Resoluciones recibe el aviso en la campana." ancho>
                  <EditorRenovacion f={f} set={set} proxima={proxima} />
                </Campo>
              </Paso>
              <Paso {...paso(4)} titulo="Dónde está y cómo sigue">
                <DatoFicha label="Sector donde está" valor={f.sectorActual} />
                <DatoFicha label="Último movimiento" valor={fecha(f.fechaUltimoMov)} />
                <DatoFicha label="Estado" valor={f.estado} />
                <DatoFicha label="Tipo de resolución (lo carga Resoluciones)" valor={f.tipoResolucion} />
                <Campo pregunta="¿Cuál es el estado general?" ayuda="Finalizado: va al fondo de la lista y deja de contar días." ancho>
                  <ElegirEstadoGeneral valor={f.situacion} onChange={v => set("situacion", v)} />
                  {vuelveDeFinalizado && <PreguntaReingreso valor={f.reingreso} onChange={v => setF(prev => ({ ...prev, reingreso: v }))} />}
                </Campo>
              </Paso>
            </>
          ) : solapa === "datos" ? (
            <>
              <p className="text-sm text-slate-600">Completá lo que sepas; lo demás se puede cargar después. Lo único obligatorio es el <b>N° de expediente</b> y el <b>objeto</b>. Tocá cada paso para abrirlo.</p>

              <Paso {...paso(1)} titulo="El expediente">
                <Campo pregunta="N° de expediente (obligatorio)">
                  <Entrada valor={f.exp} onChange={v => set("exp", v)} ejemplo="13-05999/2025" mono />
                </Campo>
                <Campo pregunta="Número de contratación">
                  <Entrada valor={f.numero} onChange={v => set("numero", v)} ejemplo="139/26" />
                </Campo>
                {esJefa ? (
                  <>
                    <Campo pregunta="¿Cuántas ofertas hay?">
                      <EntradaCantidad valor={f.cantidadOfertas} onChange={v => set("cantidadOfertas", v)} ejemplo="3" />
                    </Campo>
                    <Campo pregunta="¿Cuántos renglones tiene?">
                      <EntradaCantidad valor={f.cantidadRenglones} onChange={v => set("cantidadRenglones", v)} ejemplo="12" />
                    </Campo>
                  </>
                ) : (
                  <>
                    <Campo pregunta="Cantidad de ofertas"><SoloLaJefa valor={f.cantidadOfertas} /></Campo>
                    <Campo pregunta="Cantidad de renglones"><SoloLaJefa valor={f.cantidadRenglones} /></Campo>
                  </>
                )}
                <Campo pregunta="¿Qué día ingresó al sector?" ayuda={inicial ? "Queda como se cargó: desde este día se cuentan los días del semáforo." : "Desde este día se cuentan los días del semáforo. Después no se cambia."} ancho>
                  {inicial ? <p className="text-base text-slate-800 py-2">{fecha(f.fechaIngreso)}</p>
                    : <ElegirDia valor={f.fechaIngreso} onChange={v => set("fechaIngreso", v)} />}
                </Campo>
                <Campo pregunta="¿Está en préstamo?" ancho>
                  <SiNo valor={!!f.enPrestamo} onChange={v => set("enPrestamo", v)} si="Sí, está en préstamo" no="No" />
                  {f.enPrestamo && (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4 grid md:grid-cols-2 gap-x-6 gap-y-4">
                      <div>
                        <Pregunta>N° de dictamen</Pregunta>
                        <EntradaDictamen valor={f.dictamenNumero} onChange={v => set("dictamenNumero", v)} />
                      </div>
                      <div>
                        <Pregunta>¿Cuándo vence el dictamen?</Pregunta>
                        <ElegirDia valor={f.dictamenVence} onChange={v => set("dictamenVence", v)} />
                      </div>
                      <p className="md:col-span-2 text-sm text-slate-600">Ese día te llega un aviso en la campana para devolverlo a Aperturas, que notifica si hubo o no impugnaciones.</p>
                    </div>
                  )}
                </Campo>
                <Campo pregunta="Agente asignado" ancho>
                  {esJefa ? <>
                    <ElegirDeLista opciones={AGENTES_RESOLUCIONES} valor={f.agente} onChange={v => set("agente", v)} vacio="Sin asignar" />
                    <CargaPorAgente expedientes={expedientes} elegido={f.agente} onElegir={v => set("agente", v)} />
                  </>
                    : <p className="text-base text-slate-800 py-2">{f.agente || "Sin asignar"} <span className="text-sm text-slate-500">(lo asigna la jefa)</span></p>}
                </Campo>
                {esJefa && (
                  <Campo pregunta="¿Es prioritario?">
                    <SiNo valor={!!f.prioritario} onChange={v => set("prioritario", v)} si="Sí, prioritario" no="No" />
                  </Campo>
                )}
              </Paso>

              <Paso {...paso(2)} titulo="Qué se contrata">
                <Campo pregunta="Objeto: ¿Qué se contrata? (obligatorio)" ancho>
                  <Entrada valor={f.objeto} onChange={v => set("objeto", v)} ejemplo="SERVICIO DE LIMPIEZA" />
                </Campo>
                <Campo pregunta="Fuero" ayuda="Tocá para ver la lista, o escribí una parte para buscar.">
                  <CampoOpciones grande value={f.fuero} onChange={v => set("fuero", v)} opciones={FUEROS_RESOLUCIONES} placeholder="Elegí o escribí" />
                </Campo>
                <Campo pregunta="Organismo">
                  <Entrada valor={f.organismo} onChange={v => set("organismo", v)} ejemplo="TRIBUNAL ORAL FEDERAL N° 2" />
                </Campo>
                <Campo pregunta="¿Qué tipo de contratación es?" ancho>
                  <ElegirDeLista opciones={TIPOS_CONTRATACION_RESOLUCIONES} valor={f.tipoContratacion} onChange={v => set("tipoContratacion", v)} />
                </Campo>
                <Campo pregunta="Montos" ancho>
                  <Entrada valor={f.montos} onChange={v => set("montos", v)} ejemplo="$ 61.096.888,00" />
                </Campo>
              </Paso>

              <Paso {...paso(3)} titulo="Plazos">
                <Campo pregunta="¿Qué día vencen las ofertas?" ancho>
                  <ElegirDia valor={f.vencOfertas} onChange={v => set("vencOfertas", v)} />
                </Campo>
                <Campo pregunta="¿Cuándo empieza el servicio?" ancho>
                  <Entrada valor={f.inicioServicio} onChange={v => set("inicioServicio", v)} ejemplo="1/12/2026 o A PARTIR DE LA OC" />
                </Campo>
                <Campo pregunta="Cuando vencen, ¿las ofertas se renuevan solas?" ayuda={esJefa ? "Si se renuevan, queda anotado en el historial y avisa en la campana." : ""} ancho>
                  {esJefa ? <EditorRenovacion f={f} set={set} proxima={proxima} />
                    : <RenovacionSoloLectura f={f} proxima={proxima} />}
                </Campo>
              </Paso>

              <Paso {...paso(4)} titulo={"Dónde está y cómo sigue" + (esJefa && inicial ? " · lo carga Resoluciones" : "")}>
                <Campo pregunta="¿En qué sector está ahora?" ancho>
                  <ElegirDeLista opciones={SECTORES_RESOLUCIONES} valor={f.sectorActual} onChange={v => set("sectorActual", v)} otro="Otro sector" />
                </Campo>
                <Campo pregunta="¿Qué día fue el último movimiento?" ayuda={inicial ? "Al cambiar el sector se pone hoy solo. No cambia los días del semáforo." : ""}>
                  {inicial ? <ElegirDia valor={f.fechaUltimoMov} onChange={v => set("fechaUltimoMov", v)} />
                    : <p className="text-base text-slate-800 py-2">Hoy, {fecha(f.fechaUltimoMov)} <span className="text-sm text-slate-500">(es el día en que se crea el expediente)</span></p>}
                </Campo>
                <Campo pregunta="¿En qué estado está?" ancho>
                  <ElegirDeLista opciones={ESTADOS_RESOLUCION} valor={f.estado} onChange={v => set("estado", v)} />
                </Campo>
                <Campo pregunta="¿Qué tipo de resolución es?" ancho>
                  <ElegirDeLista opciones={TIPOS_RESOLUCION} valor={f.tipoResolucion} onChange={v => set("tipoResolucion", v)} />
                </Campo>
                <Campo pregunta="¿Cuál es el estado general?" ayuda="Finalizado: va al fondo de la lista y deja de contar días." ancho>
                  <ElegirEstadoGeneral valor={f.situacion} onChange={v => set("situacion", v)} />
                  {vuelveDeFinalizado && <PreguntaReingreso valor={f.reingreso} onChange={v => setF(prev => ({ ...prev, reingreso: v }))} />}
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
                  <h3 className="text-base font-semibold text-slate-900">Lo que pasó con este expediente ({historial.length})</h3>
                  {historial.length === 0 ? (
                    <p className="text-sm text-slate-500">Todavía no hay nada anotado.</p>
                  ) : (
                    <ol className="relative border-l border-slate-200 ml-1.5 space-y-4">
                      {historial.map(m => {
                        // Observaciones y renovaciones de ofertas se leen como texto.
                        const esObs = m.campo === "Observaciones" || m.campo === "Renovación de ofertas";
                        return (
                          <li key={m.id} className="pl-5 relative">
                            <span className={"absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white " + (esObs ? "bg-slate-400" : "bg-slate-800")} />
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                              <span className="font-medium text-slate-700">{fecha(m.fecha)}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{m.campo}</span>
                              <span className="ml-auto">{m.usuario}</span>
                            </div>
                            <RegistroEditable m={m} esObs={esObs} onCambiar={cambiarMovimiento} />
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

        {/* Guardar toma todas las solapas. En "Información" sin cambios
            pendientes, solo cerrar o ir a editar. */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-sm font-medium text-red-700">{error}</p>}
          {solapa === "info" && JSON.stringify(f) === alAbrir ? (
            <>
              <button onClick={onCerrar} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50">Cerrar</button>
              <button onClick={() => setSolapa("datos")} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">
                {fijo ? "Asignar o cambiar datos" : "Cargar o cambiar datos"}
              </button>
            </>
          ) : (
            <>
              <button onClick={onCerrar} disabled={guardando} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50">
                {fijo ? "Cerrar" : "Cancelar sin guardar"}
              </button>
              <BotonAccion onClick={guardar} cargando={guardando}
                className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50">
                {inicial ? "Guardar cambios" : "Guardar el expediente"}
              </BotonAccion>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Solapa "Información": todo el expediente a la vista, limpio y sin
// campos para editar, como quedó guardado.
function InfoExpediente({ e, historial, irA }) {
  const dias = diasEnSector(e);
  const ultimos = historial.slice(0, 4);
  const Dato = ({ label, children, ancho }) => (
    <div className={"min-w-0" + (ancho ? " sm:col-span-2" : "")}>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base text-slate-900 break-words">{children || <span className="text-slate-400">Sin cargar</span>}</dd>
    </div>
  );
  const Bloque = ({ titulo, children }) => (
    <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">{titulo}</h3>
      <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-4">{children}</dl>
    </section>
  );
  return (
    <>
      <Bloque titulo="Dónde está hoy">
        <Dato label="Estado general"><span className={"font-semibold " + (esFinalizado(e) ? "text-emerald-700" : "")}>{ETIQUETA_ESTADO_GENERAL[estadoGeneral(e)]}</span></Dato>
        <Dato label="Sector">{e.sectorActual}</Dato>
        <Dato label="Tipo de resolución">{e.tipoResolucion}</Dato>
        <Dato label="Estado de la resolución">{e.estado}</Dato>
        <Dato label="Días en el sector">
          {dias != null && <span className={"inline-block text-sm font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} día{dias !== 1 ? "s" : ""} (desde el {fecha(e.fechaIngreso || e.fechaUltimoMov)})</span>}
        </Dato>
        <Dato label="Último movimiento">{e.fechaUltimoMov && fecha(e.fechaUltimoMov)}</Dato>
      </Bloque>

      <Bloque titulo="El expediente">
        <Dato label="N° de expediente"><span className="font-mono">{e.exp}</span></Dato>
        <Dato label="Número de contratación">{e.numero}</Dato>
        <Dato label="Agente asignado">{e.agente}</Dato>
        <Dato label="Prioridad">{e.enPlanObras ? "Prioritario (Plan de Obras)" : e.prioritario ? "Prioritario" : "Normal"}</Dato>
        <Dato label="Cantidad de ofertas">{e.cantidadOfertas != null && String(e.cantidadOfertas)}</Dato>
        <Dato label="Cantidad de renglones">{e.cantidadRenglones != null && String(e.cantidadRenglones)}</Dato>
        <Dato label="Ingresó al sector">{e.fechaIngreso && fecha(e.fechaIngreso)}</Dato>
        <Dato label="En préstamo">{textoPrestamo(e)}</Dato>
      </Bloque>

      <Bloque titulo="Qué se contrata">
        <Dato label="Objeto" ancho>{e.objeto}</Dato>
        <Dato label="Fuero">{e.fuero}</Dato>
        <Dato label="Organismo">{e.organismo}</Dato>
        <Dato label="Tipo de contratación">{e.tipoContratacion}</Dato>
        <Dato label="Montos">{e.montos}</Dato>
      </Bloque>

      <Bloque titulo="Plazos">
        <Dato label="Vencen las ofertas">{e.vencOfertas && fecha(e.vencOfertas)}</Dato>
        <Dato label="Inicio del servicio">{e.inicioServicio}</Dato>
        <Dato label="Renovación automática de las ofertas" ancho>{textoRenovacion(e)}</Dato>
      </Bloque>

      <section className="rounded-xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Lo último</h3>
          <button type="button" onClick={() => irA("movimientos")} className="text-sm text-slate-700 underline hover:text-slate-900">Ver observaciones e historial</button>
        </div>
        {e.observaciones && (
          <div className="mb-3">
            <p className="text-xs font-medium text-slate-500">Última observación</p>
            <p className="mt-1 text-base text-slate-800 whitespace-pre-line bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{e.observaciones}</p>
          </div>
        )}
        {ultimos.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay nada anotado.</p> : (
          <ul className="space-y-1.5">
            {ultimos.map(m => (
              <li key={m.id} className="text-sm text-slate-700">
                <span className="font-medium text-slate-900">{fecha(m.fecha)}</span> · {m.campo}:{" "}
                {m.sectorAnterior && m.campo !== "Observaciones" && m.campo !== "Renovación de ofertas" ? <>{m.sectorAnterior} → </> : null}
                <span className="font-medium">{m.sector}</span>
                <span className="text-slate-400"> · {m.usuario}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// Un registro del historial con tacho para borrarlo (con confirmación);
// las observaciones, además, con lápiz para corregirlas. `esObs`: se lee
// como texto (observaciones y renovaciones). `onCambiar(id, texto | null)`.
function RegistroEditable({ m, esObs, onCambiar }) {
  // null: se lee; "editar" | "eliminar": lo que se está haciendo.
  const [modo, setModo] = useState(null);
  const [texto, setTexto] = useState(m.sector);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  async function confirmar() {
    if (modo === "editar" && !texto.trim()) { setError("No puede quedar vacía: para sacarla, eliminala."); return; }
    setGuardando(true);
    const data = await onCambiar(m.id, modo === "editar" ? texto.trim() : null);
    setGuardando(false);
    if (data.error) { setError(data.error); return; }
    setModo(null);
    setError("");
  }
  function cancelar() { setModo(null); setTexto(m.sector); setError(""); }

  if (modo === "editar") {
    return (
      <div className="mt-1 space-y-2">
        <textarea value={texto} onChange={e => { setTexto(e.target.value); setError(""); }} rows={3} autoFocus className={CLASE_ENTRADA + " resize-y"} />
        <div className="flex items-center justify-end gap-2">
          {error && <p className="mr-auto text-xs font-medium text-red-700">{error}</p>}
          <button type="button" onClick={cancelar} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium">Cancelar</button>
          <BotonAccion onClick={confirmar} cargando={guardando} className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
            Guardar observación
          </BotonAccion>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-1 space-y-2">
      <div className={"flex items-start gap-2 " + (esObs ? "bg-slate-50 border border-slate-100 rounded-md px-3 py-2" : "")}>
        {esObs ? (
          <p className="flex-1 text-sm text-slate-800 whitespace-pre-line">{m.sector}</p>
        ) : (
          <p className="flex-1 text-sm flex flex-wrap items-center gap-1.5">
            {m.sectorAnterior && (<><span className="text-slate-500 line-through">{m.sectorAnterior}</span><ArrowRight size={13} className="text-slate-400" /></>)}
            <span className="font-medium text-slate-900">{m.sector}</span>
          </p>
        )}
        {!modo && (
          <span className="shrink-0 flex gap-1">
            {m.campo === "Observaciones" && (
              <button type="button" onClick={() => setModo("editar")} title="Editar observación" aria-label="Editar observación"
                className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-white"><Pencil size={14} /></button>
            )}
            <button type="button" onClick={() => setModo("eliminar")} title="Eliminar del historial" aria-label="Eliminar del historial"
              className="p-1 rounded text-slate-400 hover:text-red-700 hover:bg-white"><Trash2 size={14} /></button>
          </span>
        )}
      </div>
      {modo === "eliminar" && (
        <div className="border border-red-200 bg-red-50 rounded-md p-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-red-800">{error || (m.campo === "Observaciones"
            ? "¿Eliminar esta observación? No se puede deshacer."
            : "¿Sacar este registro del historial? El expediente queda como está. No se puede deshacer.")}</p>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={cancelar} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium">Cancelar</button>
            <BotonAccion onClick={confirmar} cargando={guardando} cargandoTexto="Eliminando..."
              className="px-3 py-1.5 rounded-md bg-red-700 text-white text-xs font-medium hover:bg-red-800">
              Eliminar
            </BotonAccion>
          </div>
        </div>
      )}
    </div>
  );
}

// Carga de cada agente, para que la jefa asigne: expedientes tramitando
// en el sector Resoluciones (no finalizados ni en otro sector) por tipo de resolución y prioritarios. Se despliega
// tocando el título; tocar una fila asigna a ese agente.
const GRUPOS_CARGA = [
  { titulo: "Para adjudicar", es: t => t === "ADJUDICAR" },
  { titulo: "Fracasa / autoriza", es: t => t === "FRACASA / AUTORIZA" },
  { titulo: "Fracasar, desierta, sin efecto o revocar", es: t => ["FRACASAR", "DESIERTA", "SIN EFECTO", "REVOCAR"].includes(t) },
];

function CargaPorAgente({ expedientes, elegido, onElegir }) {
  const [abierta, setAbierta] = useState(false);
  if (!expedientes?.length) return null;
  const enTramite = expedientes.filter(e => estadoGeneral(e) === "TRAMITANDO" && !estaFueraDeResoluciones(e));
  // S/A es "sin asignar": no es un agente al que repartirle.
  const agentes = [...new Set([...AGENTES_RESOLUCIONES, ...enTramite.map(e => e.agente).filter(Boolean)])].filter(a => a !== "S/A");
  const filas = agentes.map(a => {
    const suyos = enTramite.filter(e => e.agente === a);
    const tipo = e => String(e.tipoResolucion || "").trim().toUpperCase();
    return { agente: a, total: suyos.length, grupos: GRUPOS_CARGA.map(g => suyos.filter(e => g.es(tipo(e))).length), prioritarios: suyos.filter(esPrioritario).length };
  });
  const celda = (n, fuerte) => <td className={"px-2 py-1.5 text-center tabular-nums " + (n ? (fuerte ? "font-semibold text-slate-900" : "text-slate-800") : "text-slate-300")}>{n || "–"}</td>;
  return (
    <div className="mt-3 rounded-lg border border-slate-200 overflow-x-auto">
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta}
        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg">
        <span>Cuánto tiene cada uno (tramitando en Resoluciones){abierta && <span className="font-normal text-slate-500"> · tocá una fila para asignar</span>}</span>
        <span className="shrink-0 inline-flex items-center gap-1 text-slate-600">
          {abierta ? "Ocultar" : "Ver"}
          <ChevronDown size={18} className={"transition-transform " + (abierta ? "rotate-180" : "")} />
        </span>
      </button>
      {abierta && (
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-500 border-b border-slate-200">
            <th className="px-3 py-1.5 text-left font-medium">Agente</th>
            <th className="px-2 py-1.5 font-medium">Total</th>
            {GRUPOS_CARGA.map(g => <th key={g.titulo} className="px-2 py-1.5 font-medium">{g.titulo}</th>)}
            <th className="px-2 py-1.5 font-medium">Prioritarios</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(r => (
            <tr key={r.agente} onClick={() => onElegir(r.agente)}
              className={"cursor-pointer border-b border-slate-100 last:border-0 " + (r.agente === elegido ? "bg-slate-900/5 font-medium" : "hover:bg-slate-50")}>
              <td className="px-3 py-1.5 font-mono whitespace-nowrap">{r.agente === elegido && <Check size={13} className="inline -mt-0.5 mr-1" />}{r.agente}</td>
              {celda(r.total, true)}
              {r.grupos.map((n, i) => <Fragment key={i}>{celda(n)}</Fragment>)}
              <td className={"px-2 py-1.5 text-center tabular-nums " + (r.prioritarios ? "font-semibold text-amber-700" : "text-slate-300")}>{r.prioritarios || "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
}

// Estado general: Tramitando o Finalizado (lo cambian
// Resoluciones y la jefa).
function ElegirEstadoGeneral({ valor, onChange }) {
  return <ElegirDeLista opciones={ESTADOS_GENERALES} valor={valor || "TRAMITANDO"} onChange={v => v && onChange(v)} etiqueta={o => ETIQUETA_ESTADO_GENERAL[o] || o} />;
}

// Un finalizado que vuelve a trámite: ¿reingresó o fue un error de clic?
// Si reingresó, la observación pasa a ser "REINGRESO I" (II, III...) con
// los datos que cambiaron, y la fecha de ingreso al sector, hoy.
function PreguntaReingreso({ valor, onChange }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
      <p className="text-sm font-medium text-amber-900">Estaba Finalizado. ¿Es un reingreso?</p>
      <div className="flex flex-wrap gap-2">
        <BotonOpcion elegido={valor === true} onClick={() => onChange(true)}>Sí, es un reingreso</BotonOpcion>
        <BotonOpcion elegido={valor === false} onClick={() => onChange(false)}>No, fue un error</BotonOpcion>
      </div>
      <p className="text-xs text-amber-900">
        {valor === true ? "Al guardar, la fecha de ingreso pasa a ser hoy y la observación dice \"REINGRESO\" con su número (I, II, III...) y los datos que cambiaste (de cuál a cuál). Queda en el historial."
          : valor === false ? "Vuelve a como estaba, sin dejar constancia ni cambiar fechas."
          : "Si reingresó, queda anotado como REINGRESO I, II, III..."}
      </p>
    </div>
  );
}

// Renovación automática de las ofertas: la activa y le pone los días solo
// la jefa de la Subdirección.
function EditorRenovacion({ f, set, proxima }) {
  return (
    <>
      <SiNo valor={!!f.renovacionAutomatica} onChange={v => set("renovacionAutomatica", v)} si="Sí, se renuevan solas" no="No" />
      {f.renovacionAutomatica && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
          <div>
            <p className="text-sm text-slate-700 mb-1.5">¿Por cuántos días?</p>
            <input type="number" min="1" inputMode="numeric" value={f.renovacionDias} onChange={e => set("renovacionDias", e.target.value)}
              placeholder="Ej.: 10" className={CLASE_ENTRADA + " max-w-[8rem]"} />
          </div>
          <div>
            <p className="text-sm text-slate-700 mb-1.5">¿Qué días se cuentan?</p>
            <div className="flex flex-wrap gap-2">
              <BotonOpcion elegido={!!f.renovacionHabiles} onClick={() => set("renovacionHabiles", true)}>Días hábiles</BotonOpcion>
              <BotonOpcion elegido={!f.renovacionHabiles} onClick={() => set("renovacionHabiles", false)}>Días corridos</BotonOpcion>
            </div>
          </div>
          <p className="text-sm text-slate-600">{textoRenovacion(f)}</p>
          {!f.vencOfertas && <p className="text-sm text-amber-800">Falta el vencimiento de ofertas: sin esa fecha no se puede renovar.</p>}
          {proxima && <p className="text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2">{proxima}</p>}
        </div>
      )}
    </>
  );
}

// Para Resoluciones: cómo quedó la renovación (la define la jefa).
function RenovacionSoloLectura({ f, proxima }) {
  return (
    <div className="space-y-2">
      <p className="text-base text-slate-800 py-2">{textoRenovacion(f)} <span className="text-sm text-slate-500">(lo define la jefa)</span></p>
      {proxima && <p className="text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{proxima}</p>}
    </div>
  );
}

// Renovación automática de las ofertas, en palabras.
function textoRenovacion(f) {
  if (!f.renovacionAutomatica) return "No";
  const dias = Number(f.renovacionDias) > 0 ? f.renovacionDias + " días " + (f.renovacionHabiles ? "hábiles" : "corridos") : "los días que indiques";
  return "Al vencer, las ofertas se renuevan solas por " + dias + ".";
}

// Con renovación automática y vencimiento cargado: hasta qué día se
// renovarían las ofertas, contando hábiles con los feriados nacionales y
// los inhábiles judiciales (como la renovación que hace el servidor).
function useProximaRenovacion(f) {
  const [feriados, setFeriados] = useState(null);
  const anio = Number(String(f.vencOfertas || "").slice(0, 4));
  const dias = Number(f.renovacionDias);
  const necesita = f.renovacionAutomatica && dias > 0 && anio > 0;
  useEffect(() => {
    if (!necesita || !f.renovacionHabiles) return;
    let activo = true;
    fetch("/api/feriados?anios=" + anio + "," + (anio + 1))
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (activo) setFeriados(d?.feriados ? { anio, lista: new Set(d.feriados) } : { anio, error: true }); })
      .catch(() => activo && setFeriados({ anio, error: true }));
    return () => { activo = false; };
  }, [necesita, f.renovacionHabiles, anio]);
  if (!necesita) return "";
  let hasta;
  if (f.renovacionHabiles) {
    if (!feriados || feriados.anio !== anio) return "Calculando hasta cuándo se renovarían...";
    if (feriados.error) return "";
    hasta = sumarDiasHabiles(f.vencOfertas, dias, feriados.lista);
  } else {
    const d = new Date(f.vencOfertas + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() + dias);
    hasta = d.toISOString().slice(0, 10);
  }
  return "Si no se completa antes, el " + fecha(f.vencOfertas) + " las ofertas se renuevan solas hasta el " + fecha(hasta) +
    (f.renovacionHabiles ? " (se cuentan feriados y días inhábiles judiciales)." : ".");
}

// "3 ofertas", "1 renglón"; sin dato, nada.
function cuantos(n, uno, varios) {
  if (n === "" || n == null) return "";
  return n + " " + (Number(n) === 1 ? uno : varios);
}

// Dato que carga solo la jefa de la Subdirección, para quien no es ella.
function SoloLaJefa({ valor }) {
  const hay = valor !== "" && valor != null;
  return <p className="text-base text-slate-800 py-2">{hay ? valor : "Sin cargar"} <span className="text-sm text-slate-500">(lo carga la jefa)</span></p>;
}

// N° de dictamen: número / año, con el año en 4 cifras (arranca en el
// actual). Guarda "NNN/AAAA".
function EntradaDictamen({ valor, onChange }) {
  const [numero = "", anio = String(new Date().getFullYear())] = String(valor || "").split("/");
  return (
    <div className="flex items-center gap-2">
      <input inputMode="numeric" value={numero} placeholder="Ej.: 123" aria-label="Número de dictamen"
        onChange={e => onChange(e.target.value.replace(/\D/g, "") + "/" + anio)} className={CLASE_ENTRADA + " max-w-[8rem] font-mono"} />
      <span className="text-lg text-slate-400">/</span>
      <input inputMode="numeric" maxLength={4} value={anio} aria-label="Año del dictamen"
        onChange={e => onChange(numero + "/" + e.target.value.replace(/\D/g, "").slice(0, 4))} className={CLASE_ENTRADA + " max-w-[6rem] font-mono"} />
    </div>
  );
}

// Debajo de la etiqueta "En préstamo" en la tabla: "Dict. 416/2026 · vence
// 26/10/2026", en rojo si ya venció (hay que devolverlo a Aperturas).
function EtiquetaPrestamo({ expediente: e }) {
  if (!e.enPrestamo) return null;
  const vencido = e.dictamenVence && fechaISO(e.dictamenVence) <= hoyLocalISO();
  return (
    <p className={"mt-0.5 text-[11px] " + (vencido ? "text-red-700 font-semibold" : "text-slate-600")}>
      {[e.dictamenNumero && "Dict. " + e.dictamenNumero, e.dictamenVence && (vencido ? "venció " : "vence ") + fecha(e.dictamenVence)].filter(Boolean).join(" · ")}
    </p>
  );
}

// "No" o "Sí · Dictamen N° 123/2026 · vence el 30/10/2026".
function textoPrestamo(e) {
  if (!e.enPrestamo) return "No";
  return ["Sí", e.dictamenNumero && "Dictamen N° " + e.dictamenNumero, e.dictamenVence && "vence el " + fecha(e.dictamenVence)].filter(Boolean).join(" · ");
}

// Cantidad: solo números enteros (teclado numérico en el celular).
function EntradaCantidad({ valor, onChange, ejemplo }) {
  return (
    <input type="number" min="0" step="1" inputMode="numeric" value={valor ?? ""} placeholder={"Ej.: " + ejemplo}
      onChange={e => onChange(e.target.value.replace(/\D/g, ""))} className={CLASE_ENTRADA + " max-w-[10rem]"} />
  );
}

// Lo que se ve de cada paso cuando está cerrado.
function resumenPaso(n, f) {
  const partes = {
    1: [f.exp, f.numero && "Contratación N° " + f.numero, cuantos(f.cantidadOfertas, "oferta", "ofertas"),
      cuantos(f.cantidadRenglones, "renglón", "renglones"), f.agente && "Agente: " + f.agente, f.enPrestamo && "En préstamo"],
    2: [f.objeto, f.fuero, f.tipoContratacion],
    3: [f.vencOfertas && "Vencen las ofertas el " + fecha(f.vencOfertas), f.renovacionAutomatica && "se renuevan solas"],
    4: [ETIQUETA_ESTADO_GENERAL[estadoGeneral(f)], f.tipoResolucion, f.estado, f.sectorActual && "En " + f.sectorActual],
  }[n];
  return partes.filter(Boolean).join(" · ");
}

export function DatoFicha({ label, valor, mono }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className={"text-sm text-slate-900 break-words " + (mono ? "font-mono" : "")}>{valor || "-"}</p>
    </div>
  );
}

// Un grupo de campos del formulario, con su título.
export function Seccion({ titulo, children }) {
  return (
    <section className="space-y-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>
    </section>
  );
}

// Filtro rápido por agente, debajo del título de cada solapa: un botón por
// agente con cuántos expedientes tiene en la solapa ("Sin asignar" para los
// que no tienen). Tocar uno muestra solo los suyos; tocarlo de nuevo o
// "Todos", todos.
const SIN_AGENTE = "__sin_agente__";

function BotonesAgente({ expedientes, elegido, onElegir }) {
  const cuantos = a => expedientes.filter(e => (a === SIN_AGENTE ? !String(e.agente || "").trim() : e.agente === a)).length;
  const agentes = [...new Set([...AGENTES_RESOLUCIONES, ...expedientes.map(e => e.agente).filter(Boolean)])].filter(a => a !== "S/A");
  const botones = [...agentes.map(a => ({ valor: a, etiqueta: a, n: cuantos(a) })), { valor: SIN_AGENTE, etiqueta: "Sin asignar", n: cuantos(SIN_AGENTE) }]
    .filter(b => b.n > 0 || b.valor === elegido);
  if (!botones.length) return null;
  const clase = activo => "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors " +
    (activo ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500");
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500 mr-0.5">Por agente:</span>
      <button type="button" onClick={() => onElegir("")} className={clase(!elegido)}>Todos <span className="tabular-nums opacity-70">{expedientes.length}</span></button>
      {botones.map(b => (
        <button key={b.valor} type="button" onClick={() => onElegir(b.valor)} className={clase(elegido === b.valor)}>
          <span className={b.valor === SIN_AGENTE ? "" : "font-mono"}>{b.etiqueta}</span> <span className="tabular-nums opacity-70">{b.n}</span>
        </button>
      ))}
    </div>
  );
}

// Orden de todas las solapas (compararResoluciones), en palabras.
const POR_VENCIMIENTO = "por vencimiento de ofertas, el más próximo arriba (sin fecha, al final)";

// Solapas del panel: qué expedientes muestra cada una (el Inicio de la
// jefa cuenta con las mismas). `muestra` y `orden` se leen debajo del
// título de la tabla.
export const SOLAPAS = [
  { id: "general", etiqueta: "General", incluye: () => true,
    muestra: "Todos los expedientes, en trámite y finalizados.",
    orden: "Primero los prioritarios; después " + POR_VENCIMIENTO + ". Los fracasados y desiertas van después de los demás y los finalizados, al fondo." },
  { id: "escritorio", etiqueta: "Escritorio", incluye: e => !esFinalizado(e) && !estaFueraDeResoluciones(e),
    muestra: "Los que siguen en trámite (estado general Tramitando) y están hoy en Resoluciones (o sin sector cargado).",
    orden: "Primero los prioritarios; después " + POR_VENCIMIENTO + ". Los fracasados y desiertas, al final." },
  // Los que siguen en trámite: marcados con estrella o en el Plan de Obras.
  { id: "prioritarios", etiqueta: "Prioritarios", incluye: e => !esFinalizado(e) && esPrioritario(e),
    muestra: "En trámite y prioritarios: marcados con estrella por la jefa o en el Plan de Obras.",
    orden: "Ordenados " + POR_VENCIMIENTO + ". Los fracasados y desiertas, al final." },
  { id: "adjudicar", etiqueta: "Para adjudicar", incluye: e => !esFinalizado(e) && esParaAdjudicar(e),
    muestra: "En trámite con tipo de resolución ADJUDICAR o FRACASA / AUTORIZA.",
    orden: "Primero los prioritarios; después " + POR_VENCIMIENTO + "." },
  { id: "fuera", etiqueta: "Fuera de Resoluciones", incluye: e => !esFinalizado(e) && estaFueraDeResoluciones(e),
    muestra: "En trámite y hoy en otro sector (el sector actual no es Resoluciones).",
    orden: "Primero los prioritarios; después " + POR_VENCIMIENTO + ". Los fracasados y desiertas, al final." },
  // Prestados por Aperturas: hay que devolverlos cuando vence el dictamen.
  { id: "prestamo", etiqueta: "En préstamo", incluye: e => !!e.enPrestamo,
    comparar: (a, b) => fechaISO(a.dictamenVence).localeCompare(fechaISO(b.dictamenVence)) || compararResoluciones(a, b),
    muestra: "Los que están en préstamo (con N° de dictamen y cuándo vence). Siempre en trámite: también figuran en las demás solapas.",
    orden: "Por vencimiento del dictamen, el más próximo arriba." },
  { id: "fracasos", etiqueta: "Fracasados y desiertas", incluye: e => !esFinalizado(e) && esFracasoODesierta(e),
    muestra: "En trámite con tipo de resolución FRACASAR o DESIERTA.",
    orden: "Primero los prioritarios; después " + POR_VENCIMIENTO + "." },
  { id: "finalizados", etiqueta: "Finalizados", incluye: esFinalizado,
    muestra: "Estado general Finalizado: ya terminaron y no cuentan días en el sector.",
    orden: "Primero los prioritarios; después " + POR_VENCIMIENTO + "." },
  // Para que la jefa de la Subdirección asigne lo pendiente.
  { id: "sinAsignar", etiqueta: "Sin asignar", incluye: e => !esFinalizado(e) && !String(e.agente || "").trim(), soloJefa: true,
    muestra: "En trámite y sin agente: los que falta asignar.",
    orden: "Primero los prioritarios; después " + POR_VENCIMIENTO + ". Los fracasados y desiertas, al final." },
];

function exportarExcel(filas, solapa) {
  const datos = [
    ["EXP.", "FECHA INGRESO AL SECTOR", "OBJETO", "FUERO", "ORGANISMO", "TIPO DE CONTRATACION", "NUMERO", "DIAS EN SECTOR",
      "TIPO DE RESOLUCION", "ESTADO", "ESTADO GRAL.", "ULTIMO MOV", "SECTOR ACTUAL", "AGENTE", "VENC. OFERTAS", "INICIO DE SERV", "MONTOS",
      "OBSERVACIONES", "PRIORITARIO"],
    ...filas.map(e => [
      e.exp, fecha(e.fechaIngreso), e.objeto, e.fuero || "", e.organismo || "", e.tipoContratacion || "", e.numero || "",
      diasEnSector(e) ?? "", e.tipoResolucion || "", e.estado || "", ETIQUETA_ESTADO_GENERAL[estadoGeneral(e)], fecha(e.fechaUltimoMov), e.sectorActual || "", e.agente || "",
      fecha(e.vencOfertas), e.inicioServicio || "", e.montos || "", e.observaciones || "", e.enPlanObras ? "SI (PLAN DE OBRAS)" : e.prioritario ? "SI" : "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws["!cols"] = [14, 12, 40, 30, 30, 14, 10, 8, 18, 18, 14, 12, 16, 8, 12, 16, 18, 50, 12].map(wch => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Resoluciones");
  XLSX.writeFile(wb, "resoluciones-" + (solapa === "general" ? "" : solapa + "-") + hoyLocalISO() + ".xlsx");
}

// Sistema del sector de Resoluciones: la planilla de seguimiento de
// expedientes, sin conexión con el resto de la app.
export default function PanelResoluciones({ sesion, mostrarToast, solapaInicial, abrirId }) {
  // La jefa de la Subdirección asigna agentes y marca prioridades.
  const esJefa = sesion.email === EMAIL_JEFA_SUBDIRECCION;
  const [expedientes, setExpedientes] = useState(null);
  const [f, setF] = useState(filtroVacio);
  const [solapa, setSolapa] = useState(solapaInicial || "general");
  // null | "nuevo" | id del expediente (`abrirId`: llega desde un aviso)
  const [form, setForm] = useState(abrirId || null);
  // Pasar un finalizado a trámite desde la tabla: se pregunta si reingresó.
  const [consultaReingreso, setConsultaReingreso] = useState(null);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(OPCIONES_POR_PAGINA[0]);
  // Columnas que cada uno ocultó con la flechita del encabezado (quedan
  // guardadas en este navegador).
  const [ocultas, setOcultas] = useState([]);
  useEffect(() => {
    try { setOcultas(JSON.parse(localStorage.getItem(CLAVE_OCULTAS)) || []); } catch {}
  }, []);
  function cambiarOcultas(nuevas) {
    setOcultas(nuevas);
    try { localStorage.setItem(CLAVE_OCULTAS, JSON.stringify(nuevas)); } catch {}
  }
  // Cambiar un filtro o la solapa vuelve a la primera página.
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); setPagina(0); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  // Carga al montar y cada vez que la campana avisa que la jefa cambió
  // algo (EVENTO_CAMBIOS_RESOLUCIONES); filtros y solapa se mantienen.
  useEffect(() => {
    let activo = true;
    // esRecarga: ya había lista (si falla, queda la que estaba); conAviso:
    // avisa que la jefa hizo cambios (cuando lo dice la campana).
    async function cargar(esRecarga, conAviso = esRecarga) {
      try {
        const res = await fetch("/api/resoluciones");
        // Si el servidor falla sin respuesta, el cuerpo viene vacío.
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (activo) {
          setExpedientes(data.expedientes || []);
          if (conAviso) mostrarToast("La jefa de la Subdirección hizo cambios: planilla actualizada");
        }
      } catch (err) {
        if (activo && !esRecarga) { setExpedientes([]); mostrarToast(err.message || "No se pudieron cargar los expedientes"); }
      }
    }
    const alCambiar = () => cargar(true);
    cargar(false);
    window.addEventListener(EVENTO_CAMBIOS_RESOLUCIONES, alCambiar);

    // Cambios de otros (u otra pestaña): cada 15 segundos, con la ventana a
    // la vista, se pregunta la "versión" de la planilla (liviano) y solo si
    // cambió se recarga la lista, sin aviso y manteniendo filtros y solapa.
    // Al volver a la ventana se pregunta enseguida.
    let version = null;
    async function revisar() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/resoluciones/version", { cache: "no-store" });
        if (!res.ok) return;
        const { version: actual } = await res.json();
        if (version !== null && actual !== version && activo) await cargar(true, false);
        version = actual;
      } catch {
        // Sin conexión: se reintenta en la próxima vuelta.
      }
    }
    revisar();
    const intervalo = setInterval(revisar, 15000);
    document.addEventListener("visibilitychange", revisar);
    return () => {
      activo = false;
      window.removeEventListener(EVENTO_CAMBIOS_RESOLUCIONES, alCambiar);
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", revisar);
    };
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
    };
  }, [lista]);

  const solapas = SOLAPAS.filter(s => !s.soloJefa || esJefa);
  const deLaSolapa = useMemo(() => lista.filter(SOLAPAS.find(s => s.id === solapa).incluye), [lista, solapa]);
  const filas = useMemo(() => deLaSolapa.filter(e => {
    if (f.exp && !norm(e.exp + " " + (e.numero || "")).includes(norm(expParaBuscar(f.exp)))) return false;
    if (f.objeto && !norm(e.objeto + " " + (e.observaciones || "")).includes(norm(f.objeto))) return false;
    if (f.organismo && !norm(e.organismo).includes(norm(f.organismo))) return false;
    for (const campo of ["fuero", "tipoContratacion", "tipoResolucion", "estado", "sectorActual"]) {
      if (f[campo] && e[campo] !== f[campo]) return false;
    }
    // Botones de agente: SIN_AGENTE son los que no tienen asignado.
    if (f.agente && (f.agente === SIN_AGENTE ? String(e.agente || "").trim() : e.agente !== f.agente)) return false;
    if (f.situacion && estadoGeneral(e) !== f.situacion) return false;
    return true;
  }).sort(SOLAPAS.find(s => s.id === solapa).comparar || compararResoluciones), [deLaSolapa, f, solapa]);

  // Si la lista se achica (otro filtro, un expediente que cambia de
  // solapa), la página no queda fuera de rango.
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
      ? await enviar("/api/resoluciones/" + seleccionado.id, "PUT", datos)
      : await enviar("/api/resoluciones", "POST", datos);
    if (data.error) return data;
    setExpedientes(prev => seleccionado ? prev.map(e => (e.id === data.expediente.id ? data.expediente : e)) : [...prev, data.expediente]);
    setForm(null);
    mostrarToast(seleccionado ? "Expediente actualizado" : "Expediente " + data.expediente.exp + " cargado");
  }

  // Cambio rápido desde la tabla: sector actual, tipo de resolución o
  // estado (cualquiera; queda en el historial), asignación o prioridad
  // (solo la jefa).
  async function cambiarRapido(e, cambios) {
    // Se muestra al instante; si el servidor lo rechaza, se vuelve atrás.
    const anteriores = Object.fromEntries(Object.keys(cambios).map(k => [k, e[k]]));
    setExpedientes(prev => prev.map(x => (x.id === e.id ? { ...x, ...cambios } : x)));
    const data = await enviar("/api/resoluciones/" + e.id, "PATCH", cambios);
    if (data.error) {
      setExpedientes(prev => prev.map(x => (x.id === e.id ? { ...x, ...anteriores } : x)));
      mostrarToast(data.error);
      return;
    }
    setExpedientes(prev => prev.map(x => (x.id === data.expediente.id ? data.expediente : x)));
    const [campo, valor] = Object.entries(cambios)[0];
    if (cambios.reingreso) { mostrarToast(e.exp + ": " + (data.expediente.observaciones || "reingreso")); return; }
    mostrarToast(campo === "prioritario"
      ? (valor ? e.exp + " marcado como prioritario" : e.exp + " ya no es prioritario")
      : campo === "agente"
        ? e.exp + " asignado a " + (valor || "nadie")
        : e.exp + ": " + ETIQUETA_CAMPO[campo] + " → " + (valor || "sin definir"));
  }

  // Corregir una observación (texto) o borrar un registro (null) del historial del
  // expediente abierto.
  async function cambiarMovimiento(movId, texto) {
    const url = "/api/resoluciones/" + seleccionado.id + "/movimientos/" + movId;
    const data = texto === null ? await enviar(url, "DELETE") : await enviar(url, "PATCH", { texto });
    if (data.error) return data;
    setExpedientes(prev => prev.map(e => (e.id === data.expediente.id ? data.expediente : e)));
    mostrarToast(texto === null ? "Eliminado del historial" : "Observación corregida");
    return data;
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

  // Columnas de la tabla: título, filtro (segunda fila del encabezado) y celda.
  const editable = esJefa ? undefined : ev => ev.stopPropagation();
  const columnas = [
    { t: "Exp.", w: "w-[130px]", filtro: <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} />,
      celda: e => (
        <td className="py-2.5 px-3 whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            {esJefa && <EstrellaPrioridad prioritario={e.prioritario} onClick={() => cambiarRapido(e, { prioritario: !e.prioritario })} />}
            <span className="font-mono font-semibold text-slate-900">{e.exp}</span>
          </div>
          <EtiquetasPrioridad expediente={e} />
          <EtiquetaPrestamo expediente={e} />
        </td>
      ) },
    { t: "Objeto", w: "w-[240px]", filtro: <input value={f.objeto} onChange={e => set("objeto", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} />,
      celda: e => <td className="py-2.5 px-3"><span className="line-clamp-2" title={e.objeto}>{e.objeto}</span></td> },
    { t: "Fuero", w: "w-[200px]", filtro: <FiltroColumna valor={f.fuero} etiqueta="Todos" opciones={opciones.fuero} onChange={v => set("fuero", v)} />,
      celda: e => <td className="py-2.5 px-3">{e.fuero || "-"}</td> },
    { t: "Organismo", w: "w-[200px]", filtro: <input value={f.organismo} onChange={e => set("organismo", e.target.value)} placeholder="Buscar" className={CLASE_INPUT} />,
      celda: e => <td className="py-2.5 px-3"><span className="line-clamp-2" title={e.organismo || ""}>{e.organismo || "-"}</span></td> },
    { t: "Tipo de contratación", w: "w-[130px]", filtro: <FiltroColumna valor={f.tipoContratacion} etiqueta="Todos" opciones={opciones.tipoContratacion} onChange={v => set("tipoContratacion", v)} />,
      celda: e => <td className="py-2.5 px-3 whitespace-nowrap">{e.tipoContratacion || "-"}</td> },
    { t: "Número",
      celda: e => <td className="py-2.5 px-3 whitespace-nowrap">{e.numero || "-"}</td> },
    // Días en el sector con el semáforo (la fecha de ingreso, en la ficha).
    { t: "Días en sector",
      celda: e => {
        const dias = diasEnSector(e);
        return (
          <td className="py-2.5 px-3">
            {dias != null ? (
              <span className={"text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} día{dias !== 1 ? "s" : ""}</span>
            ) : "-"}
          </td>
        );
      } },
    { t: "Tipo de resolución", w: "w-[150px]", filtro: <FiltroColumna valor={f.tipoResolucion} etiqueta="Todos" opciones={opciones.tipoResolucion} onChange={v => set("tipoResolucion", v)} />,
      celda: e => (
        <td className="py-2.5 px-3" onClick={editable}>
          {esJefa ? (e.tipoResolucion || "-") : <SelectRapido valor={e.tipoResolucion} opciones={TIPOS_RESOLUCION} onChange={v => cambiarRapido(e, { tipoResolucion: v })} />}
        </td>
      ) },
    { t: "Estado", w: "w-[160px]", filtro: <FiltroColumna valor={f.estado} etiqueta="Todos" opciones={opciones.estado} onChange={v => set("estado", v)} />,
      celda: e => (
        <td className="py-2.5 px-3" onClick={editable}>
          {esJefa ? (e.estado || "-") : <SelectRapido valor={e.estado} opciones={ESTADOS_RESOLUCION} onChange={v => cambiarRapido(e, { estado: v })} />}
        </td>
      ) },
    { t: "Último mov.",
      celda: e => <td className="py-2.5 px-3 whitespace-nowrap">{fecha(e.fechaUltimoMov)}</td> },
    { t: "Sector actual", w: "w-[150px]", filtro: <FiltroColumna valor={f.sectorActual} etiqueta="Todos" opciones={opciones.sectorActual} onChange={v => set("sectorActual", v)} />,
      celda: e => (
        <td className="py-2.5 px-3" onClick={editable}>
          {esJefa
            ? <span className="font-medium text-slate-900">{e.sectorActual || "-"}</span>
            : <SelectRapido valor={e.sectorActual} opciones={SECTORES_RESOLUCIONES} onChange={v => cambiarRapido(e, { sectorActual: v })} fuerte />}
        </td>
      ) },
    { t: "Venc. ofertas",
      celda: e => (
        <td className="py-2.5 px-3 whitespace-nowrap">
          {fecha(e.vencOfertas)}
          {e.renovacionAutomatica && e.renovacionDias > 0 && (
            <span className="block text-[10px] text-slate-500" title="Renovación automática">
              ↻ {e.renovacionDias} {e.renovacionHabiles ? "háb." : "corr."}
            </span>
          )}
        </td>
      ) },
    { t: "Inicio de serv.",
      celda: e => <td className="py-2.5 px-3">{e.inicioServicio || "-"}</td> },
    // Estado general (última columna): lo cambian Resoluciones y la jefa.
    { t: "Estado gral.", w: "w-[140px]", filtro: <FiltroColumna valor={f.situacion} etiqueta="Todos" opciones={ESTADOS_GENERALES} onChange={v => set("situacion", v)} />,
      celda: e => (
        <td className="py-2.5 px-3" onClick={ev => ev.stopPropagation()}>
          <SelectRapido valor={estadoGeneral(e)} opciones={ESTADOS_GENERALES} fuerte={esFinalizado(e)} className="min-w-[130px]"
            onChange={v => v && (esFinalizado(e) && v !== "FINALIZADO" ? setConsultaReingreso({ e, v }) : cambiarRapido(e, { situacion: v }))} />
        </td>
      ) },
  ];
  const visibles = columnas.filter(c => !ocultas.includes(c.t));

  return (
    <div className="space-y-4">
    <div className="flex items-center gap-1 border-b border-slate-200">
      {solapas.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => {
            setSolapa(s.id); setPagina(0);
            // Ahí no están los botones de agente: no queda un agente elegido escondido.
            if (["general", "finalizados"].includes(s.id)) setF(prev => ({ ...prev, agente: "" }));
          }}
          className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 " +
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
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
      {/* Arriba, en una fila: título, cantidad y botones. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
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
      {/* Debajo: qué muestra la solapa y cómo está ordenada. */}
      <p className="mt-2 text-xs text-slate-600"><span className="font-medium text-slate-700">Muestra:</span> {SOLAPAS.find(s => s.id === solapa).muestra}</p>
      <p className="text-xs text-slate-600"><span className="font-medium text-slate-700">Orden:</span> {SOLAPAS.find(s => s.id === solapa).orden}</p>
      {/* En General y Finalizados no hace falta filtrar por agente. */}
      {!["general", "finalizados"].includes(solapa) && (
        <BotonesAgente expedientes={deLaSolapa} elegido={f.agente} onElegir={v => set("agente", f.agente === v ? "" : v)} />
      )}
      {/* Las columnas ocultas, para volver a mostrarlas. */}
      {ocultas.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-medium text-slate-700">Columnas ocultas:</span>
          {columnas.filter(c => ocultas.includes(c.t)).map(c => (
            <button key={c.t} type="button" onClick={() => cambiarOcultas(ocultas.filter(t => t !== c.t))} title="Mostrar la columna"
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-300 bg-white text-slate-600 hover:border-slate-500 hover:text-slate-900">
              <ChevronRight size={11} /> {c.t}
            </button>
          ))}
          <button type="button" onClick={() => cambiarOcultas([])} className="font-medium text-slate-500 hover:text-slate-900 underline">Mostrar todas</button>
        </div>
      )}
      </div>

      <div className="overflow-x-auto">
        {/* El ancho mínimo baja a medida que se ocultan columnas. */}
        <table className="w-full text-sm" style={{ minWidth: visibles.length * 112 }}>
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              {visibles.map(c => (
                <th key={c.t} className="pt-2 px-3">
                  <div className="flex items-center gap-1">
                    {c.t}
                    {/* Con una sola visible no se puede ocultar más. */}
                    {visibles.length > 1 && (
                      <button type="button" onClick={() => cambiarOcultas([...ocultas, c.t])} title="Ocultar la columna"
                        className="p-0.5 rounded text-slate-400 hover:text-slate-900 hover:bg-slate-200/70">
                        <ChevronLeft size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              {visibles.map(c => c.filtro
                ? <th key={c.t} className={"py-2 px-3 align-top " + c.w}>{c.filtro}</th>
                : <th key={c.t} className="py-2 px-3" />)}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 ? (
              <tr><td colSpan={visibles.length} className="py-10 text-center text-sm text-slate-500">No hay expedientes con esos filtros.</td></tr>
            ) : filasPagina.map(e => (
              <tr key={e.id} onClick={() => setForm(e.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer align-top text-xs text-slate-700">
                {visibles.map(c => <Fragment key={c.t}>{c.celda(e)}</Fragment>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Paginacion total={filas.length} pagina={paginaActual} porPagina={porPagina}
        onPagina={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(0); }} />

      {consultaReingreso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setConsultaReingreso(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-semibold text-slate-900">¿Es un reingreso?</h3>
            <p className="text-sm text-slate-700">
              El expediente <span className="font-mono font-semibold">{consultaReingreso.e.exp}</span> estaba <b>Finalizado</b> y lo vas a pasar a <b>{ETIQUETA_ESTADO_GENERAL[consultaReingreso.v]}</b>.
            </p>
            <p className="text-sm text-slate-600">Si reingresó, la fecha de ingreso pasa a ser hoy y la observación queda como REINGRESO I (II, III...), con la fecha de ingreso anterior. Si fue un error de clic, vuelve sin dejar constancia.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConsultaReingreso(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button type="button" onClick={() => { const { e, v } = consultaReingreso; setConsultaReingreso(null); cambiarRapido(e, { situacion: v, reingreso: false }); }}
                className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50">No, fue un error</button>
              <button type="button" onClick={() => { const { e, v } = consultaReingreso; setConsultaReingreso(null); cambiarRapido(e, { situacion: v, reingreso: true }); }}
                className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Sí, es un reingreso</button>
            </div>
          </div>
        </div>
      )}

      {form && (form === "nuevo" || seleccionado) && (
        <FormularioResolucion
          key={form}
          inicial={seleccionado}
          esJefa={esJefa}
          expedientes={lista}
          onCerrar={() => setForm(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
          onCambiarMovimiento={cambiarMovimiento}
        />
      )}
    </div>
    </div>
  );
}
