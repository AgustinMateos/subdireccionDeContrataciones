"use client";

import { useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { ESTADOS_CONVOCATORIA } from "@/lib/constants";
import { fmtFechaHora } from "@/lib/utils";
import ResolverApertura from "./ResolverApertura";

const INDICE_PUBLICACION = ESTADOS_CONVOCATORIA.indexOf("Publicación");

// Convocatorias con fecha de apertura fijada que todavía no se resolvieron —
// reemplaza al aviso automático que preguntaba si se habían presentado
// ofertas: acá se ve todo junto, pasado y por venir, y se entra a la ficha
// para resolver la adjudicación cuando corresponda. Se muestra mientras el
// estado de convocatoria esté en "Publicación" o antes (incluye null/vacío,
// porque la fecha de apertura se carga desde el movimiento de sector sin
// depender de que ese estado ya se haya actualizado) — apenas se contesta
// "¿Hubo ofertas?" (pasa a Preadjudicación o a Desierta) o se resuelve la
// adjudicación de cualquier otra forma, el estado avanza más allá de
// "Publicación" y el expediente sale solo de esta tabla.
export default function Aperturas({ expedientes, onResolverApertura, onVerExpediente }) {
  const [resolviendo, setResolviendo] = useState(null);
  const pendientes = useMemo(() => {
    return (expedientes || [])
      .filter(e => {
        if (e.rol !== "renovacion" || !e.fechaApertura) return false;
        const indice = ESTADOS_CONVOCATORIA.indexOf(e.estadoConvocatoria);
        if (indice !== -1 && indice > INDICE_PUBLICACION) return false;
        if ((expedientes || []).some(d => d.divisionDeId === e.id)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.fechaApertura) - new Date(b.fechaApertura));
  }, [expedientes]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <CalendarClock size={18} className="text-slate-500" /> Aperturas
        </h2>
        <p className="text-xs text-slate-500">Convocatorias publicadas con fecha de apertura, esperando resolución</p>
      </div>

      {pendientes.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No hay convocatorias esperando apertura.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 px-5">N° de expediente</th>
                  <th className="py-2.5 px-5">N° de contratación</th>
                  <th className="py-2.5 px-5">Fecha y hora de apertura</th>
                  <th className="py-2.5 px-5">Tipo de expediente</th>
                  <th className="py-2.5 px-5">Encuadre</th>
                  <th className="py-2.5 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(e => {
                  const yaAbrio = new Date(e.fechaApertura) < new Date();
                  return (
                    <tr
                      key={e.id}
                      onClick={() => onVerExpediente(e.id)}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                    >
                      <td className="py-2.5 px-5 font-mono text-xs font-semibold text-slate-900">{e.exp}</td>
                      <td className="py-2.5 px-5 text-slate-600">{e.nroContratacion || "-"}</td>
                      <td className="py-2.5 px-5 text-slate-600">{fmtFechaHora(e.fechaApertura)}</td>
                      <td className="py-2.5 px-5 text-slate-600">{e.tipo}</td>
                      <td className="py-2.5 px-5 text-slate-600">{e.encuadre || "-"}</td>
                      <td className="py-2.5 px-5 text-right">
                        {yaAbrio && (
                          <button
                            onClick={ev => { ev.stopPropagation(); setResolviendo(e); }}
                            className="px-2.5 py-1.5 rounded-md border border-blue-300 bg-blue-50 text-blue-800 text-[11px] font-medium hover:bg-blue-100"
                          >
                            ¿Hubo ofertas?
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resolviendo && (
        <ResolverApertura
          exp={resolviendo}
          onCerrar={() => setResolviendo(null)}
          onResolver={async (exp, huboOfertas) => {
            await onResolverApertura(exp, huboOfertas);
            setResolviendo(null);
          }}
        />
      )}
    </div>
  );
}
