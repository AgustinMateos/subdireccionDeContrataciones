"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PRORROGA_MESES_OPCIONES } from "@/lib/constants";
import { fmtFecha, sumarMesesISO } from "@/lib/utils";
import BotonAccion from "./BotonAccion";

// Unifica las dos formas de cubrir el período cuando la renovación no llega
// a tiempo: la habilita el organismo (extiende el mismo expediente, sin N°
// nuevo, se usa una sola vez) o la habilita el departamento (genera un
// expediente nuevo tipo "parche", se puede repetir). Se elige una vez
// abierto el modal en vez de tener dos botones separados en la ficha.
export default function GestionarProrroga({ exp, onCerrar, onActivarOrganismo, onHabilitarDepartamento }) {
  const [modo, setModo] = useState(null); // null | "organismo" | "departamento"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">
            {!modo ? "Gestionar prórroga" : modo === "organismo" ? "Prórroga habilitada por el organismo" : "Prórroga habilitada por el departamento"}
          </h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        {!modo && (
          <div className="p-6 space-y-3">
            <p className="text-xs text-slate-500 mb-1">
              Elegí quién habilita la prórroga de <span className="font-mono font-medium text-slate-700">{exp.exp}</span>.
            </p>
            <button
              type="button"
              disabled={exp.prorrogaActivada}
              onClick={() => setModo("organismo")}
              className="w-full text-left rounded-lg border border-slate-200 p-4 hover:border-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-slate-200"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">La habilita el organismo</span>
                {exp.prorrogaActivada && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 shrink-0">
                    Ya activada
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Extiende el vencimiento del mismo expediente ({exp.exp}), sin generar uno nuevo. Se usa una sola vez.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setModo("departamento")}
              className="w-full text-left rounded-lg border border-slate-200 p-4 hover:border-slate-400 transition-colors"
            >
              <span className="text-sm font-semibold text-slate-900">La habilita el departamento</span>
              <p className="text-xs text-slate-500 mt-1">
                Genera un expediente nuevo (parche), con su propio N° y resolución, asociado a {exp.exp}. Se puede repetir.
              </p>
            </button>
          </div>
        )}

        {modo === "organismo" && (
          <FormOrganismo exp={exp} onVolver={() => setModo(null)} onCerrar={onCerrar} onConfirmar={onActivarOrganismo} />
        )}
        {modo === "departamento" && (
          <FormDepartamento exp={exp} onVolver={() => setModo(null)} onCerrar={onCerrar} onConfirmar={onHabilitarDepartamento} />
        )}
      </div>
    </div>
  );
}

function FormOrganismo({ exp, onVolver, onCerrar, onConfirmar }) {
  const [meses, setMeses] = useState(null);
  const [fechaNotificacionProrroga, setFechaNotificacionProrroga] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const nuevaFechaVencimiento = meses ? sumarMesesISO(exp.fechaVencimiento, meses) : null;

  async function confirmar() {
    if (!meses) {
      setError("Elegí cuántos meses de prórroga vas a usar.");
      return;
    }
    setCargando(true);
    await onConfirmar({ nuevaFechaVencimiento, fechaNotificacionProrroga: fechaNotificacionProrroga || null });
    setCargando(false);
  }

  return (
    <div className="p-6">
      <p className="text-sm text-slate-600 mb-4">
        Se extiende la cobertura del expediente vigente
        <span className="font-mono font-medium text-slate-900"> {exp.exp}</span> (vence hoy el {fmtFecha(exp.fechaVencimiento)})
        sin generar un expediente nuevo. Quedará registrado como observación.
      </p>

      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        Meses de prórroga a usar (máximo {Math.max(...PRORROGA_MESES_OPCIONES)})
      </label>
      <div className="flex gap-1.5">
        {PRORROGA_MESES_OPCIONES.map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMeses(m); setError(""); }}
            className={"flex-1 text-sm font-medium px-3 py-2 rounded-md border transition-colors " +
              (meses === m ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}
          >
            {m} mes{m > 1 ? "es" : ""}
          </button>
        ))}
      </div>

      {nuevaFechaVencimiento && (
        <p className="text-xs text-slate-500 mt-3">
          Nuevo vencimiento: <span className="font-medium text-slate-800">{fmtFecha(nuevaFechaVencimiento)}</span>
        </p>
      )}

      <div className="mt-3">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Fecha de notificación de recepción de la resolución del organismo (opcional)
        </label>
        <input
          type="date"
          value={fechaNotificacionProrroga}
          onChange={e => setFechaNotificacionProrroga(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">{error}</p>}

      <div className="flex justify-between gap-2 mt-4">
        <button onClick={onVolver} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">← Volver</button>
        <div className="flex gap-2">
          <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Activando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
            Activar prórroga
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}

function FormDepartamento({ exp, onVolver, onCerrar, onConfirmar }) {
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

      <div className="flex justify-between gap-2 pt-2">
        <button onClick={onVolver} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">← Volver</button>
        <div className="flex gap-2">
          <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Generando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
            Habilitar prórroga
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
