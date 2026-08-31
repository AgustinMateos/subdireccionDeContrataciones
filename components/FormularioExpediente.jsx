"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ORGANISMOS, AREA_LABEL } from "@/lib/constants";
export default function FormularioExpediente({ titulo, inicial, esNuevo, expedientes, onCerrar, onGuardar }) {
  const [f, setF] = useState(inicial || {
    exp: "", area: "Informatica", tipo: "Servicios", agente: "", organismo: "", objeto: "",
    encuadre: "", montoARS: "", montoUSD: "", fechaInicio: "", fechaVencimiento: "",
    ocResolucion: "", adjudicatario: "", sector: "", etapa: "En ejecución", estadoGeneral: "Vigente",
    antecedenteExp: "",
  });
  const [error, setError] = useState("");

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  const coincidenciaAntecedente = f.antecedenteExp && expedientes
    ? expedientes.find(e => e.exp.trim().toLowerCase() === f.antecedenteExp.trim().toLowerCase())
    : null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!f.exp || !f.objeto || !f.fechaVencimiento) {
      setError("Completá al menos N° de expediente, objeto y fecha de vencimiento.");
      return;
    }
    onGuardar({ ...f, montoARS: Number(f.montoARS) || 0, montoUSD: Number(f.montoUSD) || 0 });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{titulo}</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Campo_Input label="N° de expediente" value={f.exp} onChange={v => set("exp", v)} placeholder="13-00000/26" />
            <Campo_Select label="Área" value={f.area} onChange={v => set("area", v)} opciones={["Informatica", "Varios"]} labels={AREA_LABEL} />
            <Campo_Select label="Tipo" value={f.tipo} onChange={v => set("tipo", v)} opciones={["Servicios", "Provisiones", "Servicios Temporales"]} />
            <Campo_Input label="Agente" value={f.agente} onChange={v => set("agente", v)} placeholder="CB" />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Organismo</label>
              <input
                list="lista-organismos"
                value={f.organismo}
                onChange={e => set("organismo", e.target.value)}
                placeholder="Empezá a escribir o elegí de la lista"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
              <datalist id="lista-organismos">
                {ORGANISMOS.map(o => <option key={o} value={o} />)}
              </datalist>
            </div>
            <Campo_Input label="Sector actual" value={f.sector} onChange={v => set("sector", v)} />
            {esNuevo && (
              <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-md p-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  N° de expediente antecedente (opcional)
                </label>
                <input
                  value={f.antecedenteExp || ""}
                  onChange={e => set("antecedenteExp", e.target.value)}
                  placeholder="Ej: 13-05877/25"
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Si el número que cargás corresponde a un expediente <strong>Vigente</strong>, este nuevo
                  expediente entra como su <strong>Renovación / Prórroga en trámite</strong> — el vigente
                  sigue en ejecución hasta su vencimiento, no se reemplaza todavía. Si corresponde a un
                  expediente ya archivado o finalizado, este pasa a ser el <strong>Vigente</strong> de esa cadena.
                </p>
                {f.antecedenteExp && (
                  coincidenciaAntecedente
                    ? <p className="text-[11px] text-emerald-700 mt-1">✓ Encontrado: {coincidenciaAntecedente.objeto}</p>
                    : <p className="text-[11px] text-amber-700 mt-1">No se encontró ese número entre los expedientes cargados. Se guardará solo como referencia.</p>
                )}
              </div>
            )}
            <div className="col-span-2">
              <Campo_Input label="Objeto" value={f.objeto} onChange={v => set("objeto", v)} />
            </div>
            <Campo_Input label="Encuadre / tipo de contratación" value={f.encuadre} onChange={v => set("encuadre", v)} />
            <Campo_Input label="OC / Resolución" value={f.ocResolucion} onChange={v => set("ocResolucion", v)} />
            <Campo_Input label="Adjudicatario" value={f.adjudicatario} onChange={v => set("adjudicatario", v)} />
            <Campo_Input label="Etapa" value={f.etapa} onChange={v => set("etapa", v)} />
            <Campo_Input label="Monto $ (ARS)" type="number" value={f.montoARS} onChange={v => set("montoARS", v)} />
            <Campo_Input label="Monto USD" type="number" value={f.montoUSD} onChange={v => set("montoUSD", v)} />
            <Campo_Input label="Fecha de inicio" type="date" value={f.fechaInicio} onChange={v => set("fechaInicio", v)} />
            <Campo_Input label="Fecha de vencimiento" type="date" value={f.fechaVencimiento} onChange={v => set("fechaVencimiento", v)} />
            <Campo_Select label="Estado general" value={f.estadoGeneral} onChange={v => set("estadoGeneral", v)}
              opciones={["Vigente", "En trámite de renovación", "Finalizado", "Archivado"]} />
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
              Guardar expediente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Campo_Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
    </div>
  );
}

function Campo_Select({ label, value, onChange, opciones, labels }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
        {opciones.map(o => <option key={o} value={o}>{labels ? labels[o] : o}</option>)}
      </select>
    </div>
  );
}