"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { SECTORES, MODALIDADES_CONTRATACION, PRORROGA_MESES_OPCIONES } from "@/lib/constants";
import BotonAccion from "./BotonAccion";
import SelectorMesesProrroga from "./SelectorMesesProrroga";

// Mismo comportamiento que "Movimiento de sector" en la ficha (ver
// FormObservacion en PaginaExpediente.jsx), como modal independiente para
// poder cambiar el sector desde otras pantallas (ej. la tabla de
// expedientes) sin tener que entrar a la ficha. Si el destino es DGP y
// todavía no está cargado el encuadre, lo pide acá mismo; si es Aperturas y
// faltan sus datos (fecha de publicación, fecha de apertura, presupuesto
// oficial, resolución de llamado, N° de contratación), también los pide
// antes de dejar confirmar.
export default function ModalCambiarSector({ exp, onCerrar, onConfirmar }) {
  const [sectorNuevo, setSectorNuevo] = useState(exp.sector || "");
  const [texto, setTexto] = useState("");
  const [fechaPublicacion, setFechaPublicacion] = useState(exp.fechaPublicacion || "");
  const [fechaApertura, setFechaApertura] = useState(exp.fechaApertura || "");
  const [presupuestoOficial, setPresupuestoOficial] = useState(exp.presupuestoOficial || "");
  const [resolucionLlamado, setResolucionLlamado] = useState(exp.resolucionLlamado || "");
  const [nroContratacion, setNroContratacion] = useState(exp.nroContratacion || "");
  const [encuadre, setEncuadre] = useState("");
  const [tieneProrroga, setTieneProrroga] = useState(!!exp.tieneProrroga);
  const [mesesProrroga, setMesesProrroga] = useState(exp.mesesProrroga || null);
  const [enviando, setEnviando] = useState(false);

  const vaAAperturas = sectorNuevo === "Aperturas";
  const vaADGP = sectorNuevo === "DGP";
  const necesitaEncuadre = vaADGP && !exp.encuadre;
  const faltaAperturas = vaAAperturas && (!fechaPublicacion || !fechaApertura || !presupuestoOficial || !resolucionLlamado.trim() || !nroContratacion.trim());
  const faltaProrroga = vaADGP && tieneProrroga && !PRORROGA_MESES_OPCIONES.includes(Number(mesesProrroga));
  const faltaDGP = (necesitaEncuadre && !encuadre) || faltaProrroga;

  async function confirmar() {
    if (!sectorNuevo.trim() || !texto.trim() || faltaAperturas || faltaDGP) return;
    setEnviando(true);
    await onConfirmar({
      tipo: "movimiento",
      texto: texto.trim(),
      sectorNuevo: sectorNuevo.trim(),
      ...(vaAAperturas ? { fechaPublicacion, fechaApertura, presupuestoOficial, resolucionLlamado: resolucionLlamado.trim(), nroContratacion: nroContratacion.trim() } : {}),
      ...(vaADGP ? { tieneProrroga, mesesProrroga: tieneProrroga ? mesesProrroga : null, ...(necesitaEncuadre ? { encuadre } : {}) } : {}),
    });
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Cambiar sector</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono font-medium text-slate-700">{exp.exp}</span> — actual: {exp.sector || "-"}
            </p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nuevo sector</label>
            <select value={sectorNuevo} onChange={e => setSectorNuevo(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
              <option value="">— Sin definir —</option>
              {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {vaAAperturas && (
            <div className="grid grid-cols-2 gap-2 bg-blue-50 border border-blue-100 rounded-md p-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha de publicación</label>
                <input type="date" value={fechaPublicacion} onChange={e => setFechaPublicacion(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-700" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Fecha y hora de apertura</label>
                <input type="datetime-local" value={fechaApertura} onChange={e => setFechaApertura(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-700" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Presupuesto oficial</label>
                <input type="number" value={presupuestoOficial} onChange={e => setPresupuestoOficial(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-700" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Resolución de llamado</label>
                <input value={resolucionLlamado} onChange={e => setResolucionLlamado(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-700" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">N° de contratación</label>
                <input value={nroContratacion} onChange={e => setNroContratacion(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-700" />
              </div>
            </div>
          )}

          {vaADGP && (
            <div className="bg-blue-50 border border-blue-100 rounded-md p-2.5 space-y-2">
              {necesitaEncuadre && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    Encuadre / modalidad de contratación (no está cargado)
                  </label>
                  <select value={encuadre} onChange={e => setEncuadre(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-700">
                    <option value="">— Elegir encuadre —</option>
                    {MODALIDADES_CONTRATACION.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input type="checkbox" checked={tieneProrroga} onChange={e => setTieneProrroga(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700" />
                Tiene opción de prórroga
              </label>
              {tieneProrroga && (
                <SelectorMesesProrroga value={mesesProrroga} onChange={setMesesProrroga} />
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Motivo del pase</label>
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Motivo del pase / detalle del movimiento..."
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onCerrar} disabled={enviando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <BotonAccion
            onClick={confirmar}
            cargando={enviando}
            cargandoTexto="Guardando..."
            disabled={!sectorNuevo.trim() || !texto.trim() || faltaAperturas || faltaDGP}
            title={faltaAperturas ? "Cargá fecha de publicación, fecha y hora de apertura, presupuesto oficial, resolución de llamado y N° de contratación"
              : faltaProrroga ? "Elegí cuántos meses de prórroga tiene el expediente"
              : necesitaEncuadre && !encuadre ? "Cargá el encuadre" : undefined}
            className="px-4 py-2 rounded-md bg-blue-700 text-white text-sm font-medium hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Registrar movimiento
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
