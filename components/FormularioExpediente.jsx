"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ORGANISMOS, AREA_LABEL, MODALIDADES_CONTRATACION, FUERZAS_SEGURIDAD, ENCUADRE_INTERADMINISTRATIVO } from "@/lib/constants";
const FORM_VACIO = {
  exp: "", nombreCorto: "", nroContratacion: "", nroResolucion: "", area: "Informatica", tipo: "Servicios", agente: "", organismos: [], objeto: "",
  encuadre: "", presupuestoOficial: "", montoARS: "", montoUSD: "", fechaInicio: "", fechaVencimiento: "",
  ocResolucion: "", adjudicatario: "", sector: "", etapa: "En ejecución", estadoGeneral: "Vigente",
  esPoliciaAdicional: false, fuerzaSeguridad: "",
  antecedenteExp: "",
};

function normalizarInicial(inicial) {
  if (!inicial) return FORM_VACIO;
  return {
    ...inicial,
    organismos: Array.isArray(inicial.organismos)
      ? inicial.organismos
      : inicial.organismo ? [inicial.organismo] : [],
    esPoliciaAdicional: !!inicial.esPoliciaAdicional,
    fuerzaSeguridad: inicial.fuerzaSeguridad || "",
  };
}

export default function FormularioExpediente({ titulo, inicial, esNuevo, expedientes, onCerrar, onGuardar }) {
  const [f, setF] = useState(() => normalizarInicial(inicial));
  const [orgInput, setOrgInput] = useState("");
  const [error, setError] = useState("");

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  function agregarOrganismo() {
    const v = orgInput.trim();
    if (!v) return;
    if (!f.organismos.includes(v)) set("organismos", [...f.organismos, v]);
    setOrgInput("");
  }

  function quitarOrganismo(o) {
    set("organismos", f.organismos.filter(x => x !== o));
  }

  function togglePoliciaAdicional(activo) {
    setF(prev => ({
      ...prev,
      esPoliciaAdicional: activo,
      fuerzaSeguridad: activo ? prev.fuerzaSeguridad : "",
      encuadre: activo ? ENCUADRE_INTERADMINISTRATIVO : prev.encuadre,
    }));
  }

  const coincidenciaAntecedente = f.antecedenteExp && expedientes
    ? expedientes.find(e => e.exp.trim().toLowerCase() === f.antecedenteExp.trim().toLowerCase())
    : null;

  function handleSubmit(e) {
    e.preventDefault();
    if (!f.exp || !f.objeto || !f.fechaVencimiento) {
      setError("Completá al menos N° de expediente, objeto y fecha de vencimiento.");
      return;
    }
    if (f.organismos.length === 0) {
      setError("Agregá al menos un organismo.");
      return;
    }
    if (f.esPoliciaAdicional && !f.fuerzaSeguridad) {
      setError("Elegí la fuerza de seguridad para el expediente de policía adicional.");
      return;
    }
    onGuardar({
      ...f,
      presupuestoOficial: Number(f.presupuestoOficial) || 0,
      montoARS: Number(f.montoARS) || 0,
      montoUSD: Number(f.montoUSD) || 0,
    });
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
            <Campo_Input label="Nombre corto" value={f.nombreCorto} onChange={v => set("nombreCorto", v)} placeholder="Ej: Limpieza edificio central" />
            <Campo_Input label="N° de contratación" value={f.nroContratacion} onChange={v => set("nroContratacion", v)} placeholder="Ej: 45/2026" />
            <Campo_Input label="N° de resolución" value={f.nroResolucion} onChange={v => set("nroResolucion", v)} placeholder="Ej: 1234/2026" />
            <Campo_Select label="Área" value={f.area} onChange={v => set("area", v)} opciones={["Informatica", "Varios"]} labels={AREA_LABEL} />
            <Campo_Select label="Tipo" value={f.tipo} onChange={v => set("tipo", v)} opciones={["Servicios", "Provisiones", "Servicios Temporales"]} />
            <Campo_Input label="Agente" value={f.agente} onChange={v => set("agente", v)} placeholder="CB" />
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Organismos {f.organismos.length > 0 && <span className="text-slate-400">({f.organismos.length})</span>}
              </label>
              {f.organismos.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {f.organismos.map(o => (
                    <span key={o} className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full pl-2.5 pr-1 py-1 text-xs text-slate-700">
                      {o}
                      <button type="button" onClick={() => quitarOrganismo(o)} className="p-0.5 rounded-full hover:bg-slate-300 text-slate-500">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  list="lista-organismos"
                  value={orgInput}
                  onChange={e => setOrgInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); agregarOrganismo(); } }}
                  placeholder="Escribí o elegí de la lista y presioná Agregar"
                  className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
                <datalist id="lista-organismos">
                  {ORGANISMOS.map(o => <option key={o} value={o} />)}
                </datalist>
                <button type="button" onClick={agregarOrganismo} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50 shrink-0">
                  Agregar
                </button>
              </div>
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

            <div className="col-span-2 border border-slate-200 rounded-md p-3 bg-slate-50">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.esPoliciaAdicional}
                  onChange={e => togglePoliciaAdicional(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
                />
                <span>
                  <span className="text-xs font-medium text-slate-700">Contratación de policía adicional (interadministrativo)</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">
                    Fija el encuadre en "{ENCUADRE_INTERADMINISTRATIVO}", usa el circuito de legalidad
                    específico y suma el expediente al informe de policía adicional.
                  </span>
                </span>
              </label>
              {f.esPoliciaAdicional && (
                <div className="mt-3 sm:w-72">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fuerza de seguridad</label>
                  <select
                    value={f.fuerzaSeguridad}
                    onChange={e => set("fuerzaSeguridad", e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
                  >
                    <option value="">— Elegir fuerza —</option>
                    {FUERZAS_SEGURIDAD.map(fz => <option key={fz.key} value={fz.key}>{fz.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>

            <Campo_Select
              label="Encuadre / modalidad de contratación"
              value={f.encuadre || ""}
              onChange={v => set("encuadre", v)}
              disabled={f.esPoliciaAdicional}
              opciones={[
                "",
                ...MODALIDADES_CONTRATACION,
                ...(f.encuadre && !MODALIDADES_CONTRATACION.includes(f.encuadre) ? [f.encuadre] : []),
              ]}
              labels={{ "": "— Seleccionar —" }}
            />
            <Campo_Input label="OC / Resolución" value={f.ocResolucion} onChange={v => set("ocResolucion", v)} />
            <Campo_Input label="Adjudicatario" value={f.adjudicatario} onChange={v => set("adjudicatario", v)} />
            <Campo_Input label="Etapa" value={f.etapa} onChange={v => set("etapa", v)} />
            <Campo_Input label="Presupuesto oficial (ARS)" type="number" value={f.presupuestoOficial} onChange={v => set("presupuestoOficial", v)} />
            <Campo_Input label="Monto adjudicado (ARS)" type="number" value={f.montoARS} onChange={v => set("montoARS", v)} />
            <Campo_Input label="Monto adjudicado (USD)" type="number" value={f.montoUSD} onChange={v => set("montoUSD", v)} />
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
      <input type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
    </div>
  );
}

function Campo_Select({ label, value, onChange, opciones, labels, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 disabled:bg-slate-100 disabled:text-slate-500">
        {opciones.map(o => <option key={o} value={o}>{labels && labels[o] != null ? labels[o] : o}</option>)}
      </select>
    </div>
  );
}