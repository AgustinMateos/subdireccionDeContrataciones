"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { CheckCircle2, Download, Shield, CalendarDays } from "lucide-react";
import { FUERZAS_SEGURIDAD, PERIODICIDADES_POLICIA, FERIADOS_2026 } from "@/lib/constants";
import { calcularDiasServicio, diasServicioPorMes, fmtMoneda, fmtFecha } from "@/lib/utils";
export default function CotizadorPolicia({ mostrarToast, expedientes, onVincular }) {
  const [fuerza, setFuerza] = useState("PFA");
  const [periodicidad, setPeriodicidad] = useState("lv_habiles");
  const [fechaInicio, setFechaInicio] = useState("2026-09-01");
  const [fechaFin, setFechaFin] = useState("2026-12-31");
  const [modulosPorDia, setModulosPorDia] = useState("1");
  const [cantidadOficiales, setCantidadOficiales] = useState("1");
  const [modoValor, setModoValor] = useState("uniforme"); // "uniforme" | "mensual"
  const [valorModulo, setValorModulo] = useState("");
  const [valoresPorMes, setValoresPorMes] = useState({}); // { "2026-09": "45000", ... }
  const [expNro, setExpNro] = useState("");
  const [objeto, setObjeto] = useState("");
  const [feriadosTexto, setFeriadosTexto] = useState(FERIADOS_2026.join(", "));

  const feriadosSet = useMemo(() => {
    return new Set(feriadosTexto.split(",").map(f => f.trim()).filter(Boolean));
  }, [feriadosTexto]);

  const { dias } = useMemo(
    () => calcularDiasServicio(fechaInicio, fechaFin, periodicidad, feriadosSet),
    [fechaInicio, fechaFin, periodicidad, feriadosSet]
  );

  const mesesDetalle = useMemo(
    () => diasServicioPorMes(fechaInicio, fechaFin, periodicidad, feriadosSet),
    [fechaInicio, fechaFin, periodicidad, feriadosSet]
  );

  function numero(v) {
    return Number(String(v).replace(/\./g, "").replace(",", ".")) || 0;
  }

  const valorModuloNum = numero(valorModulo);
  const modulosPorDiaNum = Number(modulosPorDia) || 0;
  const oficialesNum = Number(cantidadOficiales) || 1;

  // Desglose mensual: módulos y monto por mes, usando el valor uniforme o el de cada mes según el modo.
  const desgloseMensual = mesesDetalle.map(m => {
    const modulos = m.dias * modulosPorDiaNum * oficialesNum;
    const valorDelMes = modoValor === "uniforme" ? valorModuloNum : numero(valoresPorMes[m.mes]);
    return { ...m, modulos, valorModulo: valorDelMes, monto: modulos * valorDelMes };
  });

  const totalModulos = desgloseMensual.reduce((s, m) => s + m.modulos, 0);
  const costoTotal = desgloseMensual.reduce((s, m) => s + m.monto, 0);
  const fuerzaSeleccionada = FUERZAS_SEGURIDAD.find(f => f.key === fuerza);
  const periodicidadSeleccionada = PERIODICIDADES_POLICIA.find(p => p.key === periodicidad);

  function actualizarValorMes(mes, valor) {
    setValoresPorMes(prev => ({ ...prev, [mes]: valor }));
  }

  function exportarExcel() {
    if (dias === 0) {
      mostrarToast("Revisá las fechas: no hay días de servicio calculados");
      return;
    }

    const filas = [
      ["CONSEJO DE LA MAGISTRATURA"],
      ["PODER JUDICIAL DE LA NACIÓN"],
      [],
      ["Cotización de Policía Adicional", "", "exp N° " + (expNro || "-")],
      [],
      [objeto || "-"],
      [],
      ["Fuerza", fuerzaSeleccionada.nombre],
      ["Modalidad del servicio", periodicidadSeleccionada.label],
      ["Fecha de inicio", fmtFecha(fechaInicio)],
      ["Fecha de finalización", fmtFecha(fechaFin)],
      ["Días de servicio calculados", dias],
      ["Módulos por día", modulosPorDiaNum],
      ["Cantidad de oficiales", oficialesNum],
      ["Valor del módulo", modoValor === "uniforme" ? "Uniforme: " + fmtMoneda(valorModuloNum) : "Variable por mes (ver detalle)"],
      [],
      ["Detalle mensual", "Días", "Módulos", "Valor módulo", "Monto"],
      ...desgloseMensual.map(m => [m.etiqueta, m.dias, m.modulos, m.valorModulo, m.monto]),
      [],
      ["Total de módulos", totalModulos],
      ["Costo total estimado", costoTotal],
      [],
      ["Depto de Informática y Varios"],
    ];

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws["!cols"] = [{ wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 5, c: 0 }, e: { r: 5, c: 4 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Policía adicional");
    XLSX.writeFile(wb, "cotizacion-policia-adicional-" + fuerza + ".xlsx");
    mostrarToast("Excel exportado");
  }

  function aprobarYVincular() {
    if (costoTotal <= 0) {
      mostrarToast("Cargá el valor del módulo antes de aprobar");
      return;
    }
    onVincular(
      expNro,
      "Cotizador de policía adicional aprobado: " + fuerzaSeleccionada.nombre + ", " + periodicidadSeleccionada.label +
      ", " + totalModulos.toLocaleString("es-AR") + " módulos = " + fmtMoneda(costoTotal) + "."
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Shield size={18} className="text-slate-500" /> Cotizador de Policía Adicional
          </h2>
          <p className="text-xs text-slate-500">Cálculo por módulos (1 módulo = 4 horas de labor) para una fuerza de seguridad</p>
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
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Fuerza de seguridad</label>
          <div className="flex flex-wrap gap-1.5">
            {FUERZAS_SEGURIDAD.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFuerza(f.key)}
                className={"text-xs font-medium px-3 py-1.5 rounded-full border transition-colors " +
                  (fuerza === f.key ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}
              >
                {f.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Modalidad del servicio</label>
          <div className="flex flex-wrap gap-1.5">
            {PERIODICIDADES_POLICIA.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriodicidad(p.key)}
                className={"text-xs font-medium px-3 py-1.5 rounded-full border transition-colors " +
                  (periodicidad === p.key ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center justify-between">
              Fecha de finalización
              <button type="button" onClick={() => setFechaFin(fechaInicio.slice(0, 4) + "-12-31")}
                className="text-[10px] text-slate-400 hover:text-slate-700 underline normal-case font-normal">
                usar 31/12
              </button>
            </label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Módulos por día</label>
            <input type="number" step="0.5" min="0" value={modulosPorDia} onChange={e => setModulosPorDia(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cantidad de oficiales</label>
            <input type="number" min="1" value={cantidadOficiales} onChange={e => setCantidadOficiales(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente (opcional)</label>
            <input value={expNro} onChange={e => setExpNro(e.target.value)} list="lista-exp-policia" placeholder="13-00000/26"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            <datalist id="lista-exp-policia">
              {expedientes?.map(e => <option key={e.id} value={e.exp} />)}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Objeto (opcional)</label>
            <input value={objeto} onChange={e => setObjeto(e.target.value)} placeholder="Ej: Custodia edificio sede..."
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-800 flex items-center gap-1.5 w-fit">
            <CalendarDays size={13} /> Ver / editar feriados considerados ({feriadosSet.size})
          </summary>
          <textarea
            value={feriadosTexto}
            onChange={e => setFeriadosTexto(e.target.value)}
            rows={3}
            className="w-full mt-2 text-xs border border-slate-300 rounded-md px-3 py-2 font-mono focus:outline-none focus:ring-2 focus:ring-slate-800"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Fechas en formato AAAA-MM-DD separadas por coma. Se usan para "lunes a viernes hábiles" (se excluyen) y
            "sábados, domingos y feriados" (se incluyen). Ajustalas si el servicio corresponde a otro año.
          </p>
        </details>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <label className="text-xs font-medium text-slate-600">Valor del módulo ({fuerzaSeleccionada.nombre})</label>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setModoValor("uniforme")}
              className={"text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors " +
                (modoValor === "uniforme" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}>
              Mismo valor todo el período
            </button>
            <button type="button" onClick={() => setModoValor("mensual")}
              className={"text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors " +
                (modoValor === "mensual" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}>
              Valor distinto por mes
            </button>
          </div>
        </div>

        {modoValor === "uniforme" ? (
          <div className="w-full sm:w-64">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-xs">$</span>
              <input
                value={valorModulo}
                onChange={e => setValorModulo(e.target.value)}
                placeholder="Valor vigente"
                className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>
          </div>
        ) : (
          <div>
            {mesesDetalle.length === 0 ? (
              <p className="text-xs text-slate-400">Elegí fechas de inicio y fin para poder cargar el valor de cada mes.</p>
            ) : (
              <div className="grid sm:grid-cols-3 md:grid-cols-4 gap-3">
                {mesesDetalle.map(m => (
                  <div key={m.mes}>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">{m.etiqueta}</label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 text-xs">$</span>
                      <input
                        value={valoresPorMes[m.mes] || ""}
                        onChange={e => actualizarValorMes(m.mes, e.target.value)}
                        placeholder="0"
                        className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Días de servicio calculados</div>
          <div className="text-2xl font-semibold text-slate-900">{dias}</div>
          <p className="text-[11px] text-slate-400 mt-1">Entre {fmtFecha(fechaInicio)} y {fmtFecha(fechaFin)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Total de módulos</div>
          <div className="text-2xl font-semibold text-slate-900">{totalModulos.toLocaleString("es-AR")}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {dias} días × {modulosPorDia || 0} módulo(s) × {cantidadOficiales || 1} oficial(es)
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Costo total estimado</div>
          <div className="text-2xl font-semibold text-slate-900">{costoTotal > 0 ? fmtMoneda(costoTotal) : "-"}</div>
          <p className="text-[11px] text-slate-400 mt-1">{fuerzaSeleccionada.nombre}</p>
        </div>
      </div>

      {mesesDetalle.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Desglose mensual</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2.5 px-5">Mes</th>
                  <th className="py-2.5 px-5">Días de servicio</th>
                  <th className="py-2.5 px-5">Módulos</th>
                  <th className="py-2.5 px-5">Valor módulo</th>
                  <th className="py-2.5 px-5">Monto</th>
                </tr>
              </thead>
              <tbody>
                {desgloseMensual.map(m => (
                  <tr key={m.mes} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 px-5 font-medium text-slate-900">{m.etiqueta}</td>
                    <td className="py-2 px-5 text-slate-600">{m.dias}</td>
                    <td className="py-2 px-5 text-slate-600">{m.modulos.toLocaleString("es-AR")}</td>
                    <td className="py-2 px-5 text-slate-600">{m.valorModulo > 0 ? fmtMoneda(m.valorModulo) : "-"}</td>
                    <td className="py-2 px-5 font-semibold text-slate-900">{m.monto > 0 ? fmtMoneda(m.monto) : "-"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-200">
                  <td className="py-2 px-5 font-semibold text-slate-900">Total</td>
                  <td className="py-2 px-5 font-semibold text-slate-900">{dias}</td>
                  <td className="py-2 px-5 font-semibold text-slate-900">{totalModulos.toLocaleString("es-AR")}</td>
                  <td className="py-2 px-5"></td>
                  <td className="py-2 px-5 font-semibold text-slate-900">{fmtMoneda(costoTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

