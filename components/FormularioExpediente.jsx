"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AREA_LABEL, MODALIDADES_CONTRATACION, FUERZAS_SEGURIDAD, ENCUADRE_INTERADMINISTRATIVO, TIPOS_SERVICIOS, ZONAS, ESTADOS_CONVOCATORIA, SECTORES } from "@/lib/constants";
import { Campo_Input, Campo_Select } from "./CamposFormulario";
import SelectorOrganismos from "./SelectorOrganismos";
import CampoFuero from "./CampoFuero";
import BotonAccion from "./BotonAccion";
import { fechaMinimaRenovacion, fmtFecha } from "@/lib/utils";
function formVacio(esServicios) {
  return {
    exp: "", nombreCorto: "", nroContratacion: "", nroResolucion: "",
    area: esServicios ? "" : "Informatica", tipo: esServicios ? TIPOS_SERVICIOS[0] : "Servicios",
    agente: "", organismos: [], objeto: "",
    encuadre: "", presupuestoOficial: "", montoARS: "", montoUSD: "", fechaInicio: "", fechaVencimiento: "",
    fechaPublicacion: "", fechaApertura: "",
    ocResolucion: "", resolucionLlamado: "", resolucionAdjudicacion: "",
    adjudicatario: "", sector: "", etapa: "En ejecución", estadoGeneral: "Vigente",
    esPoliciaAdicional: false, fuerzaSeguridad: "",
    antecedenteExp: "",
    fuero: [], zona: ZONAS[0], codigoInterno: "",
    estadoConvocatoria: esServicios ? ESTADOS_CONVOCATORIA[0] : "",
    tieneProrroga: false,
  };
}

function normalizarInicial(inicial, esServicios) {
  if (!inicial) return formVacio(esServicios);
  return {
    ...formVacio(esServicios),
    ...inicial,
    organismos: Array.isArray(inicial.organismos)
      ? inicial.organismos
      : inicial.organismo ? [inicial.organismo] : [],
    fuero: Array.isArray(inicial.fuero)
      ? inicial.fuero
      : inicial.fuero ? [inicial.fuero] : [],
    esPoliciaAdicional: !!inicial.esPoliciaAdicional,
    fuerzaSeguridad: inicial.fuerzaSeguridad || "",
    tieneProrroga: !!inicial.tieneProrroga,
  };
}

