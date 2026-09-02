"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Shield, Download } from "lucide-react";
import { FUERZAS_SEGURIDAD, FUERZA_LABEL } from "@/lib/constants";
import { fmtMoneda, fmtFecha } from "@/lib/utils";

const COLOR_FUERZA = {
  PFA: "bg-slate-700",
  GNA: "bg-emerald-700",
  PNA: "bg-blue-700",
  PCABA: "bg-amber-600",
};

function anioDeExpediente(e) {
  const f = e.fechaInicio || e.fechaVencimiento || "";
  return f ? String(f).slice(0, 4) : "Sin fecha";
}

export default function InformePoliciaAdicional({ expedientes }) {
  const [anio, setAnio] = useState("Todos");

  const policiales = useMemo(
    () => (expedientes || []).filter(e => e.esPoliciaAdicional),
    [expedientes]
  );

  const anios = useMemo(() => {
    const set = new Set(policiales.map(anioDeExpediente));
    return Array.from(set).sort((a, b) => String(b).localeCompare(String(a)));
  }, [policiales]);

  const filtrados = useMemo(
    () => (anio === "Todos" ? policiales : policiales.filter(e => anioDeExpediente(e) === anio)),
    [policiales, anio]
  );

  const porFuerza = useMemo(() => {
    const base = {};
    for (const f of FUERZAS_SEGURIDAD) base[f.key] = { key: f.key, nombre: f.nombre, cantidad: 0, totalARS: 0, totalUSD: 0 };
    for (const e of filtrados) {
      const k = e.fuerzaSeguridad && base[e.fuerzaSeguridad] ? e.fuerzaSeguridad : "SIN";
      if (!base[k]) base[k] = { key: "SIN", nombre: "Sin fuerza asignada", cantidad: 0, totalARS: 0, totalUSD: 0 };
      base[k].cantidad += 1;
      base[k].totalARS += Number(e.montoARS) || 0;
      base[k].totalUSD += Number(e.montoUSD) || 0;
    }
    return Object.values(base).filter(f => f.cantidad > 0).sort((a, b) => b.totalARS - a.totalARS);
  }, [filtrados]);

  const totalARS = porFuerza.reduce((s, f) => s + f.totalARS, 0);
  const totalUSD = porFuerza.reduce((s, f) => s + f.totalUSD, 0);
  const totalExpedientes = filtrados.length;
  const maxARS = Math.max(1, ...porFuerza.map(f => f.totalARS));

  function exportarExcel() {
    const filas = [
      ["Informe de Policía Adicional"],
      ["Período", anio === "Todos" ? "Todos los años" : anio],
      [],
      ["Fuerza", "Expedientes", "$ adjudicado (ARS)", "USD", "% del total ARS"],
      ...porFuerza.map(f => [
        f.nombre,
        f.cantidad,
        f.totalARS,
        f.totalUSD || 0,
        totalARS ? Math.round((f.totalARS / totalARS) * 100) + "%" : "0%",
      ]),
      ["TOTAL", totalExpedientes, totalARS, totalUSD, "100%"],
      [],
      ["Detalle de expedientes"],
      ["Expediente", "Nombre corto", "Fuerza", "Objeto", "Inicio", "Vencimiento", "$ adjudicado", "USD", "Estado"],
      ...filtrados.map(e => [
        e.exp,
        e.nombreCorto || "",
        FUERZA_LABEL[e.fuerzaSeguridad] || e.fuerzaSeguridad || "-",
        e.objeto,
        e.fechaInicio || "",
        e.fechaVencimiento || "",
        Number(e.montoARS) || 0,
        Number(e.montoUSD) || 0,
        e.estadoGeneral,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Policía adicional");
    XLSX.writeFile(wb, "informe-policia-adicional-" + (anio === "Todos" ? "todos" : anio) + ".xlsx");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Shield size={18} className="text-slate-500" /> Informe de Policía Adicional
          </h2>
          <p className="text-xs text-slate-500">
            Contratado con cada fuerza (PFA, PNA, GNA y Policía de la Ciudad): cantidad de expedientes, monto adjudicado y total.
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
          No hay expedientes de policía adicional {anio === "Todos" ? "cargados" : "en " + anio}.
          <p className="text-xs text-slate-400 mt-1">
            Se cuentan los expedientes marcados como "Contratación de policía adicional" en el formulario.
          </p>
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
              <div className="text-2xl font-semibold text-slate-900">{fmtMoneda(totalARS)}</div>
              <p className="text-[11px] text-slate-400 mt-1">{porFuerza.length} fuerza(s)</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Total adjudicado (USD)</div>
              <div className="text-2xl font-semibold text-slate-900">{totalUSD ? fmtMoneda(totalUSD, "USD") : "-"}</div>
              <p className="text-[11px] text-slate-400 mt-1">Cuando corresponde</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-4">Monto adjudicado por fuerza</h3>
            <div className="space-y-3">
              {porFuerza.map(f => (
                <div key={f.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{f.nombre}</span>
                    <span className="text-slate-500">
                      {f.cantidad} exp · <strong className="text-slate-900">{fmtMoneda(f.totalARS)}</strong>
                      {totalARS ? " · " + Math.round((f.totalARS / totalARS) * 100) + "%" : ""}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={"h-full rounded-full " + (COLOR_FUERZA[f.key] || "bg-slate-500")}
                      style={{ width: Math.max(2, (f.totalARS / maxARS) * 100) + "%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen por fuerza</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-5">Fuerza</th>
                    <th className="py-2.5 px-5">Expedientes</th>
                    <th className="py-2.5 px-5">$ adjudicado</th>
                    <th className="py-2.5 px-5">USD</th>
                    <th className="py-2.5 px-5">% del total</th>
                  </tr>
                </thead>
                <tbody>
                  {porFuerza.map(f => (
                    <tr key={f.key} className="border-b border-slate-50 last:border-0">
                      <td className="py-2.5 px-5 font-medium text-slate-900">{f.nombre}</td>
                      <td className="py-2.5 px-5 text-slate-600">{f.cantidad}</td>
                      <td className="py-2.5 px-5 font-semibold text-slate-900">{fmtMoneda(f.totalARS)}</td>
                      <td className="py-2.5 px-5 text-slate-600">{f.totalUSD ? fmtMoneda(f.totalUSD, "USD") : "-"}</td>
                      <td className="py-2.5 px-5 text-slate-500">{totalARS ? Math.round((f.totalARS / totalARS) * 100) + "%" : "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="py-2.5 px-5 font-semibold text-slate-900">Total</td>
                    <td className="py-2.5 px-5 font-semibold text-slate-900">{totalExpedientes}</td>
                    <td className="py-2.5 px-5 font-semibold text-slate-900">{fmtMoneda(totalARS)}</td>
                    <td className="py-2.5 px-5 font-semibold text-slate-900">{totalUSD ? fmtMoneda(totalUSD, "USD") : "-"}</td>
                    <td className="py-2.5 px-5 font-semibold text-slate-500">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalle de expedientes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-5">Expediente</th>
                    <th className="py-2.5 px-5">Fuerza</th>
                    <th className="py-2.5 px-5">Objeto</th>
                    <th className="py-2.5 px-5">Inicio</th>
                    <th className="py-2.5 px-5">$ adjudicado</th>
                    <th className="py-2.5 px-5">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados
                    .slice()
                    .sort((a, b) => (a.fuerzaSeguridad || "").localeCompare(b.fuerzaSeguridad || "") || String(b.fechaInicio || "").localeCompare(String(a.fechaInicio || "")))
                    .map(e => (
                      <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="py-2.5 px-5">
                          <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                          {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                        </td>
                        <td className="py-2.5 px-5 text-slate-600">{FUERZA_LABEL[e.fuerzaSeguridad] || e.fuerzaSeguridad || "-"}</td>
                        <td className="py-2.5 px-5 text-slate-600 max-w-[280px] truncate">{e.objeto}</td>
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
