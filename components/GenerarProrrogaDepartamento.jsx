"use client";

import { useState } from "react";
import { X } from "lucide-react";
import BotonAccion from "./BotonAccion";
import { fmtFecha } from "@/lib/utils";

// Prórroga habilitada por el DEPARTAMENTO (no por el organismo): a diferencia
// de la prórroga simple, ésta lleva su propio N° de expediente asociado al
// vigente. El encuadre/tipo de contratación es siempre el mismo de donde
// surge (el vigente) — no se elige. Siempre lleva N° de resolución; la
// orden de compra solo aplica si esa contratación no es descentralizada.
export default function GenerarProrrogaDepartamento({ exp, onCerrar, onConfirmar }) {
  const [f, setF] = useState({
    exp: "",
    objeto: exp.objeto || "",
    fechaInicio: "",
    fechaVencimiento: "",
    montoARS: "",
    nroResolucion: "",
    ocResolucion: "",
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const esDescentralizada = (exp.encuadre || "").toLowerCase().includes("descentralizada");

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  async function confirmar() {
    if (!exp.encuadre) {
      setError("El expediente de origen no tiene encuadre definido — cargalo primero desde \"Editar expediente\".");
      return;
    }
    if (!f.exp || !f.objeto || !f.fechaVencimiento) {
      setError("Completá al menos N° de expediente, objeto y fecha de vencimiento.");
      return;
    }
    if (!f.nroResolucion) {
      setError("Cargá el N° de resolución.");
      return;
    }
    if (!esDescentralizada && !f.ocResolucion) {
      setError("Esta modalidad requiere N° de orden de compra.");
      return;
    }
    setCargando(true);
    await onConfirmar({
      ...f,
      montoARS: Number(f.montoARS) || 0,
      ocResolucion: esDescentralizada ? "" : f.ocResolucion,
    });
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Habilitar prórroga (departamento)</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500">
            A diferencia de la prórroga que habilita el organismo, ésta lleva su propio N° de expediente, vinculado a
            <span className="font-mono font-medium text-slate-700"> {exp.exp}</span>.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente</label>
              <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="13-00000/26"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de contratación (del vigente)</label>
              <input value={exp.encuadre || "Sin encuadre definido"} disabled
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-slate-100 text-slate-500" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">N° de resolución</label>
              <input value={f.nroResolucion} onChange={e => set("nroResolucion", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            {!esDescentralizada && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">N° de orden de compra</label>
                <input value={f.ocResolucion} onChange={e => set("ocResolucion", e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
              </div>
            )}
            {esDescentralizada && (
              <p className="text-[11px] text-slate-500 self-end pb-2">La descentralizada no lleva orden de compra.</p>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Objeto</label>
              <input value={f.objeto} onChange={e => set("objeto", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div className="col-span-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              Período anterior ({exp.tipoParche || exp.tipoContratacionProrroga || (exp.rol === "vigente" ? "Vigente" : exp.rol)}): {" "}
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
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Generando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Habilitar prórroga
            </BotonAccion>
          </div>
        </div>
      </div>
    </div>
  );
}
