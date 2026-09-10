"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TIPOS_SERVICIOS, ZONAS, ESTADOS_CONVOCATORIA, SECTOR_INICIAL_POR_DEPARTAMENTO } from "@/lib/constants";
import { Campo_Input, Campo_Select } from "./CamposFormulario";
import SelectorOrganismos from "./SelectorOrganismos";
import CampoFuero from "./CampoFuero";
import CampoDomiciliosRenglones from "./CampoDomiciliosRenglones";
import BotonAccion from "./BotonAccion";
import { fechaMinimaRenovacion, fmtFecha } from "@/lib/utils";

function formVacio(esServicios, departamentoSlug) {
  return {
    exp: "",
    tipo: esServicios ? TIPOS_SERVICIOS[0] : "Servicios",
    agente: "",
    organismos: [],
    sector: SECTOR_INICIAL_POR_DEPARTAMENTO[departamentoSlug] || "",
    zona: ZONAS[0],
    fuero: [],
    estadoConvocatoria: esServicios ? ESTADOS_CONVOCATORIA[0] : "",
    objeto: "",
    etapa: "En ejecución",
    fechaInicio: "",
    fechaVencimiento: "",
    estadoGeneral: "En trámite de renovación",
    antecedenteExp: "",
    domiciliosRenglones: [],
  };
}

// Carátula: alta rápida de un expediente con lo mínimo para abrirlo. El resto
// de los campos (N° de contratación, encuadre, montos, policía adicional,
// prórroga, etc.) se completan después desde "Editar expediente" en la ficha.
export default function CaratularExpediente({ departamentoSlug, expedientes, onCerrar, onGuardar }) {
  const esServicios = departamentoSlug === "servicios";
  const [f, setF] = useState(() => formVacio(esServicios, departamentoSlug));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  const coincidenciaAntecedente = f.antecedenteExp && expedientes
    ? expedientes.find(e => e.exp.trim().toLowerCase() === f.antecedenteExp.trim().toLowerCase())
    : null;
  const fechaMinima = coincidenciaAntecedente ? fechaMinimaRenovacion(coincidenciaAntecedente, expedientes) : null;

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
    if (fechaMinima && f.fechaInicio && new Date(f.fechaInicio) < new Date(fechaMinima)) {
      setError("La fecha de inicio de la renovación no puede ser anterior al " + fmtFecha(fechaMinima) + " (cuando termina la cobertura vigente).");
      return;
    }
    setGuardando(true);
    await onGuardar(f);
    setGuardando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Caratular expediente</h2>
            <p className="text-xs text-slate-500 mt-0.5">Alta rápida. El resto de los datos se completa después desde la ficha.</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="col-span-2 ">
            <Campo_Input label="Objeto" value={f.objeto} onChange={v => set("objeto", v)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Campo_Input label="N° de expediente" value={f.exp} onChange={v => set("exp", v)} placeholder="13-00000/26" />
            <Campo_Select label="Tipo" value={f.tipo} onChange={v => set("tipo", v)}
              opciones={esServicios ? TIPOS_SERVICIOS : ["Servicios", "Provisiones", "Servicios Temporales"]} />
            <Campo_Input label="Agente" value={f.agente} onChange={v => set("agente", v)} placeholder="CB" />
            <Campo_Select label="Zona" value={f.zona} onChange={v => set("zona", v)} opciones={ZONAS} />

            <div className="col-span-2">
              <SelectorOrganismos organismos={f.organismos} onChange={v => set("organismos", v)} />
            </div>

            <div className="col-span-2">
              <CampoDomiciliosRenglones valores={f.domiciliosRenglones} onChange={v => set("domiciliosRenglones", v)} />
            </div>

            {esServicios && (
              <CampoFuero id="lista-fueros-caratular" organismos={f.organismos} fueros={f.fuero} onChange={v => set("fuero", v)} />
            )}

            <Campo_Input label="Fecha de inicio" type="date" value={f.fechaInicio} onChange={v => set("fechaInicio", v)} />
            <Campo_Input label="Fecha de vencimiento" type="date" value={f.fechaVencimiento} onChange={v => set("fechaVencimiento", v)} />

            <div className="col-span-3 bg-slate-50 border border-slate-200 rounded-md p-3">
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
                Si corresponde a un expediente <strong>Vigente</strong>, esta carátula entra como su
                <strong> Renovación en trámite</strong>. Si es un antecedente ya cerrado, pasa a ser el
                <strong> Vigente</strong> de esa cadena.
              </p>
              {f.antecedenteExp && (
                coincidenciaAntecedente
                  ? (
                    <>
                      <p className="text-[11px] text-emerald-700 mt-1">✓ Encontrado: {coincidenciaAntecedente.objeto}</p>
                      {fechaMinima && (
                        <p className="text-[11px] text-amber-700 mt-1">
                          La fecha de inicio no puede ser anterior al {fmtFecha(fechaMinima)}, cuando termina la
                          cobertura vigente. Dejá las fechas vacías y completalas vos mismo. N° de contratación,
                          presupuesto y monto adjudicado quedan vacíos hasta adjudicar la renovación.
                        </p>
                      )}
                    </>
                  )
                  : <p className="text-[11px] text-amber-700 mt-1">No se encontró ese número entre los expedientes cargados. Se guardará solo como referencia.</p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onCerrar} disabled={guardando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
              Cancelar
            </button>
            <BotonAccion type="submit" cargando={guardando} cargandoTexto="Caratulando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Caratular expediente
            </BotonAccion>
          </div>
        </form>
      </div>
    </div>
  );
}
