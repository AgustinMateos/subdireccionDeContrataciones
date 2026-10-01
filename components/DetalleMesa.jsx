"use client";

import { useState } from "react";
import { X, ArrowRight, Pencil, Trash2 } from "lucide-react";
import { ALERTA_ESTILO } from "@/lib/constants";
import { alertaFrenado, fmtFecha, soloFechaLocal } from "@/lib/utils";
import { ultimoMovimiento, diasFrenadoMesa, fechaISO, hoyLocalISO, confirmacionMesa } from "@/lib/mesaEntradas";
import { Campo_Input } from "./CamposFormulario";
import { CampoSugerido } from "./FormularioMesa";
import BotonAccion from "./BotonAccion";

function Dato({ label, valor }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="text-sm text-slate-900">{valor || "-"}</div>
    </div>
  );
}

// Detalle de un expediente de Mesa de Entradas: la carátula, dónde está hoy
// y el historial de entradas/salidas, con el alta de un movimiento nuevo.
export default function DetalleMesa({ exp, sectores, puedeEditar, puedeEliminar, onCerrar, onMovimiento, onEditar, onEliminar }) {
  const actual = ultimoMovimiento(exp);
  const frenado = diasFrenadoMesa(exp);
  const confirmacion = confirmacionMesa(exp);
  const [mov, setMov] = useState(null); // formulario de movimiento abierto
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);

  function abrirMovimiento() {
    // Lo habitual es que salga del sector donde está hoy.
    setMov({ fecha: hoyLocalISO(), vieneDe: actual?.sector || "", sector: "", subsector: "", observacion: "" });
    setError("");
  }

  function setM(campo, valor) { setMov(prev => ({ ...prev, [campo]: valor })); setError(""); }

  async function guardarMovimiento() {
    if (!mov.fecha || !mov.sector.trim()) { setError("Completá la fecha y el sector."); return; }
    setGuardando(true);
    const res = await onMovimiento(mov);
    setGuardando(false);
    if (res?.error) setError(res.error); else setMov(null);
  }

  async function eliminar() {
    setGuardando(true);
    await onEliminar();
    setGuardando(false);
  }

  const historial = [...(exp.movimientos || [])].reverse();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="min-w-0">
            <div className="font-mono text-base font-semibold text-slate-900">{exp.exp}</div>
            <p className="text-sm text-slate-600 mt-0.5">{exp.objeto || "Sin carátula"}</p>
            {confirmacion && (
              <span className={"inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded border " +
                (confirmacion.confirmado ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800")}>
                {confirmacion.confirmado
                  ? "Confirmado en " + confirmacion.departamento + (confirmacion.por ? " por " + confirmacion.por : "") + " el " + fmtFecha(soloFechaLocal(confirmacion.fecha))
                  : "Pendiente de confirmar por " + confirmacion.departamento}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {puedeEditar && (
              <button onClick={onEditar} title="Editar carátula" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><Pencil size={16} /></button>
            )}
            {puedeEliminar && (
              <button onClick={() => setConfirmarEliminar(true)} title="Eliminar" className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={16} /></button>
            )}
            <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {confirmarEliminar && (
            <div className="border border-red-200 bg-red-50 rounded-md p-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-800">Este expediente y todos sus movimientos se borrarán definitivamente.</p>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => setConfirmarEliminar(false)} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium">Cancelar</button>
                <BotonAccion onClick={eliminar} cargando={guardando} cargandoTexto="Eliminando..."
                  className="px-3 py-1.5 rounded-md bg-red-700 text-white text-xs font-medium hover:bg-red-800">
                  Eliminar definitivamente
                </BotonAccion>
              </div>
            </div>
          )}

          {/* Dónde está hoy */}
          <div className="border border-slate-200 rounded-md p-4 bg-slate-50 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div>
              <div className="text-[11px] text-slate-500">Sector actual</div>
              <div className="text-sm font-semibold text-slate-900">
                {actual?.sector || "-"}{actual?.subsector ? " · " + actual.subsector : ""}
              </div>
            </div>
            <Dato label="Viene del sector" valor={actual?.vieneDe} />
            <Dato label="Fecha de ingreso" valor={actual?.fecha ? fmtFecha(fechaISO(actual.fecha)) : null} />
            <div>
              <div className="text-[11px] text-slate-500">Días frenado</div>
              {frenado != null ? (
                <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(frenado)]}>{frenado} días</span>
              ) : <span className="text-sm">-</span>}
            </div>
            {puedeEditar && !mov && (
              <button onClick={abrirMovimiento} className="ml-auto px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                Registrar movimiento
              </button>
            )}
          </div>

          {mov && (
            <div className="border border-slate-300 rounded-md p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nuevo movimiento</h3>
              <div className="grid grid-cols-4 gap-3">
                <Campo_Input label="Fecha de ingreso" type="date" value={mov.fecha} onChange={v => setM("fecha", v)} />
                <CampoSugerido label="Viene del sector" id="mov-viene" value={mov.vieneDe} onChange={v => setM("vieneDe", v)} opciones={sectores} />
                <CampoSugerido label="Sector" id="mov-sector" value={mov.sector} onChange={v => setM("sector", v)} opciones={sectores} />
                <CampoSugerido label="Subsector" id="mov-subsector" value={mov.subsector} onChange={v => setM("subsector", v)} opciones={sectores} />
              </div>
              <Campo_Input label="Observaciones" value={mov.observacion} onChange={v => setM("observacion", v)} />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setMov(null)} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50">Cancelar</button>
                <BotonAccion onClick={guardarMovimiento} cargando={guardando}
                  className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
                  Guardar movimiento
                </BotonAccion>
              </div>
            </div>
          )}

          {/* Carátula */}
          <div className="grid grid-cols-4 gap-x-4 gap-y-3">
            <Dato label="Sector que tramita" valor={exp.sectorTramita} />
            <Dato label="Agente" valor={exp.agente} />
            <Dato label="Tipo" valor={exp.tipo} />
            <Dato label="Tipo de contratación" valor={exp.tipoContratacion || exp.tipoContratacionSector} />
            <Dato label="Zona" valor={exp.zona} />
            <Dato label="Fecha de inicio" valor={exp.fechaInicio ? fmtFecha(fechaISO(exp.fechaInicio)) : null} />
            <Dato label="Fecha de vencimiento" valor={exp.fechaVencimiento ? fmtFecha(fechaISO(exp.fechaVencimiento)) : null} />
            <Dato label="Ingreso a la Subdirección" valor={exp.ingresoSubdireccion ? fmtFecha(fechaISO(exp.ingresoSubdireccion)) : null} />
            <div className="col-span-2"><Dato label="Fuero" valor={(exp.fuero || []).join(" · ")} /></div>
            <div className="col-span-2"><Dato label="Organismos" valor={(exp.organismos || []).join(" · ")} /></div>
            <div className="col-span-4"><Dato label="Domicilios / renglones" valor={(exp.domiciliosRenglones || []).join(" · ")} /></div>
            <Dato label="WD" valor={exp.wd} />
            <Dato label="R" valor={exp.r} />
          </div>

          {/* Historial */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Movimientos ({historial.length})</h3>
            {historial.length === 0 ? (
              <p className="text-sm text-slate-500">Sin movimientos registrados.</p>
            ) : (
              <ul className="space-y-2">
                {historial.map(m => (
                  <li key={m.id} className="border border-slate-200 rounded-md px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-500 w-20 shrink-0">{m.fecha ? fmtFecha(fechaISO(m.fecha)) : "Sin fecha"}</span>
                      <span className="text-slate-600">{m.vieneDe || "-"}</span>
                      <ArrowRight size={13} className="text-slate-400" />
                      <span className="font-medium text-slate-900">{m.sector}{m.subsector ? " · " + m.subsector : ""}</span>
                      <span className="ml-auto text-[11px] text-slate-400">{m.usuario}</span>
                    </div>
                    {m.observacion && <p className="text-xs text-slate-600 mt-1 whitespace-pre-line">{m.observacion}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
