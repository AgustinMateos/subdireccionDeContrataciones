"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { fmtFechaHora } from "@/lib/utils";
import BotonAccion from "./BotonAccion";

// Se abre desde el botón que aparece en la tabla de Aperturas una vez
// transcurrida la fecha y hora de apertura. Si no se presentaron ofertas, la
// convocatoria queda Desierta y se habilita el relanzamiento desde la ficha
// (mismo N° de expediente, distinto N° de contratación) — si esa segunda
// convocatoria también queda desierta, no hay más relanzamientos: el
// siguiente intento es un expediente nuevo por el alta normal.
export default function ResolverApertura({ exp, onCerrar, onResolver }) {
  const [cargando, setCargando] = useState(false);

  async function responder(huboOfertas) {
    setCargando(true);
    await onResolver(exp, huboOfertas);
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">¿Se presentaron ofertas?</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-slate-600">
            La apertura del expediente <span className="font-mono font-medium text-slate-900">{exp.exp}</span>
            {exp.nombreCorto ? " (" + exp.nombreCorto + ")" : ""} fue el{" "}
            <span className="font-medium text-slate-800">{fmtFechaHora(exp.fechaApertura)}</span>.
          </p>
          <p className="text-xs text-slate-500">
            Si no se presentó nadie, la convocatoria queda desierta y se va a poder relanzar una vez desde la ficha.
          </p>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={() => responder(false)}
            disabled={cargando}
            className="flex-1 px-4 py-2.5 rounded-md border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            No se presentaron
          </button>
          <BotonAccion
            onClick={() => responder(true)}
            cargando={cargando}
            cargandoTexto="Guardando..."
            className="flex-1 px-4 py-2.5 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            Sí, se presentaron
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