export default function FormularioExpediente({ titulo, inicial, esNuevo, expedientes, departamentoSlug, onCerrar, onGuardar }) {
  const esServicios = departamentoSlug === "servicios";
  const [f, setF] = useState(() => normalizarInicial(inicial, esServicios));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

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
  const fechaMinima = coincidenciaAntecedente ? fechaMinimaRenovacion(coincidenciaAntecedente, expedientes) : null;
  const esVinculoAVigente = coincidenciaAntecedente?.rol === "vigente" || coincidenciaAntecedente?.rol === "parche";

  function handleAntecedenteExpChange(valor) {
    set("antecedenteExp", valor);
  }

  async function handleSubmit(e) {
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
    if (fechaMinima && f.fechaInicio && new Date(f.fechaInicio) < new Date(fechaMinima)) {
      setError("La fecha de inicio de la renovación no puede ser anterior al " + fmtFecha(fechaMinima) + " (cuando termina la cobertura vigente).");
      return;
    }
    setGuardando(true);
    await onGuardar({
      ...f,
      presupuestoOficial: Number(f.presupuestoOficial) || 0,
      montoARS: Number(f.montoARS) || 0,
      montoUSD: Number(f.montoUSD) || 0,
    });
    setGuardando(false);
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
            {!esServicios && (
              <Campo_Input label="Nombre corto" value={f.nombreCorto} onChange={v => set("nombreCorto", v)} placeholder="Ej: Limpieza edificio central" />
            )}
            <Campo_Input label="N° de contratación" value={esVinculoAVigente ? "" : f.nroContratacion} onChange={v => set("nroContratacion", v)} placeholder={esVinculoAVigente ? "Se completa al adjudicar" : "Ej: 45/2026"} disabled={esVinculoAVigente} />
            <Campo_Input label="N° de resolución" value={f.nroResolucion} onChange={v => set("nroResolucion", v)} placeholder="Ej: 1234/2026" />
            {!esServicios && (
              <Campo_Select label="Área" value={f.area} onChange={v => set("area", v)} opciones={["Informatica", "Varios"]} labels={AREA_LABEL} />
            )}
            <Campo_Select label="Tipo" value={f.tipo} onChange={v => set("tipo", v)}
              opciones={esServicios ? TIPOS_SERVICIOS : ["Servicios", "Provisiones", "Servicios Temporales"]} />
            <Campo_Input label="Agente" value={f.agente} onChange={v => set("agente", v)} placeholder="CB" />
            <div className="col-span-2">
              <SelectorOrganismos organismos={f.organismos} onChange={v => set("organismos", v)} />
            </div>
            <Campo_Select label="Sector actual" value={f.sector} onChange={v => set("sector", v)}
              opciones={["", ...SECTORES]} labels={{ "": "— Sin definir —" }} />
            <Campo_Select label="Zona" value={esVinculoAVigente ? (coincidenciaAntecedente.zona || "") : f.zona} onChange={v => set("zona", v)} opciones={ZONAS} disabled={esVinculoAVigente} />
            {esServicios && (
              <>
                <CampoFuero id="lista-fueros-form" organismos={f.organismos} fueros={f.fuero} onChange={v => set("fuero", v)} />
                <Campo_Input label="Código interno (planilla)" value={f.codigoInterno} onChange={v => set("codigoInterno", v)} placeholder="Ej: 02ID" />
                <Campo_Select label="Estado de convocatoria" value={f.estadoConvocatoria} onChange={v => set("estadoConvocatoria", v)}
                  opciones={["", ...ESTADOS_CONVOCATORIA]} labels={{ "": "— Sin definir —" }} />
              </>
            )}
            {f.tipoParche !== "Legítimo abono" && (
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
                      Hasta 3 meses. Se podrá activar más adelante desde la ficha del expediente si la
                      renovación se atrasa, sin necesidad de un expediente nuevo.
                    </span>
                  </span>
                </label>
              </div>
            )}
            {esNuevo && (
              <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-md p-3">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  N° de expediente antecedente (opcional)
                </label>
                <input
                  value={f.antecedenteExp || ""}
                  onChange={e => handleAntecedenteExpChange(e.target.value)}
                  placeholder="Ej: 13-05877/25"
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Si el número que cargás corresponde a un expediente <strong>Vigente</strong>, este nuevo
                  expediente entra como su <strong>Renovación en trámite</strong> — el vigente
                  sigue en ejecución hasta su vencimiento, no se reemplaza todavía. Si corresponde a un
                  expediente ya archivado o finalizado, este pasa a ser el <strong>Vigente</strong> de esa cadena.
                </p>
                {f.antecedenteExp && (
                  coincidenciaAntecedente
                    ? (
                      <>
                        <p className="text-[11px] text-emerald-700 mt-1">✓ Encontrado: {coincidenciaAntecedente.objeto}</p>
                        {fechaMinima && (
                          <p className="text-[11px] text-amber-700 mt-1">
                            La fecha de inicio no puede ser anterior al {fmtFecha(fechaMinima)}, cuando termina la
                            cobertura vigente{coincidenciaAntecedente.tieneProrroga && coincidenciaAntecedente.prorrogaActivada ? " (ya extendida por la prórroga activada)" : ""}.
                            Dejá las fechas vacías y completalas vos mismo. El vigente no cambia de estado;
                            N° de contratación, presupuesto y monto adjudicado quedan vacíos hasta que se
                            adjudique esta renovación.
                          </p>
                        )}
                      </>
                    )
                    : <p className="text-[11px] text-amber-700 mt-1">No se encontró ese número entre los expedientes cargados. Se guardará solo como referencia.</p>
                )}
              </div>
            )}
            <div className="col-span-2">
              <Campo_Input label="Objeto" value={f.objeto} onChange={v => set("objeto", v)} />
            </div>

            {!esServicios && (
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
            )}

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
            {f.tipoParche !== "Legítimo abono" && (
              <>
                <Campo_Input label="OC" value={f.ocResolucion} onChange={v => set("ocResolucion", v)} />
                <Campo_Input label="Resolución de llamado" value={f.resolucionLlamado} onChange={v => set("resolucionLlamado", v)} />
                <Campo_Input label="Resolución de adjudicación" value={f.resolucionAdjudicacion} onChange={v => set("resolucionAdjudicacion", v)} />
              </>
            )}
            <Campo_Input label="Adjudicatario" value={esVinculoAVigente ? "" : f.adjudicatario} onChange={v => set("adjudicatario", v)} placeholder={esVinculoAVigente ? "Se completa al adjudicar" : ""} disabled={esVinculoAVigente} />
            <Campo_Input label="Etapa" value={f.etapa} onChange={v => set("etapa", v)} />
            <Campo_Input label="Presupuesto oficial (ARS)" type="number" value={esVinculoAVigente ? "" : f.presupuestoOficial} onChange={v => set("presupuestoOficial", v)} disabled={esVinculoAVigente} />
            <Campo_Input label="Monto adjudicado (ARS)" type="number" value={esVinculoAVigente ? "" : f.montoARS} onChange={v => set("montoARS", v)} disabled={esVinculoAVigente} />
            <Campo_Input label="Monto adjudicado (USD)" type="number" value={esVinculoAVigente ? "" : f.montoUSD} onChange={v => set("montoUSD", v)} disabled={esVinculoAVigente} />
            <Campo_Input label="Fecha de inicio" type="date" value={f.fechaInicio} onChange={v => set("fechaInicio", v)} />
            <Campo_Input label="Fecha de vencimiento" type="date" value={f.fechaVencimiento} onChange={v => set("fechaVencimiento", v)} />
            <Campo_Input label="Fecha de publicación" type="date" value={f.fechaPublicacion} onChange={v => set("fechaPublicacion", v)} />
            <Campo_Input label="Fecha de apertura" type="date" value={f.fechaApertura} onChange={v => set("fechaApertura", v)} />
            <Campo_Select label="Estado general" value={f.estadoGeneral} onChange={v => set("estadoGeneral", v)}
              opciones={["Vigente", "En trámite de renovación", "Finalizado", "Archivado"]} />
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} disabled={guardando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <BotonAccion type="submit" cargando={guardando} className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Guardar expediente
            </BotonAccion>
          </div>
        </form>
      </div>
    </div>
  );
}

