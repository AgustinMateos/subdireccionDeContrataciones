"use client";

import { useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { MODALIDADES_FRACASADA, PRORROGA_MESES_OPCIONES } from "@/lib/constants";
import BotonAccion from "./BotonAccion";
import SelectorMesesProrroga from "./SelectorMesesProrroga";
import { fmtFecha } from "@/lib/utils";

function grupoVacio() {
  return {
    id: Math.random().toString(36).slice(2),
    seleccionados: [],
    exp: "",
    modalidad: MODALIDADES_FRACASADA[0],
    objeto: "",
    fechaInicio: "",
    fechaVencimiento: "",
    montoARS: "",
    ocResolucion: "",
    resolucionLlamado: "",
    resolucionAdjudicacion: "",
    tieneProrroga: false,
    mesesProrroga: null,
  };
}

// La convocatoria fracasada se resuelve de dos formas: en un solo grupo
// (reutiliza el mismo N° de expediente, se convierte en la contratación
// puente) o dividiendo por domicilio/renglón (cada grupo va a un N° de
// expediente nuevo, cada uno con su propia modalidad — puede ser que 2
// renglones se resuelvan por Contratación Directa y el otro por Licitación
// Privada). El origen fracasado nunca cambia de N° de expediente.
export default function GenerarContratacionFracasada({ exp, onCerrar, onConfirmarUnico, onConfirmarDividir }) {
  const disponibles = exp.domiciliosRenglones || [];
  const puedeDividir = disponibles.length > 1;
  const [modo, setModo] = useState("unico"); // "unico" | "dividir"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Generar contratación</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {puedeDividir && (
            <div className="grid grid-cols-2 gap-2">
              <label className={"flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer " +
                (modo === "unico" ? "border-slate-800 bg-slate-50" : "border-slate-300")}>
                <input type="radio" name="modoFracasada" checked={modo === "unico"} onChange={() => setModo("unico")}
                  className="text-slate-800 focus:ring-slate-800" />
                Una sola contratación
              </label>
              <label className={"flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer " +
                (modo === "dividir" ? "border-slate-800 bg-slate-50" : "border-slate-300")}>
                <input type="radio" name="modoFracasada" checked={modo === "dividir"} onChange={() => setModo("dividir")}
                  className="text-slate-800 focus:ring-slate-800" />
                Dividir por domicilio/renglón
              </label>
            </div>
          )}

          {modo === "unico"
            ? <FormUnico exp={exp} onConfirmar={onConfirmarUnico} onCerrar={onCerrar} />
            : <FormDividir exp={exp} disponibles={disponibles} onConfirmar={onConfirmarDividir} onCerrar={onCerrar} />}
        </div>
      </div>
    </div>
  );
}

