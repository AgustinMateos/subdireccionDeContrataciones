"use client";

// Registro de cambios (solo Soporte): lo que se hizo en el panel de
// Resoluciones — altas, ediciones, borrados de expedientes y del historial —
// con quién y cuándo. Ver lib/auditoria.js.

import { useEffect, useMemo, useState } from "react";
import { History, RefreshCw } from "lucide-react";
import { ACCIONES_AUDITORIA } from "@/lib/auditoria";

const ESTILO_ACCION = {
  alta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  edicion: "bg-sky-50 text-sky-700 border-sky-200",
  "cambio-rapido": "bg-sky-50 text-sky-700 border-sky-200",
  borrado: "bg-red-50 text-red-700 border-red-200",
  "observacion-editada": "bg-amber-50 text-amber-800 border-amber-200",
  "historial-borrado": "bg-red-50 text-red-700 border-red-200",
};

const fechaHora = f => new Date(f).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });
const fechaCorta = f => (f ? new Date(f).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "-");

// Datos de la copia de un expediente borrado que se muestran.
const DATOS_COPIA = [
  ["numero", "N° de contratación"], ["fuero", "Fuero"], ["organismo", "Organismo"], ["tipoContratacion", "Tipo de contratación"],
  ["tipoResolucion", "Tipo de resolución"], ["estado", "Estado"], ["situacion", "Estado gral."], ["sectorActual", "Sector actual"],
  ["agente", "Agente"], ["montos", "Montos"], ["observaciones", "Observaciones"],
];

export default function RegistroCambios() {
  const [registros, setRegistros] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [accion, setAccion] = useState("");
  const [usuario, setUsuario] = useState("");

  async function cargar() {
    setError("");
    try {
      const res = await fetch("/api/auditoria?panel=resoluciones");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo leer el registro de cambios");
      setRegistros(data.registros);
    } catch (err) {
      setError(err.message);
      setRegistros(prev => prev || []);
    }
  }
  useEffect(() => { cargar(); }, []);

  const usuarios = useMemo(() => [...new Set((registros || []).map(r => r.usuario))].sort(), [registros]);
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (registros || []).filter(r =>
      (!accion || r.accion === accion) && (!usuario || r.usuario === usuario)
      && (!q || [r.exp, r.usuario, r.detalle?.objeto].some(v => String(v || "").toLowerCase().includes(q))));
  }, [registros, busqueda, accion, usuario]);

  const CLASE_FILTRO = "text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <History size={18} className="text-slate-500" /> Registro de cambios · Resoluciones
          </h2>
          <p className="text-xs text-slate-500">Qué se cargó, editó o borró en el panel de Resoluciones, quién y cuándo. Los borrados guardan una copia.</p>
        </div>
        <button onClick={cargar} className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md px-3 py-2">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por N° de expediente, objeto o usuario..." className={CLASE_FILTRO + " w-full sm:w-80"} />
        <select value={accion} onChange={e => setAccion(e.target.value)} className={CLASE_FILTRO}>
          <option value="">Todas las acciones</option>
          {Object.entries(ACCIONES_AUDITORIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={usuario} onChange={e => setUsuario(e.target.value)} className={CLASE_FILTRO}>
          <option value="">Todos los usuarios</option>
          {usuarios.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
              <th className="py-2.5 px-4 whitespace-nowrap">Fecha y hora</th>
              <th className="py-2.5 px-4">Usuario</th>
              <th className="py-2.5 px-4">Acción</th>
              <th className="py-2.5 px-4">Expediente</th>
              <th className="py-2.5 px-4">Qué se hizo</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(r => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0 align-top">
                <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">{fechaHora(r.creadoEn)}</td>
                <td className="py-2.5 px-4 text-slate-800">{r.usuario}</td>
                <td className="py-2.5 px-4">
                  <span className={"text-[11px] font-medium px-2 py-0.5 rounded border whitespace-nowrap " + (ESTILO_ACCION[r.accion] || "bg-slate-50 text-slate-600 border-slate-200")}>
                    {ACCIONES_AUDITORIA[r.accion] || r.accion}
                  </span>
                </td>
                <td className="py-2.5 px-4">
                  <div className="font-mono text-slate-900 whitespace-nowrap">{r.detalle?.esEscrito ? "ESC " : ""}{r.exp || "-"}</div>
                  {r.detalle?.objeto && <div className="text-[11px] text-slate-500 max-w-[240px] line-clamp-2">{r.detalle.objeto}</div>}
                </td>
                <td className="py-2.5 px-4 text-slate-700"><Detalle registro={r} /></td>
              </tr>
            ))}
            {registros && filtrados.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">No hay cambios registrados{busqueda || accion || usuario ? " con esos filtros" : " todavía"}.</td></tr>
            )}
            {!registros && (
              <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">Cargando...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detalle({ registro: r }) {
  const d = r.detalle || {};
  if (r.accion === "borrado") return <CopiaBorrada copia={d.copia} />;
  if (r.accion === "historial-borrado" || r.accion === "observacion-editada") {
    const m = d.movimiento || {};
    return (
      <div className="space-y-0.5">
        <div><b>{m.campo}</b>: {r.accion === "observacion-editada"
          ? <><span className="line-through text-slate-400">{m.valor}</span> → {d.cambios?.[0]?.nuevo}</>
          : <>{m.anterior ? m.anterior + " → " : ""}{m.valor}</>}
        </div>
        <div className="text-[11px] text-slate-500">Lo había cargado {m.cargadoPor || "-"} el {fechaCorta(m.fecha)}</div>
      </div>
    );
  }
  if (!d.cambios?.length) return <span className="text-slate-400">-</span>;
  return (
    <ul className="space-y-0.5">
      {d.cambios.map((c, i) => (
        <li key={i}>
          <b>{c.campo}</b>: {c.anterior != null && <><span className="text-slate-400">{c.anterior}</span> → </>}{c.nuevo ?? <span className="text-slate-400">(vacío)</span>}
        </li>
      ))}
    </ul>
  );
}

// Un expediente borrado: sus datos y su historial, a demanda.
function CopiaBorrada({ copia }) {
  if (!copia) return <span className="text-slate-400">Sin copia</span>;
  const movimientos = copia.movimientos || [];
  return (
    <details>
      <summary className="cursor-pointer text-red-700 hover:text-red-800">
        Se borró el expediente · ver copia{movimientos.length ? " (con " + movimientos.length + " movimientos)" : ""}
      </summary>
      <div className="mt-2 space-y-2 text-xs">
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5">
          {DATOS_COPIA.filter(([k]) => copia[k] != null && copia[k] !== "").map(([k, label]) => (
            <Fragmento key={k} label={label} valor={copia[k]} />
          ))}
          <Fragmento label="Ingreso al sector" valor={fechaCorta(copia.fechaIngreso)} />
          <Fragmento label="Cargado el" valor={fechaHora(copia.creadoEn)} />
        </dl>
        {movimientos.length > 0 && (
          <div>
            <div className="font-semibold text-slate-600 mb-0.5">Historial</div>
            <ul className="space-y-0.5">
              {movimientos.map(m => (
                <li key={m.id}>{fechaCorta(m.fecha)} · <b>{m.campo}</b>: {m.sectorAnterior ? m.sectorAnterior + " → " : ""}{m.sector} <span className="text-slate-400">({m.usuario})</span></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function Fragmento({ label, valor }) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800">{String(valor)}</dd>
    </>
  );
}
