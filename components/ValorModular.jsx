"use client";

import { useState } from "react";
import { Lock, Pencil } from "lucide-react";
import { CONFIG_ENCUADRES, CONFIG_GARANTIA, TIPOS_GARANTIA, EXCEPCIONES_GARANTIA } from "@/lib/constants";
import { fmtMoneda } from "@/lib/utils";
export default function ValorModular({ moduloValor, setModuloValor, sesion }) {
  const [editando, setEditando] = useState(false);
  const [valorTemp, setValorTemp] = useState(String(moduloValor));
  const puedeModificar = sesion.rol === "soporte";

  function guardar() {
    const num = Number(valorTemp.replace(/\./g, "").replace(",", "."));
    if (!num || num <= 0) return;
    setModuloValor(num);
    setEditando(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Valor Modular</h2>
        <p className="text-xs text-slate-500">Consejo de la Magistratura · Poder Judicial de la Nación</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Nuevo valor aprobado por CAF</div>
          {!editando ? (
            <div className="text-3xl font-semibold text-slate-900">{fmtMoneda(moduloValor)}</div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold text-slate-400">$</span>
              <input
                autoFocus
                value={valorTemp}
                onChange={e => setValorTemp(e.target.value)}
                className="text-2xl font-semibold text-slate-900 border-b-2 border-slate-800 focus:outline-none w-40"
              />
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-1">Valor de referencia de 1 módulo, base de cálculo para los encuadres de contratación.</p>
        </div>

        {puedeModificar ? (
          editando ? (
            <div className="flex gap-2">
              <button onClick={() => { setEditando(false); setValorTemp(String(moduloValor)); }} className="px-3 py-2 rounded-md border border-slate-300 text-xs font-medium hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={guardar} className="px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                Guardar nuevo valor
              </button>
            </div>
          ) : (
            <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              <Pencil size={13} /> Modificar valor
            </button>
          )
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            <Lock size={13} /> Solo el usuario de Soporte puede modificar este valor
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Escala de encuadres por módulos</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="py-2.5 px-5">Encuadre</th>
              <th className="py-2.5 px-5">Módulos</th>
              <th className="py-2.5 px-5">Monto</th>
              <th className="py-2.5 px-5">Artículo</th>
            </tr>
          </thead>
          <tbody>
            {CONFIG_ENCUADRES.map(e => (
              <tr key={e.nombre} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="py-2.5 px-5 font-medium text-slate-900">{e.nombre}</td>
                <td className="py-2.5 px-5 text-slate-600">
                  {e.comparador === "hasta" ? "Hasta " : "Más de "}{e.modulos.toLocaleString("es-AR")} módulos
                </td>
                <td className="py-2.5 px-5 font-semibold text-slate-900">
                  {e.comparador === "hasta" ? "Hasta " : "Más de "}{fmtMoneda(e.modulos * moduloValor)}
                </td>
                <td className="py-2.5 px-5 text-slate-500 font-mono text-xs">{e.articulo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            Art. 8) Garantía — Valor de la garantía
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Si fuera menor al equivalente a {CONFIG_GARANTIA.modulosValorGarantia} módulos
          </p>
          <div className="text-2xl font-semibold text-slate-900">
            {fmtMoneda(CONFIG_GARANTIA.modulosValorGarantia * moduloValor)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            Art. 8) Garantía — Excepción de garantía
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Cuando el monto de garantía no fuera superior a {CONFIG_GARANTIA.modulosExcepcion} módulos
          </p>
          <div className="text-2xl font-semibold text-slate-900">
            {fmtMoneda(CONFIG_GARANTIA.modulosExcepcion * moduloValor)}
          </div>
        </div>
      </div>

      <CalculadoraGarantias moduloValor={moduloValor} />
    </div>
  );
}

function CalculadoraGarantias({ moduloValor }) {
  const [tipo, setTipo] = useState("mantenimiento");
  const [monto, setMonto] = useState("");
  const [excepciones, setExcepciones] = useState([]);

  const tipoSeleccionado = TIPOS_GARANTIA.find(t => t.key === tipo);
  const montoNum = Number(monto.replace(/\./g, "").replace(",", ".")) || 0;
  const montoGarantia = montoNum * tipoSeleccionado.porcentaje;

  const umbralExcepcion = CONFIG_GARANTIA.modulosExcepcion * moduloValor;
  const umbralPagare = CONFIG_GARANTIA.modulosValorGarantia * moduloValor;

  function toggleExcepcion(key) {
    setExcepciones(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  }

  let resultado = null;
  if (montoNum > 0) {
    if (excepciones.length > 0) {
      resultado = {
        nivel: "verde",
        titulo: "No corresponde presentar garantía",
        detalle: "Aplica excepción del Art. 129, inciso " + excepciones.map(k => k.toUpperCase()).join(", ") + ".",
      };
    } else if (montoGarantia <= umbralExcepcion) {
      resultado = {
        nivel: "verde",
        titulo: "No corresponde presentar garantía",
        detalle: "El monto calculado (" + fmtMoneda(montoGarantia) + ") no supera el equivalente a " + CONFIG_GARANTIA.modulosExcepcion + " módulos (" + fmtMoneda(umbralExcepcion) + ").",
      };
    } else if (montoGarantia < umbralPagare) {
      resultado = {
        nivel: "amarillo",
        titulo: "Corresponde garantía — puede constituirse como PAGARÉ",
        detalle: "El monto (" + fmtMoneda(montoGarantia) + ") es menor al equivalente a " + CONFIG_GARANTIA.modulosValorGarantia + " módulos (" + fmtMoneda(umbralPagare) + "), por lo que puede integrarse con pagaré u otras formas del Art. 127.",
      };
    } else {
      resultado = {
        nivel: "rojo",
        titulo: "Corresponde garantía — póliza de seguro de caución",
        detalle: "El monto (" + fmtMoneda(montoGarantia) + ") es igual o mayor al equivalente a " + CONFIG_GARANTIA.modulosValorGarantia + " módulos (" + fmtMoneda(umbralPagare) + "), por lo que debe integrarse mediante póliza de seguro de caución u otra forma del Art. 127, a favor del Poder Judicial de la Nación, sin vencimiento.",
      };
    }
  }

  const ESTILO_RESULTADO = {
    verde: "bg-emerald-50 border-emerald-300 text-emerald-800",
    amarillo: "bg-amber-50 border-amber-300 text-amber-800",
    rojo: "bg-red-50 border-red-300 text-red-800",
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
        Calculadora de garantías (Art. 8°)
      </h3>
      <p className="text-[11px] text-slate-400 mb-4">
        Los umbrales de excepción y de pagaré se calculan con el valor modular vigente ({fmtMoneda(moduloValor)} por módulo).
      </p>

      <div className="grid sm:grid-cols-3 gap-2 mb-4">
        {TIPOS_GARANTIA.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTipo(t.key)}
            className={"text-left rounded-md border px-3 py-2.5 transition-colors " +
              (tipo === t.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-400 text-slate-700")}
          >
            <div className="text-xs font-semibold">{t.label}</div>
            <div className={"text-[11px] mt-0.5 " + (tipo === t.key ? "text-slate-300" : "text-slate-500")}>{t.descripcion}</div>
          </button>
        ))}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1">
          {tipo === "contragarantia" ? "Monto del anticipo a garantizar (ARS)" : "Monto total de la oferta / contrato (ARS)"}
        </label>
        <input
          value={monto}
          onChange={e => setMonto(e.target.value)}
          placeholder="Ej: 25000000"
          className="w-full sm:w-64 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
        />
        {montoNum > 0 && (
          <p className="text-[11px] text-slate-500 mt-1.5">
            Garantía calculada ({Math.round(tipoSeleccionado.porcentaje * 100)}%): <strong className="text-slate-800">{fmtMoneda(montoGarantia)}</strong>
          </p>
        )}
      </div>

      {tipo !== "contragarantia" && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-600 mb-2">¿Aplica alguna excepción del Art. 129? (opcional)</p>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {EXCEPCIONES_GARANTIA.map(exc => (
              <label key={exc.key} className="flex items-start gap-2 text-[11px] text-slate-600 rounded-md px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excepciones.includes(exc.key)}
                  onChange={() => toggleExcepcion(exc.key)}
                  className="w-3.5 h-3.5 mt-0.5 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
                />
                <span><strong className="uppercase">{exc.key})</strong> {exc.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {resultado && (
        <div className={"border rounded-md px-4 py-3 text-sm " + ESTILO_RESULTADO[resultado.nivel]}>
          <div className="font-semibold mb-1">{resultado.titulo}</div>
          <p className="text-xs opacity-90">{resultado.detalle}</p>
        </div>
      )}

      {!resultado && (
        <p className="text-xs text-slate-400">Ingresá un monto para calcular si corresponde presentar garantía.</p>
      )}
    </div>
  );
}

