"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Plus, X, CheckCircle2, Download, Trash2, Newspaper } from "lucide-react";
import { fmtMoneda } from "@/lib/utils";
export default function CotizadorAvisos({ mostrarToast, expedientes, onVincular }) {
  const [expNro, setExpNro] = useState("");
  const [objeto, setObjeto] = useState("");
  const [cantidadAvisos, setCantidadAvisos] = useState("2");
  const [diarios, setDiarios] = useState([
    { id: 1, nombre: "La Nación" },
    { id: 2, nombre: "Clarín" },
  ]);
  const [empresas, setEmpresas] = useState([
    {
      id: 1,
      nombre: "Rademar Publicidad",
      precios: { 1: { monto: "", iva: "21" }, 2: { monto: "564809,28", iva: "21" } },
    },
    {
      id: 2,
      nombre: "TM Eventos SA",
      precios: { 1: { monto: "1171500", iva: "21" }, 2: { monto: "560200", iva: "21" } },
    },
  ]);

  function numero(v) {
    return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
  }

  function agregarDiario() {
    const nuevoId = Date.now();
    setDiarios(prev => [...prev, { id: nuevoId, nombre: "" }]);
    setEmpresas(prev => prev.map(e => ({ ...e, precios: { ...e.precios, [nuevoId]: { monto: "", iva: "21" } } })));
  }

  function quitarDiario(id) {
    setDiarios(prev => prev.filter(d => d.id !== id));
    setEmpresas(prev => prev.map(e => {
      const precios = { ...e.precios };
      delete precios[id];
      return { ...e, precios };
    }));
  }

  function renombrarDiario(id, nombre) {
    setDiarios(prev => prev.map(d => d.id === id ? { ...d, nombre } : d));
  }

  function agregarEmpresa() {
    const precios = {};
    diarios.forEach(d => { precios[d.id] = { monto: "", iva: "21" }; });
    setEmpresas(prev => [...prev, { id: Date.now(), nombre: "", precios }]);
  }

  function quitarEmpresa(id) {
    setEmpresas(prev => prev.filter(e => e.id !== id));
  }

  function actualizarEmpresaNombre(id, nombre) {
    setEmpresas(prev => prev.map(e => e.id === id ? { ...e, nombre } : e));
  }

  function actualizarPrecio(empresaId, diarioId, campo, valor) {
    setEmpresas(prev => prev.map(e => e.id === empresaId
      ? { ...e, precios: { ...e.precios, [diarioId]: { ...e.precios[diarioId], [campo]: valor } } }
      : e));
  }

  const cantidadAvisosNum = Number(cantidadAvisos) || 1;

  // Cálculo por diario: monto con IVA de cada empresa, mínimo, y costo por la cantidad de avisos.
  const resultadosPorDiario = diarios.map(d => {
    const ofertas = empresas
      .map(e => {
        const p = e.precios[d.id] || { monto: "", iva: "21" };
        const montoSinIva = numero(p.monto);
        const iva = numero(p.iva);
        const montoConIva = montoSinIva > 0 ? montoSinIva * (1 + iva / 100) : 0;
        return { empresaId: e.id, empresaNombre: e.nombre, montoSinIva, iva, montoConIva };
      })
      .filter(o => o.montoSinIva > 0 && o.empresaNombre.trim());

    const minimo = ofertas.length ? Math.min(...ofertas.map(o => o.montoConIva)) : 0;
    const ganador = ofertas.find(o => o.montoConIva === minimo);
    const costoPorAvisos = minimo * cantidadAvisosNum;

    return { diario: d, ofertas, minimo, ganador, costoPorAvisos };
  });

  const totalPresupuestosMinimos = resultadosPorDiario.reduce((s, r) => s + r.costoPorAvisos, 0);

  function aprobarYVincular() {
    if (totalPresupuestosMinimos <= 0) {
      mostrarToast("Cargá al menos un precio para poder aprobar");
      return;
    }
    onVincular(
      expNro,
      "Cotizador de avisos aprobado: total presupuestos mínimos " + fmtMoneda(totalPresupuestosMinimos) +
      " (" + cantidadAvisosNum + " aviso(s) en " + diarios.map(d => d.nombre).join(", ") + ")."
    );
  }

  function exportarExcel() {
    const diariosConDatos = resultadosPorDiario.filter(r => r.ofertas.length > 0);
    if (diariosConDatos.length === 0) {
      mostrarToast("Cargá al menos un precio para exportar");
      return;
    }

    const empresasNombradas = empresas.filter(e => e.nombre.trim());
    const filas = [
      ["CONSEJO DE LA MAGISTRATURA"],
      ["PODER JUDICIAL DE LA NACIÓN"],
      [],
      ["SUBDIRECCIÓN DE CONTRATACIONES"],
      [],
      ["ANEXO I"],
      ["CUADRO COMPARATIVO DE COSTOS - DEPARTAMENTO DE INFORMÁTICA Y VARIOS"],
      [],
      expNro ? ["N° de expediente", expNro] : [],
      objeto ? ["Objeto", objeto] : [],
      [],
      ["Empresas Publicidad", "Valores expresados sin IVA"],
      ["Costo por aviso sin IVA", ...diarios.map(d => d.nombre)],
      ...empresasNombradas.map(e => [
        e.nombre,
        ...diarios.map(d => {
          const monto = numero((e.precios[d.id] || {}).monto);
          return monto > 0 ? monto : "No cotiza";
        }),
      ]),
      [],
      ["Valores expresados con IVA"],
      ["Costo por aviso con IVA", ...diarios.map(d => d.nombre)],
      ...empresasNombradas.map(e => [
        e.nombre,
        ...diarios.map(d => {
          const p = e.precios[d.id] || {};
          const monto = numero(p.monto);
          const iva = numero(p.iva);
          return monto > 0 ? monto * (1 + iva / 100) : "No cotiza";
        }),
      ]),
      ["Presupuesto mínimo", ...resultadosPorDiario.map(r => r.minimo || "-")],
      [],
      ["Valores expresados con IVA"],
      ["Costo por " + cantidadAvisosNum + " aviso(s) con IVA", ...diarios.map(d => d.nombre)],
      ...empresasNombradas.map(e => [
        e.nombre,
        ...diarios.map(d => {
          const p = e.precios[d.id] || {};
          const monto = numero(p.monto);
          const iva = numero(p.iva);
          return monto > 0 ? monto * (1 + iva / 100) * cantidadAvisosNum : "No cotiza";
        }),
      ]),
      ["Presupuesto mínimo", ...resultadosPorDiario.map(r => r.costoPorAvisos || "-")],
      ["TOTAL PRESUPUESTOS MÍNIMOS:", totalPresupuestosMinimos],
      [],
      ["IVA según diario", ...diarios.map(d => d.nombre)],
      ...empresasNombradas.map(e => [
        e.nombre,
        ...diarios.map(d => {
          const p = e.precios[d.id] || {};
          const monto = numero(p.monto);
          return monto > 0 ? numero(p.iva) + "%" : "No cotiza";
        }),
      ]),
    ].filter(f => f.length > 0);

    const ws = XLSX.utils.aoa_to_sheet(filas);
    const anchoCol = { wch: 24 };
    ws["!cols"] = [anchoCol, ...diarios.map(() => ({ wch: 18 }))];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: diarios.length } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: diarios.length } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: diarios.length } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: diarios.length } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: diarios.length } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Anexo I");
    XLSX.writeFile(wb, "cotizador-avisos" + (expNro ? "-" + expNro.replace(/[\/\\]/g, "-") : "") + ".xlsx");
    mostrarToast("Excel exportado");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Newspaper size={18} className="text-slate-500" /> Cotizador de Avisos
          </h2>
          <p className="text-xs text-slate-500">Subdirección de Contrataciones · Cuadro comparativo de costos por diario</p>
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
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente (opcional)</label>
            <input value={expNro} onChange={e => setExpNro(e.target.value)} list="lista-exp-avisos" placeholder="13-00000/26"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            <datalist id="lista-exp-avisos">
              {expedientes?.map(e => <option key={e.id} value={e.exp} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Objeto (opcional)</label>
            <input value={objeto} onChange={e => setObjeto(e.target.value)} placeholder="Ej: Publicación de aviso de licitación"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad de avisos</label>
            <input type="number" min="1" value={cantidadAvisos} onChange={e => setCantidadAvisos(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Diarios / medios a comparar</label>
          <div className="flex flex-wrap items-center gap-2">
            {diarios.map(d => (
              <div key={d.id} className="flex items-center gap-1 border border-slate-200 rounded-md pl-2 pr-1 py-1">
                <input
                  value={d.nombre}
                  onChange={e => renombrarDiario(d.id, e.target.value)}
                  placeholder="Nombre del diario"
                  className="text-xs w-28 border-0 focus:outline-none bg-transparent"
                />
                <button onClick={() => quitarDiario(d.id)} className="text-slate-300 hover:text-red-600">
                  <X size={13} />
                </button>
              </div>
            ))}
            <button onClick={agregarDiario} className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900 px-2 py-1">
              <Plus size={13} /> Agregar diario
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Precios por empresa (sin IVA)</h3>
          <button onClick={agregarEmpresa} className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900">
            <Plus size={13} /> Agregar empresa
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="py-2 px-5">Empresa</th>
                {diarios.map(d => (
                  <th key={d.id} className="py-2 px-5">{d.nombre || "Diario"}</th>
                ))}
                <th className="py-2 px-5 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {empresas.map(e => (
                <tr key={e.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-1.5 px-5">
                    <input
                      value={e.nombre}
                      onChange={ev => actualizarEmpresaNombre(e.id, ev.target.value)}
                      placeholder="Nombre de la empresa"
                      className="w-full text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1"
                    />
                  </td>
                  {diarios.map(d => {
                    const p = e.precios[d.id] || { monto: "", iva: "21" };
                    return (
                      <td key={d.id} className="py-1.5 px-5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400 text-xs">$</span>
                          <input
                            value={p.monto}
                            onChange={ev => actualizarPrecio(e.id, d.id, "monto", ev.target.value)}
                            placeholder="No cotiza"
                            className="w-24 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-slate-300 rounded px-1 py-1"
                          />
                          <input
                            value={p.iva}
                            onChange={ev => actualizarPrecio(e.id, d.id, "iva", ev.target.value)}
                            placeholder="21"
                            className="w-10 text-xs border border-slate-200 rounded px-1 py-1 text-center"
                          />
                          <span className="text-[10px] text-slate-400">% IVA</span>
                        </div>
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-5">
                    <button onClick={() => quitarEmpresa(e.id)} className="text-slate-300 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comparación con IVA y presupuesto mínimo</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="py-2 px-5">Empresa</th>
                {diarios.map(d => (
                  <th key={d.id} className="py-2 px-5">{d.nombre || "Diario"}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {empresas.filter(e => e.nombre.trim()).map(e => (
                <tr key={e.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 px-5 font-medium text-slate-800">{e.nombre}</td>
                  {diarios.map(d => {
                    const p = e.precios[d.id] || {};
                    const monto = numero(p.monto);
                    const iva = numero(p.iva);
                    const conIva = monto > 0 ? monto * (1 + iva / 100) : 0;
                    const resultado = resultadosPorDiario.find(r => r.diario.id === d.id);
                    const esGanador = resultado && resultado.ganador && resultado.ganador.empresaId === e.id;
                    return (
                      <td key={d.id} className={"py-2 px-5 " + (esGanador ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600")}>
                        {monto > 0 ? fmtMoneda(conIva) : "No cotiza"}
                        {esGanador && (
                          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">
                            Más bajo
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-slate-50">
                <td className="py-2 px-5 font-semibold text-slate-900">Presupuesto mínimo</td>
                {resultadosPorDiario.map(r => (
                  <td key={r.diario.id} className="py-2 px-5 font-semibold text-slate-900">
                    {r.minimo > 0 ? fmtMoneda(r.minimo) : "-"}
                  </td>
                ))}
              </tr>
              <tr className="bg-slate-50">
                <td className="py-2 px-5 font-semibold text-slate-900">Costo por {cantidadAvisosNum} aviso(s)</td>
                {resultadosPorDiario.map(r => (
                  <td key={r.diario.id} className="py-2 px-5 font-semibold text-slate-900">
                    {r.costoPorAvisos > 0 ? fmtMoneda(r.costoPorAvisos) : "-"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total presupuestos mínimos</div>
        <div className="text-2xl font-semibold text-slate-900">{fmtMoneda(totalPresupuestosMinimos)}</div>
      </div>
    </div>
  );
}

