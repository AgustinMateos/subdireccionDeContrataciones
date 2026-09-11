"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { ESTADOS_CONVOCATORIA_FALLIDOS } from "@/lib/constants";
import BotonAccion from "./BotonAccion";

const OPCIONES = [
  { key: "integra", label: "Adjudicación íntegra", estado: "Adjudicación íntegra" },
  { key: "fracasada", label: "Fracasada", estado: "Proyecto fracasado" },
  { key: "desierta", label: "Desierta", estado: "Desierta" },
  { key: "parcial", label: "Adjudicación parcial" },
];

function grupoVacio() {
  return {
    id: Math.random().toString(36).slice(2),
    seleccionados: [],
    exp: "",
    objeto: "",
    estadoConvocatoria: "Proyecto fracasado",
    fechaInicio: "",
    fechaVencimiento: "",
  };
}

// Resuelve el resultado de la convocatoria de `exp`: íntegra/fracasada/desierta
// se aplican a todo el expediente (solo cambia el estado de convocatoria). La
// adjudicación parcial permite armar uno o más expedientes nuevos, cada uno
// con su propio subconjunto de domicilios/renglones fracasados, su objeto y
// sus fechas — el resto queda en este mismo expediente, que sigue su curso.
export default function ResolverAdjudicacion({ exp, onCerrar, onResolverTotal, onDividir }) {
  const [opcion, setOpcion] = useState("integra");
  const [grupos, setGrupos] = useState([grupoVacio()]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const disponibles = exp.domiciliosRenglones || [];

  function actualizarGrupo(id, campo, valor) {
    setGrupos(prev => prev.map(g => (g.id === id ? { ...g, [campo]: valor } : g)));
  }

  function toggleSeleccion(grupoId, domicilio) {
    setGrupos(prev => prev.map(g => {
      if (g.id !== grupoId) return g;
      const seleccionados = g.seleccionados.includes(domicilio)
        ? g.seleccionados.filter(d => d !== domicilio)
        : [...g.seleccionados, domicilio];
      return { ...g, seleccionados };
    }));
  }

  function agregarGrupo() {
    setGrupos(prev => [...prev, grupoVacio()]);
  }

  function quitarGrupo(id) {
    setGrupos(prev => (prev.length > 1 ? prev.filter(g => g.id !== id) : prev));
  }

  async function confirmar() {
    setError("");
    const opcionElegida = OPCIONES.find(o => o.key === opcion);

    if (opcion !== "parcial") {
      setCargando(true);
      await onResolverTotal(opcionElegida.estado);
      setCargando(false);
      return;
    }

    for (const g of grupos) {
      if (g.seleccionados.length === 0) {
        setError("Cada expediente nuevo necesita al menos un domicilio/renglón elegido.");
        return;
      }
      if (!g.exp.trim() || !g.fechaVencimiento) {
        setError("Completá N° de expediente y fecha de vencimiento en cada división.");
        return;
      }
    }
    setCargando(true);
    await onDividir(grupos.map(g => ({
      exp: g.exp,
      objeto: g.objeto,
      estadoConvocatoria: g.estadoConvocatoria,
      fechaInicio: g.fechaInicio,
      fechaVencimiento: g.fechaVencimiento,
      domiciliosRenglones: g.seleccionados,
    })));
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Resolver adjudicación</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {OPCIONES.map(o => (
              <label key={o.key} className={"flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer " +
                (opcion === o.key ? "border-slate-800 bg-slate-50" : "border-slate-300")}>
                <input type="radio" name="opcionAdjudicacion" checked={opcion === o.key} onChange={() => setOpcion(o.key)}
                  className="text-slate-800 focus:ring-slate-800" />
                {o.label}
              </label>
            ))}
          </div>

          {opcion !== "parcial" ? (
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
              Se aplica a todos los domicilios/renglones de este expediente — el estado de convocatoria queda en
              "{OPCIONES.find(o => o.key === opcion).estado}".
            </p>
          ) : (
            <div className="space-y-4">
              {disponibles.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Este expediente no tiene domicilios/renglones cargados. Agregalos primero desde "Editar expediente".
                </p>
              ) : (
                <>
                  {grupos.map((g, idx) => {
                    const asignadosEnOtros = grupos.filter(x => x.id !== g.id).flatMap(x => x.seleccionados);
                    return (
                      <div key={g.id} className="border border-slate-200 rounded-md p-3 space-y-3 bg-slate-50">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700">Expediente nuevo {idx + 1}</span>
                          {grupos.length > 1 && (
                            <button type="button" onClick={() => quitarGrupo(g.id)} className="text-slate-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">Domicilios/renglones fracasados</label>
                          <div className="space-y-1 max-h-32 overflow-y-auto border border-slate-200 rounded-md p-2 bg-white">
                            {disponibles.map(d => (
                              <label key={d} className={"flex items-center gap-2 text-sm " +
                                (asignadosEnOtros.includes(d) ? "text-slate-300" : "text-slate-700 cursor-pointer")}>
                                <input type="checkbox" disabled={asignadosEnOtros.includes(d)} checked={g.seleccionados.includes(d)}
                                  onChange={() => toggleSeleccion(g.id, d)}
                                  className="w-4 h-4 rounded border-slate-300 text-slate-800 focus:ring-slate-800" />
                                {d}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">N° de expediente</label>
                            <input value={g.exp} onChange={e => actualizarGrupo(g.id, "exp", e.target.value)} placeholder="13-00000/26"
                              className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Motivo</label>
                            <select value={g.estadoConvocatoria} onChange={e => actualizarGrupo(g.id, "estadoConvocatoria", e.target.value)}
                              className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
                              {ESTADOS_CONVOCATORIA_FALLIDOS.map(estado => <option key={estado} value={estado}>{estado}</option>)}
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Objeto</label>
                            <input value={g.objeto} onChange={e => actualizarGrupo(g.id, "objeto", e.target.value)} placeholder={exp.objeto}
                              className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Fecha de inicio</label>
                            <input type="date" value={g.fechaInicio} onChange={e => actualizarGrupo(g.id, "fechaInicio", e.target.value)}
                              className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-600 mb-1">Fecha de vencimiento</label>
                            <input type="date" value={g.fechaVencimiento} onChange={e => actualizarGrupo(g.id, "fechaVencimiento", e.target.value)}
                              className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={agregarGrupo} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
                    <Plus size={14} /> Agregar otro expediente
                  </button>
                </>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
            <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Guardando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
              Confirmar
            </BotonAccion>
          </div>
        </div>
      </div>
    </div>
  );
}
