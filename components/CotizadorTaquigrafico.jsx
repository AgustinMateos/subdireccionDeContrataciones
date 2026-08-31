"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Plus, CheckCircle2, Mic, Download, Trash2 } from "lucide-react";
import { fmtMoneda } from "@/lib/utils";
export default function CotizadorTaquigrafico({ sesion, mostrarToast, expedientes, onVincular }) {
  const [expNro, setExpNro] = useState("13-10293/26");
  const [objeto, setObjeto] = useState(
    "Contratar el servicio de desgrabación de audiencias y su correspondiente versión taquigráfica de las audiencias solicitadas por la Comisión de Acusación del Consejo de la Magistratura del Poder Judicial de la Nación, sito en la calle Libertad nro. 731, C.A.B.A., en el marco del expediente: CM 164/23 y acumuladas, caratulado \"UEJN c/ Dra. C. P. P.\"."
  );
  const [cantidadAudiencias, setCantidadAudiencias] = useState("1");
  const [horasPorAudiencia, setHorasPorAudiencia] = useState("7");
  const [agente, setAgente] = useState(sesion?.rol === "operador" || sesion?.rol === "admin" ? "" : "AM");
  const [oferentes, setOferentes] = useState([
    { id: 1, nombre: "Pablo Arrosagaray", precioHora: "89500", fojas: "8/9" },
    { id: 2, nombre: "Jorge Luis Morales", precioHora: "100000", fojas: "10" },
    { id: 3, nombre: "Nicolás Marino", precioHora: "100000", fojas: "11" },
    { id: 4, nombre: "Santiago Guastoni", precioHora: "65000", fojas: "13" },
    { id: 5, nombre: "Ezequiel Marino", precioHora: "150000", fojas: "14/15" },
  ]);

  function actualizarOferente(id, campo, valor) {
    setOferentes(prev => prev.map(o => o.id === id ? { ...o, [campo]: valor } : o));
  }

  function agregarOferente() {
    setOferentes(prev => [...prev, { id: Date.now(), nombre: "", precioHora: "", fojas: "" }]);
  }

  function quitarOferente(id) {
    setOferentes(prev => prev.filter(o => o.id !== id));
  }

  const precios = oferentes
    .map(o => ({ ...o, precioNum: Number(String(o.precioHora).replace(/\./g, "").replace(",", ".")) || 0 }))
    .filter(o => o.nombre.trim() && o.precioNum > 0);

  const precioMinimo = precios.length ? Math.min(...precios.map(o => o.precioNum)) : 0;
  const ganador = precios.find(o => o.precioNum === precioMinimo);
  const audienciasNum = Number(cantidadAudiencias) || 0;
  const horasPorAudienciaNum = Number(horasPorAudiencia) || 0;
  const horasNum = audienciasNum * horasPorAudienciaNum;
  const presupuestoTotal = precioMinimo * horasNum;

  function exportarExcel() {
    if (precios.length === 0) {
      mostrarToast("Cargá al menos un oferente con precio para exportar");
      return;
    }

    const filas = [
      ["CONSEJO DE LA MAGISTRATURA"],
      ["PODER JUDICIAL DE LA NACIÓN"],
      [],
      ["ADMINISTRACIÓN GENERAL", "", "", "exp N° " + expNro],
      [],
      [objeto],
      [],
      [],
      ["Presupuestos", "", "", "", "Especificaciones Técnicas"],
      ["Taquígrafos", "Precio por hora", "Fojas", "", "Cantidad de Audiencias solicitadas", audienciasNum],
      ...oferentes
        .filter(o => o.nombre.trim())
        .map((o, i) => [
          o.nombre,
          Number(String(o.precioHora).replace(/\./g, "").replace(",", ".")) || 0,
          o.fojas,
          "",
          i === 0 ? "Horas por audiencia" : i === 1 ? "Cantidad de Horas (total)" : "",
          i === 0 ? horasPorAudienciaNum : i === 1 ? horasNum : "",
        ]),
      [],
      ["Presupuesto Mínimo por hora:", precioMinimo],
      ["Presupuesto total", presupuestoTotal],
      [],
      ["Depto de Informática y Varios"],
      [agente],
    ];

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws["!cols"] = [{ wch: 26 }, { wch: 18 }, { wch: 10 }, { wch: 4 }, { wch: 32 }, { wch: 12 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 3, c: 5 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 5 } },
      { s: { r: 8, c: 4 }, e: { r: 8, c: 5 } },
    ];

    // Intento de estilo (bordes, negrita, fondo) — SheetJS Community sólo escribe
    // estilos de forma parcial; si tu Excel no los muestra, es una limitación de
    // esa librería gratuita, no un error de los datos.
    const bordeFino = { style: "thin", color: { rgb: "000000" } };
    const bordeCompleto = { top: bordeFino, bottom: bordeFino, left: bordeFino, right: bordeFino };
    const celdasConBorde = [
      "A9", "B9", "C9", "E9", "F9",
      ...oferentes.filter(o => o.nombre.trim()).map((_, i) => "A" + (10 + i)),
      ...oferentes.filter(o => o.nombre.trim()).map((_, i) => "B" + (10 + i)),
      ...oferentes.filter(o => o.nombre.trim()).map((_, i) => "C" + (10 + i)),
      "A" + (11 + oferentes.filter(o => o.nombre.trim()).length),
      "B" + (11 + oferentes.filter(o => o.nombre.trim()).length),
      "A" + (12 + oferentes.filter(o => o.nombre.trim()).length),
      "B" + (12 + oferentes.filter(o => o.nombre.trim()).length),
    ];
    celdasConBorde.forEach(ref => {
      if (ws[ref]) ws[ref].s = { border: bordeCompleto };
    });
    if (ws["A1"]) ws["A1"].s = { font: { bold: true, sz: 14 } };
    if (ws["A9"]) ws["A9"].s = { font: { bold: true }, border: bordeCompleto };
    if (ws["E9"]) ws["E9"].s = { font: { bold: true }, border: bordeCompleto };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotización");
    XLSX.writeFile(wb, "cotizador-taquigrafico-" + expNro.replace(/[\/\\]/g, "-") + ".xlsx", { cellStyles: true });
    mostrarToast("Excel exportado");
  }

  function aprobarYVincular() {
    if (!ganador) {
      mostrarToast("Cargá al menos un oferente con precio antes de aprobar");
      return;
    }
    onVincular(
      expNro,
      "Cotizador taquigráfico aprobado: presupuesto mínimo " + fmtMoneda(precioMinimo) + "/hora × " + horasNum +
      " hora(s) = " + fmtMoneda(presupuestoTotal) + " (oferente: " + ganador.nombre + ")."
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Mic size={18} className="text-slate-500" /> Cotizador Taquigráfico
          </h2>
          <p className="text-xs text-slate-500">Consejo de la Magistratura · Administración General</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={aprobarYVincular}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
          >
            <CheckCircle2 size={14} /> Aprobar y vincular al expediente
          </button>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800"
          >
            <Download size={14} /> Exportar a Excel
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente</label>
            <input value={expNro} onChange={e => setExpNro(e.target.value)} list="lista-exp-taquigrafico" placeholder="13-00000/26"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            <datalist id="lista-exp-taquigrafico">
              {expedientes?.map(e => <option key={e.id} value={e.exp} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad de audiencias solicitadas</label>
            <input type="number" value={cantidadAudiencias} onChange={e => setCantidadAudiencias(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Horas por audiencia</label>
            <input type="number" value={horasPorAudiencia} onChange={e => setHorasPorAudiencia(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad de horas (total)</label>
            <div className="w-full text-sm border border-slate-200 bg-slate-50 rounded-md px-3 py-2 text-slate-700">
              {horasNum} hora{horasNum !== 1 ? "s" : ""}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">{audienciasNum} audiencia(s) × {horasPorAudienciaNum} hora(s)</p>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Objeto</label>
          <textarea value={objeto} onChange={e => setObjeto(e.target.value)} rows={3}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="w-40">
          <label className="block text-xs font-medium text-slate-600 mb-1">Agente</label>
          <input value={agente} onChange={e => setAgente(e.target.value)} placeholder="Ej: AM"
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Presupuestos por oferente</h3>
          <button onClick={agregarOferente} className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900">
            <Plus size={13} /> Agregar oferente
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="py-2 px-5">Taquígrafo / Oferente</th>
              <th className="py-2 px-5">Precio por hora</th>
              <th className="py-2 px-5">Fojas</th>
              <th className="py-2 px-5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {oferentes.map(o => {
              const precioNum = Number(String(o.precioHora).replace(/\./g, "").replace(",", ".")) || 0;
              const esGanador = ganador && o.id === ganador.id;
              return (
                <tr key={o.id} className={"border-b border-slate-50 last:border-0 " + (esGanador ? "bg-emerald-50" : "")}>
                  <td className="py-1.5 px-5">
                    <input
                      value={o.nombre}
                      onChange={e => actualizarOferente(o.id, "nombre", e.target.value)}
                      placeholder="Nombre del oferente"
                      className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1"
                    />
                  </td>
                  <td className="py-1.5 px-5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-xs">$</span>
                      <input
                        value={o.precioHora}
                        onChange={e => actualizarOferente(o.id, "precioHora", e.target.value)}
                        placeholder="0"
                        className="w-28 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1"
                      />
                      {esGanador && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                          Más bajo
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 px-5">
                    <input
                      value={o.fojas}
                      onChange={e => actualizarOferente(o.id, "fojas", e.target.value)}
                      placeholder="Ej: 8/9"
                      className="w-20 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1"
                    />
                  </td>
                  <td className="py-1.5 px-5">
                    <button onClick={() => quitarOferente(o.id)} className="text-slate-300 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Presupuesto mínimo por hora</div>
          <div className="text-2xl font-semibold text-slate-900">{fmtMoneda(precioMinimo)}</div>
          {ganador && <p className="text-xs text-emerald-700 mt-1">Oferente más bajo: {ganador.nombre}</p>}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            Presupuesto total ({horasNum || 0} hora{horasNum !== 1 ? "s" : ""})
          </div>
          <div className="text-2xl font-semibold text-slate-900">{fmtMoneda(presupuestoTotal)}</div>
        </div>
      </div>
    </div>
  );
}

