"use client";

import { ALERTA_ESTILO } from "@/lib/constants";
import { diasRestantes, alerta, alertaFrenado, diasFrenado } from "@/lib/utils";

// Vista alternativa a las tarjetas para el listado de Servicios: una fila
// por expediente (sin agrupar por trámite), en el mismo estilo que la tabla
// "Detalle de expedientes" del Informe de Servicios — para escanear/ordenar
// rápido en vez de navegar tarjeta por tarjeta. Los antecedentes no se
// muestran, mismo criterio que las tarjetas de grupo (ya es cobertura
// cerrada y reemplazada).
export default function TablaExpedientesServicios({ expedientes, onVer }) {
  const filas = (expedientes || []).filter(e => e.rol !== "antecedente");

  if (filas.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
        No se encontraron expedientes con los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="py-2.5 px-5">Expediente</th>
              <th className="py-2.5 px-5">Fuero</th>
              <th className="py-2.5 px-5">Domicilio</th>
              <th className="py-2.5 px-5">Zona</th>
              <th className="py-2.5 px-5">Tipo</th>
              <th className="py-2.5 px-5">Sector</th>
              <th className="py-2.5 px-5">Estado de convocatoria</th>
              <th className="py-2.5 px-5">Días restantes</th>
              <th className="py-2.5 px-5">Días frenado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map(e => {
              const yaCerrado = e.estadoGeneral === "Finalizado" || e.estadoGeneral === "Archivado";
              const dias = diasRestantes(e.fechaVencimiento);
              const niv = alerta(dias);
              const frenado = diasFrenado(e.observaciones, e.creadoEn);
              const fuero = (e.fuero || []).join(" · ");
              const domicilio = (e.domiciliosRenglones || []).join(" · ");
              return (
                <tr
                  key={e.id}
                  onClick={() => onVer(e.id)}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                >
                  <td className="py-2.5 px-5">
                    <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                    {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600 max-w-[200px] truncate" title={fuero}>{fuero || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600 max-w-[240px] truncate" title={domicilio}>{domicilio || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.zona || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.tipo}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.sector || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.estadoConvocatoria || "-"}</td>
                  <td className="py-2.5 px-5">
                    {yaCerrado ? "-" : (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[niv]}>
                        {dias >= 0 ? dias + " días" : Math.abs(dias) + " días vencido"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-5">
                    {frenado != null ? (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(frenado)]}>
                        {frenado + " días"}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
