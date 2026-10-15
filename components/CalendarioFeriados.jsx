"use client";

// Calendario propio para elegir un día, con los feriados nacionales (de
// ArgentinaDatos, vía /api/feriados), los inhábiles judiciales y los fines
// de semana marcados. El <input type="date"> del navegador no deja
// marcarlos. Las fechas van como "aaaa-mm-dd".

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NOMBRES_INHABILES_JUDICIALES } from "@/lib/diasHabiles";
import { hoyLocalISO } from "@/lib/mesaEntradas";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_SEMANA = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

const aFecha = iso => new Date(iso + "T00:00:00.000Z");
const aISO = (a, m, d) => a + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
// Lunes = 0 ... domingo = 6.
const diaSemana = iso => (aFecha(iso).getUTCDay() + 6) % 7;

// "lunes 5 de enero de 2026"
export function diaLargo(iso) {
  const f = aFecha(iso);
  return DIAS_SEMANA[diaSemana(iso)] + " " + f.getUTCDate() + " de " + MESES[f.getUTCMonth()] + " de " + f.getUTCFullYear();
}

// Feriados por año, pedidos una sola vez por página.
const pedidos = new Map();
function pedirFeriados(anio) {
  if (!pedidos.has(anio)) {
    pedidos.set(anio, fetch("/api/feriados?anios=" + anio)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(d => new Map((d.detalle || []).map(f => [f.fecha, f.nombre])))
      .catch(() => { pedidos.delete(anio); return null; }));
  }
  return pedidos.get(anio);
}

// Map "aaaa-mm-dd" → nombre del feriado de ese año; undefined mientras
// llega, null si no se pudo traer.
export function useFeriados(anio) {
  const [estado, setEstado] = useState({ anio: null, feriados: undefined });
  useEffect(() => {
    if (!anio) return;
    let activo = true;
    pedirFeriados(anio).then(f => { if (activo) setEstado({ anio, feriados: f }); });
    return () => { activo = false; };
  }, [anio]);
  return estado.anio === anio ? estado.feriados : undefined;
}

// Por qué un día no es hábil: { tipo: "feriado" | "judicial" | "finde", nombre }, o null.
export function motivoInhabil(iso, feriados) {
  if (feriados?.has(iso)) return { tipo: "feriado", nombre: feriados.get(iso) };
  const judicial = NOMBRES_INHABILES_JUDICIALES[iso.slice(5)];
  if (judicial && diaSemana(iso) < 5) return { tipo: "judicial", nombre: judicial };
  if (diaSemana(iso) >= 5) return { tipo: "finde", nombre: diaSemana(iso) === 5 ? "Sábado" : "Domingo" };
  return null;
}

const ESTILO = {
  feriado: "bg-red-50 text-red-700 border-red-200",
  judicial: "bg-amber-50 text-amber-800 border-amber-200",
  finde: "bg-slate-50 text-slate-400 border-transparent",
};

export default function CalendarioFeriados({ valor, onElegir }) {
  const hoy = hoyLocalISO();
  const inicio = valor || hoy;
  const [mes, setMes] = useState({ a: Number(inicio.slice(0, 4)), m: Number(inicio.slice(5, 7)) - 1 });
  const feriados = useFeriados(mes.a);

  const diasDelMes = new Date(Date.UTC(mes.a, mes.m + 1, 0)).getUTCDate();
  const primero = aISO(mes.a, mes.m, 1);
  const celdas = [...Array(diaSemana(primero)).fill(null), ...Array.from({ length: diasDelMes }, (_, i) => aISO(mes.a, mes.m, i + 1))];
  const delMes = celdas.filter(Boolean).map(iso => ({ iso, motivo: motivoInhabil(iso, feriados) })).filter(d => d.motivo && d.motivo.tipo !== "finde");
  const mover = n => setMes(({ a, m }) => ({ a: a + Math.floor((m + n) / 12), m: (m + n + 12) % 12 }));

  return (
    <div className="mt-2 w-full max-w-sm rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => mover(-1)} aria-label="Mes anterior" className="p-2 rounded-lg hover:bg-slate-100"><ChevronLeft size={22} /></button>
        <p className="text-base font-semibold text-slate-900 capitalize">{MESES[mes.m]} {mes.a}</p>
        <button type="button" onClick={() => mover(1)} aria-label="Mes siguiente" className="p-2 rounded-lg hover:bg-slate-100"><ChevronRight size={22} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i} className="text-xs font-medium text-slate-500 py-1">{d}</span>)}
        {celdas.map((iso, i) => {
          if (!iso) return <span key={"v" + i} />;
          const motivo = motivoInhabil(iso, feriados);
          const elegido = iso === valor;
          return (
            <button key={iso} type="button" onClick={() => onElegir(iso)} title={motivo?.nombre || ""}
              className={"h-11 rounded-lg border text-base tabular-nums transition-colors " +
                (elegido ? "bg-slate-900 text-white border-slate-900 font-semibold"
                  : (motivo ? ESTILO[motivo.tipo] : "border-transparent text-slate-800 hover:bg-slate-100") +
                    (iso === hoy ? " ring-2 ring-slate-900 ring-inset font-semibold" : ""))}>
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1"><span className={"w-3 h-3 rounded border " + ESTILO.feriado} /> Feriado</span>
        <span className="inline-flex items-center gap-1"><span className={"w-3 h-3 rounded border " + ESTILO.judicial} /> Inhábil judicial</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100" /> Fin de semana</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded ring-2 ring-slate-900 ring-inset" /> Hoy</span>
      </div>
      {feriados === null && <p className="mt-2 text-xs text-amber-800">No se pudieron traer los feriados: solo se marcan los fines de semana y los inhábiles judiciales.</p>}
      {delMes.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-sm">
          {delMes.map(d => (
            <li key={d.iso} className={d.motivo.tipo === "feriado" ? "text-red-700" : "text-amber-800"}>
              <span className="font-medium capitalize">{DIAS_SEMANA[diaSemana(d.iso)]} {Number(d.iso.slice(8))}</span> · {d.motivo.nombre}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
