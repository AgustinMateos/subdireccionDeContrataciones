"use client";

import { useState } from "react";
import { fmtFechaHora } from "@/lib/utils";
import BotonAccion from "./BotonAccion";

// Aviso automático que aparece al día siguiente de la fecha de apertura de
// una convocatoria (ver detección en Dashboard.jsx), preguntando si se
// presentaron ofertas. Si hay más de una pendiente, se muestran de a una.
export default function ResolverApertura({ exp, pendientes, onResolver }) {
  const [cargando, setCargando] = useState(false);

  async function responder(huboOfertas) {
    setCargando(true);
    await onResolver(exp, huboOfertas);
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">¿Se presentaron ofertas?</h2>
          {pendientes > 1 && (
            <p className="text-[11px] text-slate-400 mt-0.5">Quedan {pendientes} aperturas por resolver.</p>
          )}
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
