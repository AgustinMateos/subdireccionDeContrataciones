"use client";

import { useState } from "react";
import { MapPin, Clock, ChevronDown } from "lucide-react";
import { ALERTA_ESTILO, ESTADO_ESTILO, ROL_LABEL, PRORROGA_MESES_OPCIONES } from "@/lib/constants";
import { diasRestantes, alerta, fmtFecha, fmtMoneda, diasFrenado, alertaFrenado, estadoGeneralMostrado, esConvocatoriaFracasada } from "@/lib/utils";
import { direccionesDe } from "@/lib/organismosFueros";

// Varios expedientes de Servicios que son "la misma prestación" repetida
// (mismo tipo de servicio, mismo fuero y misma zona) con distinto N° de
// expediente se agrupan en una sola card, para no repetir la misma info una
// y otra vez en el listado.
const ROL_ORDEN = { antecedente: 0, vigente: 1, parche: 2, renovacion: 3 };

export default function TarjetaGrupoServicios({ grupo, todos, onVer }) {
  const { tipo, zona, fuero, organismos, items } = grupo;
  const direcciones = direccionesDe(organismos, fuero);
  const [abierto, setAbierto] = useState(false);
  // El acumulado de meses de prórroga vive en el vigente de la cadena, no en
  // el parche de departamento (ver Expediente.mesesProrrogaUsados).
  function vigenteDe(exp) {
    return (todos || []).find(e => e.cadenaId === exp.cadenaId && e.rol === "vigente");
  }
  function mesesProrrogaUsadosDe(exp) {
    return vigenteDe(exp)?.mesesProrrogaUsados || 0;
  }
  function mesesProrrogaTopeDe(exp) {
    return vigenteDe(exp)?.mesesProrroga || Math.max(...PRORROGA_MESES_OPCIONES);
  }
  // Subdivisiones de la card: cada trámite (cadena) va en su propio bloque —
  // el vigente con su renovación/parche, o un vigente solo — para que se vea
  // qué expediente cubre qué domicilios/renglones y en qué estado está.
  const cadenas = [];
  for (const exp of items) {
    let cadena = cadenas.find(c => c.cadenaId === exp.cadenaId);
    if (!cadena) { cadena = { cadenaId: exp.cadenaId, items: [] }; cadenas.push(cadena); }
    cadena.items.push(exp);
  }
  for (const c of cadenas) c.items.sort((a, b) => (ROL_ORDEN[a.rol] ?? 9) - (ROL_ORDEN[b.rol] ?? 9));
  // En Ascensores, el domicilio se acompaña de qué ascensores/montacargas
  // puntuales cubre ese expediente.
  function detalleAscensores(exp, domicilio) {
    const datos = exp.tipo === "Ascensores" ? exp.ascensoresPorDomicilio?.[domicilio] : null;
    if (!datos) return "";
    const partes = [];
    if ((datos.ascensores || []).length > 0) partes.push("Asc. " + datos.ascensores.join(", "));
    if ((datos.montacargas || []).length > 0) partes.push("Mont. " + datos.montacargas.join(", "));
    return partes.length > 0 ? " (" + partes.join(" · ") + ")" : "";
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAbierto(a => !a)}
        className="flex flex-col  justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold text-slate-900">{tipo}</span>
        <div className="flex items-center gap-2 shrink-0">
          {zona && (
            <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-1 rounded border border-slate-300 text-slate-600">
              {zona}
            </span>
          )}
          <ChevronDown size={16} className={"text-slate-400 transition-transform " + (abierto ? "rotate-180" : "")} />
        </div>  {organismos.length > 0 && (
        <div className="text-[11px] font-medium text-slate-700 -mt-1">{organismos.join(" · ")}</div>
      )}
      {fuero.length > 0 && (
        <div className="text-[11px] text-slate-500">{fuero.join(" · ")}</div>
      )}
      {direcciones.length > 0 && (
        <div className="flex items-start gap-1.5 text-[11px] text-slate-400">
          <MapPin size={12} className="mt-0.5 shrink-0" />
          <span>{direcciones.join(" · ")}</span>
        </div>
      )}
      </button>
    

      {!abierto && (
        <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
          {items.length} expediente{items.length !== 1 ? "s" : ""} · tocá para ver el detalle
        </div>
      )}

      {abierto && (
      <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
        {cadenas.map(cadena => (
          <div key={cadena.cadenaId} className="border border-slate-200 rounded-lg divide-y divide-slate-100">
            {cadena.items.map(exp => {
              const esRenovacion = exp.rol === "renovacion";
              const dias = diasRestantes(exp.fechaVencimiento);
              const niv = alerta(dias);
              const frenado = esRenovacion ? diasFrenado(exp.observaciones, exp.creadoEn) : null;
              const fracasada = esConvocatoriaFracasada(exp);
              const hijos = (todos || []).filter(e => e.divisionDeId === exp.id);
              const adjudicados = hijos.length > 0
                ? (exp.domiciliosRenglones || []).filter(d => !hijos.some(h => (h.domiciliosRenglones || []).includes(d)))
                : null;
              const rolTexto = exp.rol === "parche"
                ? (exp.tipoParche || (exp.tipoContratacionProrroga
                    ? "Prórroga (departamento) · " + (mesesProrrogaUsadosDe(exp) || 0) + "/" + mesesProrrogaTopeDe(exp) + " meses"
                    : ROL_LABEL.parche))
                : ROL_LABEL[exp.rol];
              return (
                <button
                  key={exp.id}
                  onClick={() => onVer(exp.id)}
                  className="w-full text-left p-2.5 flex items-start justify-between gap-2 hover:bg-slate-50 transition-colors first:rounded-t-lg last:rounded-b-lg"
                >
                  <div className="min-w-0 flex flex-col gap-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {rolTexto}{exp.encuadre ? " · " + exp.encuadre : ""}
                    </div>
                    <div className="font-mono text-xs font-semibold text-slate-900">{exp.exp}</div>
                    {!fracasada && (
                      <div className="text-[11px] text-slate-500">
                        {exp.fechaInicio ? fmtFecha(exp.fechaInicio) : "Sin fecha de inicio"} — {fmtFecha(exp.fechaVencimiento)}
                      </div>
                    )}
                    {esRenovacion && (
                      <div className="text-[11px] text-slate-500">
                        {exp.sector || "Sin sector"} · {exp.estadoConvocatoria || "Sin estado de convocatoria"}
                      </div>
                    )}
                    <div className="flex items-start gap-1 text-[11px] text-slate-500">
                      <MapPin size={11} className="mt-0.5 shrink-0" />
                      <span>
                        {esRenovacion ? "Renueva: " : "Tramita: "}
                        {(exp.domiciliosRenglones || []).length > 0
                          ? exp.domiciliosRenglones.map(d => d + detalleAscensores(exp, d)).join(" · ")
                          : "sin domicilios/renglones cargados"}
                      </span>
                    </div>
                    {adjudicados && (
                      <div className="flex items-start gap-1 text-[11px] text-slate-500">
                        <MapPin size={11} className="mt-0.5 shrink-0" />
                        <span>
                          Adjudicado: {adjudicados.length > 0
                            ? adjudicados.map(d => {
                                const datos = exp.adjudicacionPorRenglon?.[d];
                                if (!datos) return d;
                                return d + " (" + datos.firma + (datos.monto ? " · " + fmtMoneda(datos.monto) : "") + (datos.oc ? " · OC " + datos.oc : "") + ")";
                              }).join(" · ")
                            : "ningún domicilio/renglón"}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ESTADO_ESTILO[estadoGeneralMostrado(exp)]}>
                      {estadoGeneralMostrado(exp)}
                    </span>
                    {esRenovacion ? (
                      frenado != null && (
                        <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(frenado)]}>
                          Frenado hace {frenado} día{frenado !== 1 ? "s" : ""}
                        </span>
                      )
                    ) : (
                      <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border " + ALERTA_ESTILO[niv]}>
                        {dias >= 0 ? "Vence " + fmtFecha(exp.fechaVencimiento) : Math.abs(dias) + " días vencido"}
                      </span>
                    )}
                    {!esRenovacion && exp.tieneProrroga && (
                      <span className={"text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 " +
                        (exp.mesesProrrogaUsados > 0 ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800")}>
                        <Clock size={10} /> {exp.mesesProrrogaUsados > 0
                          ? `Prórroga activada (${exp.mesesProrrogaUsados}/${exp.mesesProrroga || Math.max(...PRORROGA_MESES_OPCIONES)})`
                          : "Puede activar prórroga"}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
