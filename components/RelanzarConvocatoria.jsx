"use client";

import { useState } from "react";
import { X } from "lucide-react";
import BotonAccion from "./BotonAccion";

// Solo se muestra cuando el expediente ya está Desierta y todavía no se
// relanzó (ver condición en PaginaExpediente.jsx). Mismo N° de expediente
// (misma fila): mismo N° de contratación si el encuadre es descentralizado,
// uno nuevo en cualquier otro caso.
export default function RelanzarConvocatoria({ exp, onCerrar, onConfirmar }) {
  const esDescentralizada = (exp.encuadre || "").toLowerCase().includes("descentralizada");
  const [f, setF] = useState({ fechaPublicacion: "", fechaApertura: "", nroContratacion: "" });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  async function confirmar() {
    if (!f.fechaPublicacion || !f.fechaApertura) {
      setError("Completá la nueva fecha de publicación y de apertura.");
      return;
    }
    if (!esDescentralizada && !f.nroContratacion.trim()) {
      setError("Cargá el nuevo N° de contratación.");
      return;
    }
    setCargando(true);
    await onConfirmar({
      fechaPublicacion: f.fechaPublicacion,
      fechaApertura: f.fechaApertura,
      nroContratacion: esDescentralizada ? undefined : f.nroContratacion.trim(),
    });
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Relanzar convocatoria</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            El expediente <span className="font-mono font-medium text-slate-700">{exp.exp}</span> queda desierta,
            se relanza con el mismo N°. Esta es la única oportunidad de relanzarla — si vuelve a quedar desierta, no se
            puede volver a intentar.
          </p>

          {esDescentralizada ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              Contratación descentralizada: se mantiene el mismo N° de contratación
              (<span className="font-medium text-slate-700">{exp.nroContratacion || "sin definir"}</span>).
            </p>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nuevo N° de contratación</label>
              <input value={f.nroContratacion} onChange={e => set("nroContratacion", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nueva fecha de publicación</label>
              <input type="date" value={f.fechaPublicacion} onChange={e => set("fechaPublicacion", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nueva fecha y hora de apertura</label>
              <input type="datetime-local" value={f.fechaApertura} onChange={e => set("fechaApertura", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Relanzando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Relanzar
            </BotonAccion>
          </div>
        </div>
      </div>
    </div>
  );
}
