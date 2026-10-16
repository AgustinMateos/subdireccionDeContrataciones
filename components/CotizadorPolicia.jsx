"use client";

import { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { CheckCircle2, Download, Shield, CalendarDays, FileText } from "lucide-react";
import { FUERZAS_SEGURIDAD, PERIODICIDADES_POLICIA, FERIADOS_2026 } from "@/lib/constants";
import { calcularDiasServicio, diasServicioPorMes, fmtMoneda, fmtFecha } from "@/lib/utils";
import { armarPase } from "@/lib/paseContaduria";
import { mismoExp, normalizarExp } from "@/lib/numeroExpediente";
export default function CotizadorPolicia({ mostrarToast, expedientes, onAprobarYVincular }) {
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
  // Pase a Contaduría: lo que no sale de la cotización.
  const [ejercicio, setEjercicio] = useState("");
  const [fojasPresupuesto, setFojasPresupuesto] = useState("");
  const [fojasCuadro, setFojasCuadro] = useState("");
  const [agente, setAgente] = useState("");

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

  const pase = armarPase({
    exp: normalizarExp(expNro.trim()), fuerza: fuerzaSeleccionada.nombre, destino: objeto.trim(), inicio: fechaInicio, fin: fechaFin,
    monto: costoTotal, ejercicio: ejercicio.trim() || fechaInicio.slice(0, 4), fojasPresupuesto: fojasPresupuesto.trim(),
    fojasCuadro: fojasCuadro.trim(), agente: agente.trim(), anio: new Date().getFullYear(),
  });

  // Pase a Contaduría en Word (.doc armado desde HTML, como la Planilla de
  // Cotización): letra Courier, sangría y negritas como el modelo.
  function descargarPase() {
    if (!expNro.trim()) { mostrarToast("Indicá el N° de expediente para el pase"); return; }
    if (costoTotal <= 0) { mostrarToast("Cargá el valor del módulo: el pase necesita el monto"); return; }
    if (!objeto.trim()) { mostrarToast("Completá el destino del servicio (objeto)"); return; }
    if (ejercicio.trim() && !/^\d{4}$/.test(ejercicio.trim())) { mostrarToast("El ejercicio va con el año completo, 4 dígitos (ej.: 2026)"); return; }
    if (!agente.trim()) { mostrarToast("Indicá el agente: va abajo de DEPARTAMENTO DE INFORMATICA Y VARIOS"); return; }
    const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const tramo = x => (typeof x === "string" ? esc(x) : "<b>" + esc(x.negrita) + "</b>");
    const letra = "font-family:'Courier New',Courier,monospace;font-size:11pt;";
    const html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="utf-8"><title>Pase a Contaduría ' + esc(pase.expediente) + "</title><style>" +
      "@page Section1 { size: 595.3pt 841.9pt; margin: 2.5cm 2cm 2.5cm 3cm; } div.Section1 { page: Section1; }" +
      "p { " + letra + " margin: 0; line-height: 200%; }" +
      ".membrete { font-family: Calibri, sans-serif; color: #7f7f7f; line-height: 120%; }" +
      // Desde "Atenta…" hasta el agente: justificado, nivel de esquema
      // "Texto independiente" (el de un párrafo normal) e interlineado de
      // 1,5 líneas (así lo guarda Word: line-height 150%).
      ".cuerpo { text-align: justify; line-height: 150%; }" +
      ".parrafo { text-indent: 6.5cm; margin-bottom: 4pt; }" +
      "</style><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--></head>" +
      "<body><div class='Section1'>" +
      "<p class='membrete' style='font-size:16pt;'>CONSEJO DE LA MAGISTRATURA</p>" +
      "<p class='membrete' style='font-size:16pt;'>PODER JUDICIAL DE LA NACIÓN</p>" +
      "<p class='membrete' style='font-size:10pt;margin-top:8pt;'>SUBDIRECCIÓN DE CONTRATACIONES</p>" +
      "<p class='membrete' style='font-size:10pt;'>ADMINISTRACIÓN GENERAL</p><br/><br/>" +
      "<p style='margin-left:6.5cm;'><b>EXPEDIENTE N° " + esc(pase.expediente) + "</b></p><br/>" +
      "<p style='margin-left:6.5cm;'>" + esc(pase.lugarYFecha) + "</p><br/>" +
      pase.parrafos.map(partes => "<p class='cuerpo parrafo'>" + partes.map(tramo).join("") + "</p>").join("") +
      "<p class='cuerpo'><b>" + esc(pase.firma) + "</b></p>" +
      (pase.agente ? "<p class='cuerpo'><b>" + esc(pase.agente) + "</b></p>" : "") +
      "</div></body></html>";
    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Pase_Contaduria_" + expNro.trim().replace(/[\/\s]+/g, "-") + ".doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarToast("Pase a Contaduría descargado (Word)");
  }

  function handleExpNroChange(valor) {
    setExpNro(valor);
    const match = expedientes?.find(e => mismoExp(e.exp, valor));
    if (match) setObjeto(match.objeto || "");
  }

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
    if (!expNro.trim()) {
      mostrarToast("Indicá el N° de expediente para vincular la cotización");
      return;
    }
    onAprobarYVincular({
      expNro: expNro.trim(),
      fuerza,
      periodicidad,
      periodo: { inicio: fechaInicio, fin: fechaFin },
      dias,
      modulosPorDia: modulosPorDiaNum,
      cantidadOficiales: oficialesNum,
      totalModulos,
      costoTotal,
      objeto,
      desglose: desgloseMensual.map(m => ({
        mes: m.mes, etiqueta: m.etiqueta, dias: m.dias, modulos: m.modulos, valorModulo: m.valorModulo, monto: m.monto,
      })),
      texto:
        "Cotizador de policía adicional aprobado: " + fuerzaSeleccionada.nombre + ", " + periodicidadSeleccionada.label +
        ", " + totalModulos.toLocaleString("es-AR") + " módulos = " + fmtMoneda(costoTotal) + ".",
    });
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
            <input type="date" max="9999-12-31" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
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
            <input type="date" max="9999-12-31" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
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
            <input value={expNro} onChange={e => handleExpNroChange(e.target.value)} list="lista-exp-policia" placeholder="13-00000/2026"
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

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><FileText size={16} className="text-slate-500" /> Pase a Contaduría</h3>
            <p className="text-xs text-slate-500">Se arma con la cotización: expediente, fuerza, período y monto (en números y en letras). Completá lo que falta y descargalo en Word.</p>
          </div>
          <button type="button" onClick={descargarPase}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-sky-700 text-white text-xs font-medium hover:bg-sky-800">
            <Download size={14} /> Descargar pase (Word)
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Destino del servicio (objeto) · se lee &quot;con destino …&quot;</label>
          <textarea value={objeto} onChange={e => setObjeto(e.target.value)} rows={2}
            placeholder="al servicio solicitado por el Dr. Pablo Javier Flores, Titular del Tribunal Oral en lo Criminal Federal N°3 de San Martín, sito en la calle Yapeyú N°1922 San Martín, Pcia. De Buenos Aires"
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y" />
        </div>
        <div className="grid sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ejercicio financiero</label>
            <input value={ejercicio} onChange={e => setEjercicio(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={fechaInicio.slice(0, 4)}
              inputMode="numeric" maxLength={4}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Presupuesto y convenio · fs.</label>
            <input value={fojasPresupuesto} onChange={e => setFojasPresupuesto(e.target.value)} placeholder="8/13"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Cuadro de costos (el Excel) · fs.</label>
            <input value={fojasCuadro} onChange={e => setFojasCuadro(e.target.value)} placeholder="14"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Agente (va abajo del Departamento)</label>
            <input value={agente} onChange={e => setAgente(e.target.value)} placeholder="AM"
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-5 font-mono text-[13px] leading-7 text-slate-800">
          <p className="pl-[38%] font-bold">EXPEDIENTE N° {pase.expediente}</p>
          <p className="pl-[38%] mt-3">{pase.lugarYFecha}</p>
          {pase.parrafos.map((partes, i) => (
            <p key={i} className="mt-3 text-justify indent-[38%]">
              {partes.map((x, j) => (typeof x === "string" ? x : <b key={j}>{x.negrita}</b>))}
            </p>
          ))}
          <p className="mt-3 font-bold">{pase.firma}</p>
          <p className="font-bold">{pase.agente || "......"}</p>
        </div>
      </div>
    </div>
  );
}

