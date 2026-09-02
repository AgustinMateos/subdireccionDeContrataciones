"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Building2, Download } from "lucide-react";
import { fmtMoneda, fmtFecha } from "@/lib/utils";

function anioDeExpediente(e) {
  const f = e.fechaInicio || e.fechaVencimiento || "";
  return f ? String(f).slice(0, 4) : "Sin fecha";
}

const BARRA_COLORES = ["bg-slate-700", "bg-blue-700", "bg-emerald-700", "bg-amber-600", "bg-indigo-700", "bg-rose-700"];

export default function InformeOrganismos({ expedientes }) {
  const [anio, setAnio] = useState("Todos");
  const [q, setQ] = useState("");

  const anios = useMemo(() => {
    const set = new Set((expedientes || []).map(anioDeExpediente));
    return Array.from(set).sort((a, b) => String(b).localeCompare(String(a)));
  }, [expedientes]);

  const filtrados = useMemo(
    () => (anio === "Todos" ? (expedientes || []) : (expedientes || []).filter(e => anioDeExpediente(e) === anio)),
    [expedientes, anio]
  );

  const porOrganismo = useMemo(() => {
    const map = {};
    for (const e of filtrados) {
      const orgs = Array.isArray(e.organismos) && e.organismos.length > 0 ? e.organismos : ["(Sin organismo)"];
      for (const org of orgs) {
        if (!map[org]) map[org] = { organismo: org, cantidad: 0, totalARS: 0, totalUSD: 0, totalPO: 0 };
        map[org].cantidad += 1;
        map[org].totalARS += Number(e.montoARS) || 0;
        map[org].totalUSD += Number(e.montoUSD) || 0;
        map[org].totalPO += Number(e.presupuestoOficial) || 0;
      }
    }
    return Object.values(map).sort((a, b) => b.totalARS - a.totalARS);
  }, [filtrados]);

  const listado = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? porOrganismo.filter(o => o.organismo.toLowerCase().includes(term)) : porOrganismo;
  }, [porOrganismo, q]);

  // Totales "reales" (por expediente, sin duplicar por multi-organismo).
  const totalExpedientes = filtrados.length;
  const totalARSReal = filtrados.reduce((s, e) => s + (Number(e.montoARS) || 0), 0);
  const totalUSDReal = filtrados.reduce((s, e) => s + (Number(e.montoUSD) || 0), 0);
  const sumaOrgARS = listado.reduce((s, o) => s + o.totalARS, 0);
  const maxARS = Math.max(1, ...listado.map(o => o.totalARS));

  function exportarExcel() {
    const filas = [
      ["Informe por Organismo"],
      ["Período", anio === "Todos" ? "Todos los años" : anio],
      ["Nota", "Un expediente con varios organismos suma su monto en cada organismo."],
      [],
      ["Organismo", "Expedientes", "$ adjudicado (ARS)", "Presupuesto oficial (ARS)", "USD"],
      ...porOrganismo.map(o => [o.organismo, o.cantidad, o.totalARS, o.totalPO, o.totalUSD || 0]),
      [],
      ["Total real (por expediente)", totalExpedientes, totalARSReal, "", totalUSDReal],
      [],
      ["Detalle de expedientes"],
      ["Expediente", "Nombre corto", "Organismos", "Objeto", "Inicio", "Vencimiento", "$ adjudicado", "USD", "Estado"],
      ...filtrados.map(e => [
        e.exp,
        e.nombreCorto || "",
        (e.organismos || []).join(" / "),
        e.objeto,
        e.fechaInicio || "",
        e.fechaVencimiento || "",
        Number(e.montoARS) || 0,
        Number(e.montoUSD) || 0,
        e.estadoGeneral,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws["!cols"] = [{ wch: 40 }, { wch: 12 }, { wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Organismos");
    XLSX.writeFile(wb, "informe-organismos-" + (anio === "Todos" ? "todos" : anio) + ".xlsx");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Building2 size={18} className="text-slate-500" /> Informe por Organismo
          </h2>
          <p className="text-xs text-slate-500">
            Cantidad de expedientes, monto adjudicado y presupuesto oficial contratado para cada organismo solicitante.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Año</label>
            <select
              value={anio}
              onChange={e => setAnio(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
            >
              <option value="Todos">Todos los años</option>
              {anios.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <button
            onClick={exportarExcel}
            disabled={totalExpedientes === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 disabled:opacity-50"
          >
            <Download size={14} /> Exportar a Excel
          </button>
        </div>
      </div>

      {totalExpedientes === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          No hay expedientes {anio === "Todos" ? "cargados" : "en " + anio}.
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Expedientes</div>
              <div className="text-2xl font-semibold text-slate-900">{totalExpedientes}</div>
              <p className="text-[11px] text-slate-400 mt-1">{anio === "Todos" ? "Todos los años" : "Año " + anio}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Total adjudicado (ARS)</div>
              <div className="text-2xl font-semibold text-slate-900">{fmtMoneda(totalARSReal)}</div>
              <p className="text-[11px] text-slate-400 mt-1">Sin duplicar por multi-organismo</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Organismos con expedientes</div>
              <div className="text-2xl font-semibold text-slate-900">{porOrganismo.length}</div>
              <p className="text-[11px] text-slate-400 mt-1">{totalUSDReal ? "Total USD: " + fmtMoneda(totalUSDReal, "USD") : "Sin montos en USD"}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Monto adjudicado por organismo</h3>
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Filtrar organismo…"
                className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white w-52 focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
            <div className="space-y-3">
              {listado.map((o, i) => (
                <div key={o.organismo}>
                  <div className="flex items-center justify-between text-xs mb-1 gap-3">
                    <span className="font-medium text-slate-700 truncate">{o.organismo}</span>
                    <span className="text-slate-500 shrink-0">
                      {o.cantidad} exp · <strong className="text-slate-900">{fmtMoneda(o.totalARS)}</strong>
                      {sumaOrgARS ? " · " + Math.round((o.totalARS / sumaOrgARS) * 100) + "%" : ""}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={"h-full rounded-full " + BARRA_COLORES[i % BARRA_COLORES.length]}
                      style={{ width: Math.max(2, (o.totalARS / maxARS) * 100) + "%" }}
                    />
                  </div>
                </div>
              ))}
              {listado.length === 0 && <p className="text-xs text-slate-400">Ningún organismo coincide con "{q}".</p>}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen por organismo</h3>
              <span className="text-[11px] text-slate-400">Un expediente con varios organismos suma en cada fila</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[620px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-5">Organismo</th>
                    <th className="py-2.5 px-5">Expedientes</th>
                    <th className="py-2.5 px-5">$ adjudicado</th>
                    <th className="py-2.5 px-5">Presupuesto oficial</th>
                    <th className="py-2.5 px-5">USD</th>
                  </tr>
                </thead>
                <tbody>
                  {listado.map(o => (
                    <tr key={o.organismo} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 px-5 font-medium text-slate-900">{o.organismo}</td>
                      <td className="py-2.5 px-5 text-slate-600">{o.cantidad}</td>
                      <td className="py-2.5 px-5 font-semibold text-slate-900">{fmtMoneda(o.totalARS)}</td>
                      <td className="py-2.5 px-5 text-slate-600">{o.totalPO ? fmtMoneda(o.totalPO) : "-"}</td>
                      <td className="py-2.5 px-5 text-slate-600">{o.totalUSD ? fmtMoneda(o.totalUSD, "USD") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle de expedientes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-5">Expediente</th>
                    <th className="py-2.5 px-5">Organismo(s)</th>
                    <th className="py-2.5 px-5">Objeto</th>
                    <th className="py-2.5 px-5">Inicio</th>
                    <th className="py-2.5 px-5">$ adjudicado</th>
                    <th className="py-2.5 px-5">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados
                    .slice()
                    .sort((a, b) => String(b.fechaInicio || "").localeCompare(String(a.fechaInicio || "")))
                    .map(e => (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="py-2.5 px-5">
                          <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                          {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                        </td>
                        <td className="py-2.5 px-5 text-slate-600 max-w-[220px] truncate">{(e.organismos || []).join(" · ") || "-"}</td>
                        <td className="py-2.5 px-5 text-slate-600 max-w-[260px] truncate">{e.objeto}</td>
                        <td className="py-2.5 px-5 text-slate-500">{fmtFecha(e.fechaInicio)}</td>
                        <td className="py-2.5 px-5 font-semibold text-slate-900">{fmtMoneda(e.montoARS)}</td>
                        <td className="py-2.5 px-5 text-slate-500">{e.estadoGeneral}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
