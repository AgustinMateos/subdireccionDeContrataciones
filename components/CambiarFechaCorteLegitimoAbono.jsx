"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { fmtFecha, sumarDiasISO } from "@/lib/utils";
import BotonAccion from "./BotonAccion";

// El legítimo abono, a diferencia de los demás parches, no tiene una fecha
// de corte fija — se puede finalizar en cualquier momento. Si se acorta, la
// renovación en trámite de la misma cadena arranca al día siguiente del
// nuevo corte (ver corrimiento en app/api/expedientes/[id]/route.js) — este
// modal solo pide la nueva fecha y avisa antes de confirmar.
export default function CambiarFechaCorteLegitimoAbono({ exp, renovacionEnTramite, onCerrar, onConfirmar }) {
  const [fechaVencimiento, setFechaVencimiento] = useState(exp.fechaVencimiento || "");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const nuevaFechaInicioRenovacion = fechaVencimiento ? sumarDiasISO(fechaVencimiento, 1) : null;

  async function confirmar() {
    if (!fechaVencimiento) {
      setError("Elegí la nueva fecha de corte.");
      return;
    }
    setCargando(true);
    await onConfirmar(fechaVencimiento);
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Cambiar fecha de corte</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            El legítimo abono <span className="font-mono font-medium text-slate-700">{exp.exp}</span> se puede
            finalizar en cualquier momento (vence hoy el {fmtFecha(exp.fechaVencimiento)}).
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Nueva fecha de corte</label>
            <input
              type="date"
              value={fechaVencimiento}
              onChange={e => { setFechaVencimiento(e.target.value); setError(""); }}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          {nuevaFechaInicioRenovacion && (
            renovacionEnTramite ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                El expediente en trámite de renovación <span className="font-mono font-medium">{renovacionEnTramite.exp}</span>{" "}
                va a iniciar el <span className="font-medium">{fmtFecha(nuevaFechaInicioRenovacion)}</span>.
              </p>
            ) : (
              <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                No hay una renovación en trámite en esta cadena para retrocederle la fecha de inicio.
              </p>
            )
          )}

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Guardando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Confirmar
            </BotonAccion>
          </div>
        </div>
      </div>
    </div>
  );
}