function FormUnico({ exp, onCerrar, onConfirmar }) {
  const [f, setF] = useState({
    modalidad: MODALIDADES_FRACASADA[0],
    objeto: exp.objeto || "",
    fechaInicio: "",
    fechaVencimiento: "",
    montoARS: "",
    ocResolucion: "",
    resolucionLlamado: "",
    resolucionAdjudicacion: "",
    tieneProrroga: false,
    mesesProrroga: null,
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const esDescentralizada = f.modalidad === "Contratación Descentralizada";

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }

  async function confirmar() {
    if (!f.objeto || !f.fechaVencimiento) {
      setError("Completá al menos objeto y fecha de vencimiento.");
      return;
    }
    if (!esDescentralizada && !f.ocResolucion) {
      setError("Cargá la orden de compra.");
      return;
    }
    if (f.tieneProrroga && !PRORROGA_MESES_OPCIONES.includes(Number(f.mesesProrroga))) {
      setError("Elegí cuántos meses de prórroga tiene el expediente.");
      return;
    }
    setCargando(true);
    await onConfirmar({
      ...f,
      montoARS: Number(f.montoARS) || 0,
      ocResolucion: esDescentralizada ? "" : f.ocResolucion,
      mesesProrroga: f.tieneProrroga ? f.mesesProrroga : null,
    });
    setCargando(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        La convocatoria fracasada se resuelve con el mismo N° de expediente
        <span className="font-mono font-medium text-slate-700"> {exp.exp}</span>, que pasa a ejecución directa
        bajo esta modalidad — no se crea un expediente nuevo.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Modalidad</label>
          <select value={f.modalidad} onChange={e => set("modalidad", e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
            {MODALIDADES_FRACASADA.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        {!esDescentralizada && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">OC</label>
            <input value={f.ocResolucion} onChange={e => set("ocResolucion", e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Resolución de llamado</label>
          <input value={f.resolucionLlamado} onChange={e => set("resolucionLlamado", e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Resolución de adjudicación</label>
          <input value={f.resolucionAdjudicacion} onChange={e => set("resolucionAdjudicacion", e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="col-span-2 border border-slate-200 rounded-md p-3 bg-slate-50">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={f.tieneProrroga}
              onChange={e => set("tieneProrroga", e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
            />
            <span className="flex-1">
              <span className="text-xs font-medium text-slate-700">Tiene opción de prórroga</span>
              <span className="block text-[11px] text-slate-500 mt-0.5">
                Activable después desde la ficha si hace falta, en una sola tanda o repartida en más de una.
              </span>
              {f.tieneProrroga && (
                <SelectorMesesProrroga value={f.mesesProrroga} onChange={v => set("mesesProrroga", v)} />
              )}
            </span>
          </label>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Objeto</label>
          <input value={f.objeto} onChange={e => set("objeto", e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="col-span-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
          Período anterior ({exp.rol === "vigente" ? "Vigente" : exp.rol}): {" "}
          <span className="font-medium text-slate-700">{fmtFecha(exp.fechaInicio)} — {fmtFecha(exp.fechaVencimiento)}</span>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de inicio</label>
          <input type="date" value={f.fechaInicio} onChange={e => set("fechaInicio", e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de vencimiento</label>
          <input type="date" value={f.fechaVencimiento} onChange={e => set("fechaVencimiento", e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-600 mb-1">Monto (ARS)</label>
          <input type="number" value={f.montoARS} onChange={e => set("montoARS", e.target.value)}
            className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
        <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Generando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
          Generar contratación
        </BotonAccion>
      </div>
    </div>
  );
}

function FormDividir({ exp, disponibles, onCerrar, onConfirmar }) {
  const [grupos, setGrupos] = useState([grupoVacio(), grupoVacio()]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

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
    const sinAsignar = disponibles.filter(d => !grupos.some(g => g.seleccionados.includes(d)));
    if (sinAsignar.length > 0) {
      setError("Falta asignar a algún grupo: " + sinAsignar.join(", ") + ".");
      return;
    }
    for (const g of grupos) {
      if (g.seleccionados.length === 0) {
        setError("Cada grupo necesita al menos un domicilio/renglón elegido.");
        return;
      }
      if (!g.exp.trim() || !g.fechaVencimiento) {
        setError("Completá N° de expediente y fecha de vencimiento en cada grupo.");
        return;
      }
      const esDescentralizada = g.modalidad === "Contratación Descentralizada";
      if (!esDescentralizada && !g.ocResolucion.trim()) {
        setError("Cargá la orden de compra en cada grupo que no sea descentralizada.");
        return;
      }
    }
    setCargando(true);
    await onConfirmar(grupos.map(g => ({
      domiciliosRenglones: g.seleccionados,
      exp: g.exp.trim(),
      modalidad: g.modalidad,
      objeto: g.objeto,
      fechaInicio: g.fechaInicio,
      fechaVencimiento: g.fechaVencimiento,
      montoARS: Number(g.montoARS) || 0,
      ocResolucion: g.modalidad === "Contratación Descentralizada" ? "" : g.ocResolucion,
      resolucionLlamado: g.resolucionLlamado,
      resolucionAdjudicacion: g.resolucionAdjudicacion,
      tieneProrroga: g.tieneProrroga,
      mesesProrroga: g.tieneProrroga ? g.mesesProrroga : null,
    })));
    setCargando(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">
        Cada grupo genera un expediente nuevo, en ejecución directa bajo la modalidad elegida, vinculado a
        <span className="font-mono font-medium text-slate-700"> {exp.exp}</span> (que queda como antecedente fracasado, sin cambios).
      </p>

      {grupos.map((g, idx) => {
        const asignadosEnOtros = grupos.filter(x => x.id !== g.id).flatMap(x => x.seleccionados);
        const esDescentralizada = g.modalidad === "Contratación Descentralizada";
        return (
          <div key={g.id} className="border border-slate-200 rounded-md p-3 space-y-3 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Contratación {idx + 1}</span>
              {grupos.length > 1 && (
                <button type="button" onClick={() => quitarGrupo(g.id)} className="text-slate-400 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-600 mb-1">Domicilios/renglones</label>
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
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Modalidad</label>
                <select value={g.modalidad} onChange={e => actualizarGrupo(g.id, "modalidad", e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
                  {MODALIDADES_FRACASADA.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {!esDescentralizada && (
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">OC</label>
                  <input value={g.ocResolucion} onChange={e => actualizarGrupo(g.id, "ocResolucion", e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                </div>
              )}
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Resolución de llamado</label>
                <input value={g.resolucionLlamado} onChange={e => actualizarGrupo(g.id, "resolucionLlamado", e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Resolución de adjudicación</label>
                <input value={g.resolucionAdjudicacion} onChange={e => actualizarGrupo(g.id, "resolucionAdjudicacion", e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
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
              <div className="col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Monto (ARS)</label>
                <input type="number" value={g.montoARS} onChange={e => actualizarGrupo(g.id, "montoARS", e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-800" />
              </div>
              <div className="col-span-2 border border-slate-200 rounded-md p-2.5 bg-white">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={g.tieneProrroga}
                    onChange={e => actualizarGrupo(g.id, "tieneProrroga", e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded border-slate-300 text-slate-800 focus:ring-slate-800"
                  />
                  <span className="flex-1">
                    <span className="text-xs font-medium text-slate-700">Tiene opción de prórroga</span>
                    {g.tieneProrroga && (
                      <SelectorMesesProrroga value={g.mesesProrroga} onChange={v => actualizarGrupo(g.id, "mesesProrroga", v)} />
                    )}
                  </span>
                </label>
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={agregarGrupo} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
        <Plus size={14} /> Agregar otra contratación
      </button>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
        <BotonAccion onClick={confirmar} cargando={cargando} cargandoTexto="Generando..." className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60">
          Generar contrataciones
        </BotonAccion>
      </div>
    </div>
  );
}
