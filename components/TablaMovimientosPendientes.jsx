"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { fmtFecha, soloFechaLocal } from "@/lib/utils";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import BotonAccion from "./BotonAccion";

const CLASE_INPUT = "w-full text-xs bg-white border border-slate-300 rounded-md px-2 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800";
const ID_SECTORES = "mesa-pendientes-sectores";

// Lo que se precarga del pase del departamento: sale de donde Mesa lo tiene
// hoy (o del sector anterior que dijo el departamento) y entra al sector
// nuevo; el motivo y el estado de convocatoria van a observaciones.
function movimientoDesde(p) {
  const estado = p.expediente.estadoConvocatoria;
  return {
    fecha: hoyLocalISO(),
    vieneDe: p.sectorMesa || p.sectorAnterior || "",
    sector: p.sectorNuevo || "",
    subsector: "",
    observacion: [p.texto, estado ? "Estado de convocatoria: " + estado : ""].filter(Boolean).join(" — "),
  };
}

function Fila({ p, puedeConfirmar, onConfirmar }) {
  const [mov, setMov] = useState(() => movimientoDesde(p));
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function set(campo, valor) { setMov(prev => ({ ...prev, [campo]: valor })); setError(""); }

  async function confirmar() {
    if (!mov.fecha || !mov.sector.trim()) { setError("Completá la fecha y el sector."); return; }
    setGuardando(true);
    const res = await onConfirmar(p, mov);
    setGuardando(false);
    if (res?.error) setError(res.error);
  }

  return (
    <tr className="border-b border-slate-100 last:border-0 align-top">
      <td className="py-2.5 px-3">
        <div className="font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">{p.expediente.exp}</div>
        <div className="text-[11px] text-slate-500">{p.expediente.departamento.nombre}</div>
        <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5" title={p.expediente.objeto}>{p.expediente.objeto}</div>
      </td>
      <td className="py-2.5 px-3 text-xs">
        <div className="flex items-center gap-1 text-slate-700">
          <span>{p.sectorAnterior || "-"}</span>
          <ArrowRight size={12} className="text-slate-400 shrink-0" />
          <span className="font-medium text-slate-900">{p.sectorNuevo}</span>
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5">{fmtFecha(soloFechaLocal(p.fecha))} · {p.usuario}</div>
        {p.texto && <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2" title={p.texto}>{p.texto}</div>}
      </td>
      <td className="py-2.5 px-3 text-xs text-slate-700">{p.expediente.estadoConvocatoria || "-"}</td>
      <td className="py-2.5 px-2 w-[140px]"><input type="date" value={mov.fecha} onChange={e => set("fecha", e.target.value)} disabled={!puedeConfirmar} className={CLASE_INPUT} /></td>
      <td className="py-2.5 px-2 w-[150px]"><input list={ID_SECTORES} value={mov.vieneDe} onChange={e => set("vieneDe", e.target.value)} disabled={!puedeConfirmar} className={CLASE_INPUT} /></td>
      <td className="py-2.5 px-2 w-[150px]"><input list={ID_SECTORES} value={mov.sector} onChange={e => set("sector", e.target.value)} disabled={!puedeConfirmar} className={CLASE_INPUT} /></td>
      <td className="py-2.5 px-2 w-[130px]"><input list={ID_SECTORES} value={mov.subsector} onChange={e => set("subsector", e.target.value)} disabled={!puedeConfirmar} className={CLASE_INPUT} /></td>
      <td className="py-2.5 px-2 w-[240px]">
        <textarea value={mov.observacion} onChange={e => set("observacion", e.target.value)} disabled={!puedeConfirmar} rows={2} className={CLASE_INPUT + " resize-y"} />
        {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
      </td>
      <td className="py-2.5 px-3">
        {puedeConfirmar && (
          <BotonAccion onClick={confirmar} cargando={guardando} cargandoTexto="..."
            className="px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap">
            Confirmar
          </BotonAccion>
        )}
      </td>
    </tr>
  );
}

// Pases de sector que registraron los departamentos (desde la tabla o la
// ficha) y Mesa de Entradas tiene que confirmar, completando los datos de
// su movimiento. La fecha que carga Mesa es la que queda en la ficha del
// departamento y desde la que corren los días frenado.
export default function TablaMovimientosPendientes({ pendientes, sectores, puedeConfirmar, onConfirmar }) {
  return (
    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden">
      <div className="px-5 py-2.5 border-b border-amber-100 bg-amber-50/60">
        <h3 className="text-sm font-semibold text-slate-900">Movimientos para confirmar</h3>
        <span className="text-[11px] text-slate-600">
          {pendientes.length} pase{pendientes.length !== 1 ? "s" : ""} de sector registrado{pendientes.length !== 1 ? "s" : ""} por los departamentos. Completá el movimiento y confirmalo: su fecha pasa a ser la del último movimiento del expediente.
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[1400px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
              <th className="py-2 px-3">Exp / carátula</th>
              <th className="py-2 px-3">Pase del departamento</th>
              <th className="py-2 px-3">Estado de convocatoria</th>
              <th className="py-2 px-2">Fecha de ingreso</th>
              <th className="py-2 px-2">Viene del sector</th>
              <th className="py-2 px-2">Sector</th>
              <th className="py-2 px-2">Subsector</th>
              <th className="py-2 px-2">Observaciones</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {pendientes.map(p => <Fila key={p.id} p={p} puedeConfirmar={puedeConfirmar} onConfirmar={onConfirmar} />)}
          </tbody>
        </table>
      </div>
      <datalist id={ID_SECTORES}>
        {sectores.map(s => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
