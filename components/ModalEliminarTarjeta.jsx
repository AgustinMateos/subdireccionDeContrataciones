"use client";

import { useState } from "react";
import { X } from "lucide-react";
import BotonAccion from "./BotonAccion";

// Confirmación para borrar una tarjeta del listado (solo Soporte). En
// Servicios una tarjeta agrupa varios expedientes: se borran todos los que
// contiene, con sus observaciones y documentación.
export default function ModalEliminarTarjeta({ expedientes, onCerrar, onConfirmar }) {
  const [enviando, setEnviando] = useState(false);
  const varios = expedientes.length > 1;

  async function confirmar() {
    setEnviando(true);
    await onConfirmar(expedientes.map(e => e.id));
    setEnviando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={enviando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Eliminar tarjeta</h2>
          <button onClick={onCerrar} disabled={enviando} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-sm text-slate-700">
            Esta tarjeta se borrará definitivamente.
            {varios ? ` Se eliminarán los ${expedientes.length} expedientes que contiene` : " Se eliminará el expediente"}, con sus observaciones y documentación. No se puede deshacer.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {expedientes.map(e => (
              <span key={e.id} className="font-mono text-xs bg-red-50 border border-red-200 text-red-800 rounded px-2 py-0.5">{e.exp}</span>
            ))}
          </div>
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onCerrar} disabled={enviando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <BotonAccion
            onClick={confirmar}
            cargando={enviando}
            cargandoTexto="Eliminando..."
            className="px-4 py-2 rounded-md bg-red-700 text-white text-sm font-medium hover:bg-red-800 disabled:opacity-50"
          >
            Eliminar definitivamente
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
