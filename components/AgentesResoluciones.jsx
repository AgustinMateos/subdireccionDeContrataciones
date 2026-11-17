"use client";

// Agentes de Resoluciones (solo Soporte): agregar agentes y marcarlos
// activos o inactivos. A los inactivos no se les asignan expedientes, pero
// siguen en los que ya tienen y en el histórico.

import { useEffect, useState } from "react";
import { Plus, UserCheck, UserX } from "lucide-react";

export default function AgentesResoluciones({ mostrarToast }) {
  const [agentes, setAgentes] = useState(null);
  const [error, setError] = useState("");
  const [sigla, setSigla] = useState("");
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(null); // id del que se está guardando, o "nuevo"

  useEffect(() => {
    let vivo = true;
    fetch("/api/resoluciones/agentes")
      .then(r => r.json().then(d => (r.ok ? d : Promise.reject(new Error(d.error)))))
      .then(d => { if (vivo) setAgentes(d.agentes); })
      .catch(err => { if (vivo) setError(err.message || "No se pudo cargar la lista"); });
    return () => { vivo = false; };
  }, []);

  async function pedir(metodo, cuerpo) {
    try {
      const res = await fetch("/api/resoluciones/agentes", { method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { mostrarToast(data.error || "No se pudo guardar"); return null; }
      return data.agente;
    } catch {
      mostrarToast("Sin conexión: no se guardó el cambio");
      return null;
    }
  }

  async function agregar(ev) {
    ev.preventDefault();
    if (!sigla.trim()) return;
    setGuardando("nuevo");
    const agente = await pedir("POST", { sigla, nombre });
    setGuardando(null);
    if (!agente) return;
    setAgentes(prev => [...prev, agente]);
    setSigla("");
    setNombre("");
    mostrarToast(agente.sigla + " agregado como activo");
  }

  async function cambiarActivo(a) {
    setGuardando(a.id);
    const agente = await pedir("PATCH", { id: a.id, activo: !a.activo });
    setGuardando(null);
    if (!agente) return;
    setAgentes(prev => prev.map(x => (x.id === agente.id ? agente : x)));
    mostrarToast(agente.sigla + (agente.activo ? " ahora está activo" : " quedó inactivo: ya no se le asignan expedientes"));
  }

  const orden = (a, b) => Number(b.activo) - Number(a.activo) || a.sigla.localeCompare(b.sigla);
  const lista = (agentes || []).slice().sort(orden);
  const activos = lista.filter(a => a.activo).length;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Agentes de Resoluciones</h2>
        <p className="text-xs text-slate-500">
          La jefa de la Subdirección solo puede asignar expedientes a los agentes activos. Los inactivos siguen apareciendo en los expedientes que ya tenían y en el análisis.
        </p>
      </div>

      <form onSubmit={agregar} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Sigla</span>
          <input value={sigla} onChange={e => setSigla(e.target.value.toUpperCase())} placeholder="Ej.: ABC" maxLength={10}
            className="w-28 px-3 py-2 text-sm font-mono rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Nombre (opcional)</span>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre y apellido"
            className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </label>
        <button type="submit" disabled={!sigla.trim() || guardando === "nuevo"}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
          <Plus size={13} /> Agregar agente
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-xs text-slate-500">
          {agentes ? `${activos} activos · ${lista.length - activos} inactivos` : error || "Cargando..."}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {lista.map(a => (
              <tr key={a.id} className="border-b border-slate-50 last:border-0">
                <td className={"py-2.5 px-5 font-mono font-semibold " + (a.activo ? "text-slate-900" : "text-slate-400")}>{a.sigla}</td>
                <td className={"py-2.5 px-5 " + (a.activo ? "text-slate-700" : "text-slate-400")}>{a.nombre || "-"}</td>
                <td className="py-2.5 px-5">
                  <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " +
                    (a.activo ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200")}>
                    {a.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="py-2.5 px-5 text-right">
                  <button type="button" onClick={() => cambiarActivo(a)} disabled={guardando === a.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                    {a.activo ? <><UserX size={13} /> Desactivar</> : <><UserCheck size={13} /> Activar</>}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
