"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TIPOS_PARCHE } from "@/lib/constants";
import BotonAccion from "./BotonAccion";
import { fmtFecha } from "@/lib/utils";

export default function GenerarParche({ exp, onCerrar, onConfirmar }) {
  const [f, setF] = useState({
    exp: "",
    tipoParche: TIPOS_PARCHE[0],
    objeto: exp.objeto || "",
    fechaInicio: "",
    fechaVencimiento: "",
    montoARS: "",
    detalleParche: "",
    ocResolucion: "",
    resolucionLlamado: "",
    resolucionAdjudicacion: "",
    tieneProrroga: false,
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const esLegitimoAbono = f.tipoParche === "Legítimo abono";

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  async function confirmar() {
    if (!f.exp || !f.objeto || !f.fechaVencimiento) {
      setError("Completá al menos N° de expediente, objeto y fecha de vencimiento.");
      return;
    }
    setCargando(true);
    await onConfirmar({
      ...f,
      montoARS: Number(f.montoARS) || 0,
      ocResolucion: esLegitimoAbono ? "" : f.ocResolucion,
      resolucionLlamado: esLegitimoAbono ? "" : f.resolucionLlamado,
      resolucionAdjudicacion: esLegitimoAbono ? "" : f.resolucionAdjudicacion,
      tieneProrroga: esLegitimoAbono ? false : f.tieneProrroga,
    });
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Generar parche / contratación puente</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            Cubre el período mientras no hay vigente ni renovación lista, vinculado a la misma cadena de
            <span className="font-mono font-medium text-slate-700"> {exp.exp}</span>. Se puede generar más de uno
            sucesivo si hace falta.
          </p>
          {esLegitimoAbono && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              El legítimo abono no lleva OC ni resoluciones de llamado/adjudicación.
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente</label>
              <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="13-00000/26"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de parche</label>
              <select value={f.tipoParche} onChange={e => set("tipoParche", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
                {TIPOS_PARCHE.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {!esLegitimoAbono && (
              <>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">OC</label>
                  <input value={f.ocResolucion} onChange={e => set("ocResolucion", e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Resolución de llamado</label>
                  <input value={f.resolucionLlamado} onChange={e => set("resolucionLlamado", e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Resolución de adjudicación</label>
                  <input value={f.resolucionAdjudicacion} onChange={e => set("resolucionAdjudicacion", e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                </div>
                <div className="col-span-2 border border-slate-200 rounded-md p-3 bg-slate-50">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.tieneProrroga}
                      onChange={e => set("tieneProrroga", e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
                    />
                    <span>
                      <span className="text-xs font-medium text-slate-700">Tiene opción de prórroga</span>
                      <span className="block text-[11px] text-slate-500 mt-0.5">
                        Hasta 3 meses, activable después desde la ficha si hace falta.
                      </span>
                    </span>
                  </label>
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Objeto</label>
              <input value={f.objeto} onChange={e => set("objeto", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div className="col-span-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              Período anterior ({exp.tipoParche || (exp.rol === "vigente" ? "Vigente" : exp.rol)}): {" "}
              <span className="font-medium text-slate-700">{fmtFecha(exp.fechaInicio)} — {fmtFecha(exp.fechaVencimiento)}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de inicio</label>
              <input type="date" value={f.fechaInicio} onChange={e => set("fechaInicio", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de vencimiento</label>
              <input type="date" value={f.fechaVencimiento} onChange={e => set("fechaVencimiento", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Monto (ARS)</label>
              <input type="number" value={f.montoARS} onChange={e => set("montoARS", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Detalle (opcional)</label>
              <input value={f.detalleParche} onChange={e => set("detalleParche", e.target.value)}
                placeholder="Ej: Sep y Octubre/26 - Notificada el 22/6/26"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Generando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Generar parche
            </BotonAccion>
          </div>
        </div>
      </div>
    </div>
  );
}
