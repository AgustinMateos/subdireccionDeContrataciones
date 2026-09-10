"use client";

import { useState } from "react";
import { ChevronRight, ChevronLeft, ArrowRight, FileText, MessageSquare, Pencil, Trash2, Shield, Clock } from "lucide-react";
import { AREA_ESTILO, AREA_LABEL, ESTADO_ESTILO, ALERTA_ESTILO, ALERTA_LABEL, ROL_LABEL, FUERZA_LABEL, UMBRAL_MODULOS_CAF, CHECKLIST_POLICIA_ADICIONAL, ESTADOS_CONVOCATORIA_FALLIDOS, SECTORES } from "@/lib/constants";
import { diasRestantes, alerta, alertaFrenado, fmtFecha, fmtMoneda, documentacionDeExpediente, diasFrenado } from "@/lib/utils";
export default function PaginaExpediente({ exp, expedientes, onVolver, onNavegar, onObservacion, onEditarObservacion, onEliminarObservacion, onDocumentacion, onEliminar, onEditar, onRenovar, onActivar, onActivarProrroga, onGenerarParche, puedeEditar, puedeEliminar, esJefe, moduloValor }) {
  const [verMasAntecedentes, setVerMasAntecedentes] = useState(false);
  const cadena = expedientes.filter(e => e.cadenaId === exp.cadenaId);
  const antecedentes = cadena.filter(e => e.rol === "antecedente")
    .sort((a, b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento));
  const antecedente = antecedentes[0];
  const antecedentesAnteriores = antecedentes.slice(1);
  const vigente = cadena.find(e => e.rol === "vigente");
  // Todos los parches se muestran en la línea de tiempo — a diferencia de los
  // antecedentes, nunca quedan ocultos detrás de un "ver más": si hubo que
  // cubrir el período varias veces, se tiene que ver.
  const parches = cadena.filter(e => e.rol === "parche");
  const renovacion = cadena.find(e => e.rol === "renovacion");
  // El orden de las tarjetas es siempre por fecha real, no por rol: un parche
  // cargado con fechas anteriores al vigente (o lo que sea) tiene que
  // aparecer antes en la línea, no fijo al final.
  const nodos = [
    antecedente && { key: "antecedente", label: ROL_LABEL.antecedente, item: antecedente },
    vigente && { key: "vigente", label: ROL_LABEL.vigente, item: vigente },
    ...parches.map(p => ({ key: p.id, label: p.tipoParche || ROL_LABEL.parche, item: p })),
    renovacion && { key: "renovacion", label: ROL_LABEL.renovacion, item: renovacion },
  ].filter(Boolean).sort((a, b) => {
    const fa = new Date(a.item.fechaInicio || a.item.fechaVencimiento);
    const fb = new Date(b.item.fechaInicio || b.item.fechaVencimiento);
    return fa - fb;
  });
  const dias = diasRestantes(exp.fechaVencimiento);
  const niv = alerta(dias);
  const frenado = diasFrenado(exp.observaciones, exp.creadoEn);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={onVolver} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ChevronLeft size={16} /> Volver a Expedientes
      </button>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="font-mono text-base font-semibold text-slate-900">{exp.exp}</div>
            {exp.nombreCorto && <div className="text-sm font-medium text-slate-700">{exp.nombreCorto}</div>}
            <div className="text-xs text-slate-500">{exp.rol === "parche" ? (exp.tipoParche || ROL_LABEL.parche) : ROL_LABEL[exp.rol]}</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {exp.area && (
              <span className={"text-[11px] font-semibold uppercase tracking-wide px-2 py-1 rounded " + AREA_ESTILO[exp.area]}>{AREA_LABEL[exp.area]}</span>
            )}
            <span className={"text-[11px] font-medium px-2 py-1 rounded border " + ESTADO_ESTILO[exp.estadoGeneral]}>{exp.estadoGeneral}</span>
            <span className={"text-[11px] font-medium px-2 py-1 rounded border " + ALERTA_ESTILO[niv]}>
              {dias >= 0 ? dias + " días restantes" : Math.abs(dias) + " días vencido"} · {ALERTA_LABEL[niv]}
            </span>
            {exp.esPoliciaAdicional && (
              <span className="text-[11px] font-semibold px-2 py-1 rounded border border-indigo-300 bg-indigo-50 text-indigo-800 flex items-center gap-1">
                <Shield size={11} /> Policía adicional{exp.fuerzaSeguridad ? " · " + (FUERZA_LABEL[exp.fuerzaSeguridad] || exp.fuerzaSeguridad) : ""}
              </span>
            )}
          </div>

          {exp.esPoliciaAdicional && exp.cotizacionPolicia && (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 mb-2">
                Cotización de módulos aprobada y vinculada
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Total módulos</div>
                  <div className="text-slate-800 font-medium">{Number(exp.cotizacionPolicia.totalModulos || 0).toLocaleString("es-AR")}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Costo total</div>
                  <div className="text-slate-800 font-medium">{fmtMoneda(exp.cotizacionPolicia.costoTotal)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Período</div>
                  <div className="text-slate-800 font-medium">
                    {fmtFecha(exp.cotizacionPolicia.periodo?.inicio)} — {fmtFecha(exp.cotizacionPolicia.periodo?.fin)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">Aprobada</div>
                  <div className="text-slate-800 font-medium">{fmtFecha(exp.cotizacionPolicia.aprobadoEn)}</div>
                </div>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Trazabilidad del expediente</h3>
            <div className="flex items-stretch gap-1 flex-wrap">
              {nodos.map((nodo, idx) => {
                const item = nodo.item;
                const activo = item && item.id === exp.id;
                const fallido = item && ESTADOS_CONVOCATORIA_FALLIDOS.includes(item.estadoConvocatoria);
                return (
                  <div key={nodo.key} className="flex items-center" style={{ minWidth: "9rem", flex: "1 1 9rem" }}>
                    <button
                      disabled={!item}
                      onClick={() => item && onNavegar(item.id)}
                      className={"flex-1 text-left rounded-lg border px-3 py-2.5 transition-colors " +
                        (!item ? "border-dashed border-slate-200 text-slate-300 cursor-default" :
                          fallido
                            ? (activo ? "border-red-900 bg-red-900 text-white" : "border-red-300 bg-red-50 text-red-800 hover:border-red-400")
                            : (activo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-400 text-slate-700"))}
                    >
                      <div className={"text-[10px] uppercase tracking-wide " + (fallido && !activo ? "text-red-500" : "opacity-70")}>{nodo.label}</div>
                      <div className="text-xs font-mono mt-0.5">{item ? item.exp : "No registrado"}</div>
                      {item && (
                        <div className={"text-[10px] mt-0.5 " + (activo ? (fallido ? "text-red-200" : "text-slate-300") : (fallido ? "text-red-500" : "text-slate-400"))}>
                          {fmtFecha(item.fechaInicio)} — {fmtFecha(item.fechaVencimiento)}
                        </div>
                      )}
                      {fallido && (
                        <div className={"text-[10px] font-semibold mt-0.5 " + (activo ? "text-red-100" : "text-red-700")}>
                          {item.estadoConvocatoria}
                        </div>
                      )}
                    </button>
                    {idx < nodos.length - 1 && <ChevronRight size={14} className="text-slate-300 shrink-0 mx-1" />}
                  </div>
                );
              })}
            </div>

            {antecedentesAnteriores.length > 0 && (
              <div className="mt-2">
                <button
                  onClick={() => setVerMasAntecedentes(v => !v)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline"
                >
                  {verMasAntecedentes ? "Ocultar" : "Ver más antecedentes"} ({antecedentesAnteriores.length})
                </button>
                {verMasAntecedentes && (
                  <div className="mt-2 space-y-1.5">
                    {antecedentesAnteriores.map(a => (
                      <button
                        key={a.id}
                        onClick={() => onNavegar(a.id)}
                        className="w-full flex items-center justify-between text-left rounded-md border border-slate-200 px-3 py-2 text-xs hover:border-slate-400"
                      >
                        <span className="font-mono text-slate-700">{a.exp}</span>
                        <span className="text-slate-400">{fmtFecha(a.fechaInicio)} — {fmtFecha(a.fechaVencimiento)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

          {(exp.rol === "vigente" || exp.rol === "parche") && exp.tieneProrroga && (
            <div className="flex items-center gap-2 text-xs">
              <span className={"font-medium px-2 py-1 rounded border flex items-center gap-1 " +
                (exp.prorrogaActivada ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800")}>
                <Clock size={11} /> {exp.prorrogaActivada ? "Prórroga activada" : "Con opción de prórroga"}
              </span>
              {!exp.prorrogaActivada && puedeEditar && (
                <button onClick={onActivarProrroga} className="text-[11px] font-medium text-slate-600 hover:text-slate-900 underline">
                  Activar prórroga
                </button>
              )}
            </div>
          )}
<div className="col-span-2">
  <Campo label="Objeto" valor={exp.objeto} /></div>
          <div className="grid grid-cols-4 gap-x-4 gap-y-3 text-sm">
            <Campo label="Tipo de expediente" valor={exp.tipo} />
            <Campo label="Agente" valor={exp.agente} />
            <Campo label="N° de contratación" valor={exp.nroContratacion} />
            <Campo label="N° de resolución" valor={exp.nroResolucion} />
            <Campo label={(exp.organismos || []).length > 1 ? "Organismos" : "Organismo"} valor={(exp.organismos || []).join(", ")} />
            <Campo label="Sector actual" valor={exp.sector} />
            {frenado != null && (
              <Campo label="Días frenado" valor={
                <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(frenado)]}>
                  {frenado + " día" + (frenado !== 1 ? "s" : "")}
                </span>
              } />
            )}
            <Campo label="Encuadre" valor={exp.encuadre} />
            <Campo label="OC" valor={exp.ocResolucion} />
            <Campo label="Resolución de llamado" valor={exp.resolucionLlamado} />
            <Campo label="Resolución de adjudicación" valor={exp.resolucionAdjudicacion} />
            <Campo label="Adjudicatario" valor={exp.adjudicatario} />
            <Campo label="Etapa" valor={exp.etapa} />
            <Campo label="Fecha inicio" valor={fmtFecha(exp.fechaInicio)} />
            <Campo label="Fecha vencimiento" valor={fmtFecha(exp.fechaVencimiento)} />
            <Campo label="Fecha de publicación" valor={fmtFecha(exp.fechaPublicacion)} />
            <Campo label="Fecha de apertura" valor={fmtFecha(exp.fechaApertura)} />
            <Campo label="Presupuesto oficial" valor={exp.presupuestoOficial ? fmtMoneda(exp.presupuestoOficial) : "-"} />
            <Campo label="Monto adjudicado" valor={fmtMoneda(exp.montoARS)} />
            <Campo label="Monto adjudicado USD" valor={exp.montoUSD ? fmtMoneda(exp.montoUSD, "USD") : "-"} />
            
          </div>

          {((exp.fuero || []).length > 0 || exp.zona || exp.codigoInterno || exp.estadoConvocatoria || exp.tipoParche) && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm border-t border-slate-100 pt-4">
              {exp.zona && <Campo label="Zona" valor={exp.zona} />}
              {(exp.fuero || []).length > 0 && <Campo label={exp.fuero.length > 1 ? "Fueros" : "Fuero"} valor={exp.fuero.join(", ")} />}
              {exp.codigoInterno && <Campo label="Código interno" valor={exp.codigoInterno} />}
              {exp.estadoConvocatoria && <Campo label="Estado de convocatoria" valor={exp.estadoConvocatoria} />}
              {exp.tipoParche && <Campo label="Tipo de parche" valor={exp.detalleParche ? exp.tipoParche + " — " + exp.detalleParche : exp.tipoParche} />}
            </div>
          )}

          <ChecklistDocumentacion exp={exp} onDocumentacion={onDocumentacion} puedeEditar={puedeEditar} moduloValor={moduloValor} />

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-1.5">
              <MessageSquare size={13} /> Observaciones y movimientos
            </h3>
            <div className="space-y-2 mb-3">
              {exp.observaciones.length === 0 && <p className="text-xs text-slate-400">Sin observaciones ni movimientos registrados.</p>}
              {exp.observaciones.map((o, i) => (
                <ItemObservacion
                  key={o.id ?? i}
                  obs={o}
                  expId={exp.id}
                  esJefe={esJefe}
                  onEditar={onEditarObservacion}
                  onEliminar={onEliminarObservacion}
                />
              ))}
            </div>
            {puedeEditar && <FormObservacion exp={exp} onObservacion={onObservacion} />}
          </div>
        </div>

        {puedeEditar && (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex flex-wrap gap-2">
            <button onClick={onEditar} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50">
              Editar expediente
            </button>
            {exp.rol === "vigente" && !renovacion && (
              <button onClick={onRenovar} className="px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                Crear renovación vinculada
              </button>
            )}
            {exp.rol === "renovacion" && (
              <button onClick={onActivar} className="px-3 py-2 rounded-md bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800">
                Activar como Vigente (venció el contrato anterior)
              </button>
            )}
            {(exp.rol === "vigente" || exp.rol === "parche") && (
              <button onClick={onGenerarParche} className="px-3 py-2 rounded-md border border-amber-300 bg-amber-50 text-amber-800 text-xs font-medium hover:bg-amber-100">
                Generar parche / contratación puente
              </button>
            )}
            {puedeEliminar && (
              <button onClick={() => onEliminar(exp.id)} className="ml-auto px-3 py-2 rounded-md border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50">
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistDocumentacion({ exp, onDocumentacion, puedeEditar, moduloValor }) {
  const [abierto, setAbierto] = useState(false);
  const documentacion = documentacionDeExpediente(exp);
  const completados = documentacion.filter(d => d.cargado).length;
  const total = documentacion.length;
  const porcentaje = total ? Math.round((completados / total) * 100) : 0;

  // Circuito de policía adicional: el paso de firmas define si interviene la
  // Unidad de Auditoría Interna o la Comisión de Administración y Financiera
  // según el presupuesto (adjudicado u oficial) contra 15.000 módulos.
  const itemAuditoria = CHECKLIST_POLICIA_ADICIONAL[7];
  const baseMonto = Math.max(Number(exp.montoARS) || 0, Number(exp.presupuestoOficial) || 0);
  const modulosEquivalentes = moduloValor ? baseMonto / moduloValor : 0;
  const requiereCAF = modulosEquivalentes >= UMBRAL_MODULOS_CAF;
  const umbralPesos = moduloValor ? UMBRAL_MODULOS_CAF * moduloValor : 0;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 flex items-center gap-1.5">
          <FileText size={13} /> Documentación del expediente (control de legalidad)
        </span>
        <span className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500">{completados}/{total} completos</span>
          <span className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <span
              className={"block h-full " + (porcentaje === 100 ? "bg-emerald-600" : "bg-amber-500")}
              style={{ width: porcentaje + "%" }}
            />
          </span>
          {abierto ? <ChevronLeft size={14} className="rotate-90 text-slate-400" /> : <ChevronRight size={14} className="rotate-90 text-slate-400" />}
        </span>
      </button>

      {abierto && (
        <div className="p-4 space-y-1.5">
          {documentacion.map((d, i) => (
            <div key={i}>
              <label
                className={"flex items-center gap-2.5 text-xs rounded-md px-2 py-1.5 " +
                  (puedeEditar ? "cursor-pointer hover:bg-slate-50" : "")}
              >
                <input
                  type="checkbox"
                  checked={d.cargado}
                  disabled={!puedeEditar}
                  onChange={() => onDocumentacion(exp.id, i)}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                />
                <span className={d.cargado ? "text-slate-700" : "text-slate-500"}>{d.item}</span>
              </label>
              {exp.esPoliciaAdicional && d.item === itemAuditoria && (
                <p className={"ml-8 text-[10px] mt-0.5 " + (requiereCAF ? "text-amber-700" : "text-slate-400")}>
                  {moduloValor
                    ? (requiereCAF
                        ? "Supera 15.000 módulos (" + fmtMoneda(umbralPesos) + ") → interviene la Comisión de Administración y Financiera."
                        : "No supera 15.000 módulos (" + fmtMoneda(umbralPesos) + ") → interviene la Unidad de Auditoría Interna.")
                    : "Definí el valor modular para calcular si corresponde CAF."}
                </p>
              )}
            </div>
          ))}
          <p className="text-[10px] text-slate-400 pt-1">
            {exp.esPoliciaAdicional
              ? "Circuito de legalidad para contrataciones de policía adicional (interadministrativas)."
              : "Checklist de referencia para el circuito de contrataciones, adaptable según el tipo de expediente."}
          </p>
        </div>
      )}
    </div>
  );
}

// Una fila del historial de observaciones/movimientos. Solo el jefe de
// departamento (esJefe) ve los controles de editar y eliminar.
function ItemObservacion({ obs, expId, esJefe, onEditar, onEliminar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(obs.texto);
  const [sectorNuevo, setSectorNuevo] = useState(obs.sectorNuevo || "");
  const esMovimiento = obs.tipo === "movimiento";
  const gestionable = esJefe && obs.id;

  function abrirEdicion() {
    setTexto(obs.texto);
    setSectorNuevo(obs.sectorNuevo || "");
    setEditando(true);
  }

  function guardar() {
    if (!texto.trim()) return;
    onEditar(expId, obs.id, {
      texto: texto.trim(),
      ...(esMovimiento ? { sectorNuevo: sectorNuevo.trim() } : {}),
    });
    setEditando(false);
  }

  function eliminar() {
    const rotulo = esMovimiento ? "este movimiento de sector" : "esta observación";
    if (window.confirm("¿Eliminar " + rotulo + "? Esta acción no se puede deshacer.")) {
      onEliminar(expId, obs.id);
    }
  }

  return (
    <div className={"rounded-md px-3 py-2 text-xs " + (esMovimiento ? "bg-blue-50 border border-blue-100" : "bg-slate-50")}>
      <div className="flex justify-between text-slate-500 mb-1">
        <span className="font-medium text-slate-700 flex items-center gap-1.5">
          {esMovimiento && <ArrowRight size={12} className="text-blue-600" />}
          {obs.usuario}
          {esMovimiento && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
              Movimiento
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <span>{fmtFecha(obs.fecha)}</span>
          {gestionable && !editando && (
            <>
              <button onClick={abrirEdicion} title="Editar" className="p-1 rounded hover:bg-white text-slate-400 hover:text-slate-800">
                <Pencil size={12} />
              </button>
              <button onClick={eliminar} title="Eliminar" className="p-1 rounded hover:bg-white text-slate-400 hover:text-red-700">
                <Trash2 size={12} />
              </button>
            </>
          )}
        </span>
      </div>

      {!editando ? (
        <>
          {esMovimiento && (
            <p className="text-blue-800 font-medium mb-1">
              Sector: {obs.sectorAnterior || "-"} → {obs.sectorNuevo}
            </p>
          )}
          <p className="text-slate-700">{obs.texto}</p>
        </>
      ) : (
        <div className="space-y-2 mt-1">
          {esMovimiento && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Sector destino</label>
              <select
                value={sectorNuevo}
                onChange={e => setSectorNuevo(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-700"
              >
                <option value="">— Sin definir —</option>
                {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <textarea
            value={texto}
            onChange={e => setTexto(e.target.value)}
            rows={2}
            className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
          <div className="flex gap-2">
            <button onClick={guardar} className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800">
              Guardar cambios
            </button>
            <button onClick={() => setEditando(false)} className="text-[11px] px-2.5 py-1 rounded-md border border-slate-300 font-medium hover:bg-white">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FormObservacion({ exp, onObservacion }) {
  const [tipo, setTipo] = useState("general");
  const [texto, setTexto] = useState("");
  const [sectorNuevo, setSectorNuevo] = useState(exp.sector || "");

  function enviar() {
    if (!texto.trim()) return;
    if (tipo === "movimiento" && !sectorNuevo.trim()) return;
    onObservacion(exp.id, { tipo, texto: texto.trim(), sectorNuevo: sectorNuevo.trim() });
    setTexto("");
    if (tipo === "movimiento") setSectorNuevo(sectorNuevo.trim());
  }

  return (
    <div className="border border-slate-200 rounded-md p-3 space-y-2.5 bg-white">
      <div className="flex gap-1.5">
        <button type="button" onClick={() => setTipo("general")}
          className={"flex-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors " +
            (tipo === "general" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}>
          Observación general
        </button>
        <button type="button" onClick={() => setTipo("movimiento")}
          className={"flex-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors flex items-center justify-center gap-1 " +
            (tipo === "movimiento" ? "bg-blue-700 text-white border-blue-700" : "border-slate-300 text-slate-600 hover:border-slate-500")}>
          <ArrowRight size={12} /> Movimiento de sector
        </button>
      </div>

      {tipo === "movimiento" && (
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Nuevo sector (actual: {exp.sector || "-"})
          </label>
          <select value={sectorNuevo} onChange={e => setSectorNuevo(e.target.value)}
            className="w-full text-xs border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-700">
            <option value="">— Sin definir —</option>
            {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={tipo === "movimiento" ? "Motivo del pase / detalle del movimiento..." : "Agregar una observación..."}
          className="flex-1 text-xs border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
        <button
          onClick={enviar}
          className={"text-xs px-3 py-2 rounded-md text-white font-medium " + (tipo === "movimiento" ? "bg-blue-700 hover:bg-blue-800" : "bg-slate-900 hover:bg-slate-800")}
        >
          {tipo === "movimiento" ? "Registrar movimiento" : "Agregar"}
        </button>
      </div>
    </div>
  );
}

function Campo({ label, valor }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-0.5">{label}</div>
      <div className="text-slate-800">{valor || "-"}</div>
    </div>
  );
}