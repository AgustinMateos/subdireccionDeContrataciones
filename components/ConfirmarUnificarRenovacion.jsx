"use client";

import { useState } from "react";
import BotonAccion from "./BotonAccion";
import CampoDomiciliosRenglones from "./CampoDomiciliosRenglones";
import { fechaMinimaUnificacion, diaSiguiente, fmtFecha } from "@/lib/utils";

// Unifica dos o más trámites (cadenas distintas) que vencen en el mismo
// período en una sola renovación nueva: suma sus domicilios/renglones y
// arranca su propia tarjeta. El N° de expediente de la unificada puede ser
// uno nuevo o el mismo que ya tenía uno de los orígenes (ver comentario en
// la API sobre cómo se libera ese número).
export default function ConfirmarUnificarRenovacion({ origenes, expedientes, onCerrar, onConfirmar }) {
  const fechaMinima = fechaMinimaUnificacion(origenes, expedientes || []);
  const esAscensores = origenes[0]?.tipo === "Ascensores";
  const domiciliosUnion = [];
  for (const o of origenes) {
    for (const d of o.domiciliosRenglones || []) {
      if (!domiciliosUnion.includes(d)) domiciliosUnion.push(d);
    }
  }
  // En Ascensores, cada domicilio arrastra los ascensores/montacargas que ya
  // tenía cargados en el trámite del que viene (el primer origen que lo
  // tramitaba con ese detalle) — así no hay que volver a tipearlos.
  const ascensoresPorDomicilioUnion = {};
  if (esAscensores) {
    for (const d of domiciliosUnion) {
      const origenConDatos = origenes.find((o) => o.ascensoresPorDomicilio?.[d]);
      if (origenConDatos) ascensoresPorDomicilioUnion[d] = origenConDatos.ascensoresPorDomicilio[d];
    }
  }
  const [modoExp, setModoExp] = useState("nuevo"); // 'nuevo' | 'existente'
  const [expNuevo, setExpNuevo] = useState("");
  const [expExistenteId, setExpExistenteId] = useState(origenes[0]?.id || "");
  const [f, setF] = useState({
    fechaInicio: diaSiguiente(fechaMinima),
    fechaVencimiento: "",
    domiciliosRenglones: domiciliosUnion,
    ascensoresPorDomicilio: ascensoresPorDomicilioUnion,
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  function set(campo, valor) { setF((prev) => ({ ...prev, [campo]: valor })); setError(""); }

  const expFinal = modoExp === "existente"
    ? (origenes.find((o) => o.id === expExistenteId)?.exp || "")
    : expNuevo.trim();

  async function confirmar() {
    if (!expFinal) {
      setError(modoExp === "nuevo" ? "Cargá el N° de expediente de la renovación unificada." : "Elegí de cuál de los trámites reutilizás el N°.");
      return;
    }
    if (!f.fechaInicio || !f.fechaVencimiento) {
      setError("Cargá la fecha de inicio y de vencimiento de la renovación unificada.");
      return;
    }
    if (fechaMinima && new Date(f.fechaInicio) < new Date(fechaMinima)) {
      setError("La fecha de inicio no puede ser anterior al " + fmtFecha(fechaMinima) + " (cuando termina la cobertura vigente).");
      return;
    }
    setCargando(true);
    await onConfirmar({
      exp: expFinal,
      fechaInicio: f.fechaInicio,
      fechaVencimiento: f.fechaVencimiento,
      domiciliosRenglones: f.domiciliosRenglones,
      ...(esAscensores ? { ascensoresPorDomicilio: f.ascensoresPorDomicilio } : {}),
    });
    setCargando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Unificar renovación</h2>
        <p className="text-sm text-slate-600 mb-4">
          Se generará un expediente nuevo que renueva juntos a{" "}
          {origenes.map((o, i) => (
            <span key={o.id}>
              <span className="font-mono font-medium text-slate-900">{o.exp}</span>
              {i < origenes.length - 2 ? ", " : i === origenes.length - 2 ? " y " : ""}
            </span>
          ))}
          , sumando sus domicilios/renglones. Ninguno de los orígenes cambia de estado.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">N° de expediente de la renovación unificada</label>
            <div className="flex gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => { setModoExp("nuevo"); setError(""); }}
                className={"flex-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors " +
                  (modoExp === "nuevo" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}
              >
                Número nuevo
              </button>
              <button
                type="button"
                onClick={() => { setModoExp("existente"); setError(""); }}
                className={"flex-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-colors " +
                  (modoExp === "existente" ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-600 hover:border-slate-500")}
              >
                Reusar uno existente
              </button>
            </div>
            {modoExp === "nuevo" ? (
              <input
                value={expNuevo}
                onChange={(e) => { setExpNuevo(e.target.value); setError(""); }}
                placeholder="13-00000/26"
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            ) : (
              <div className="space-y-1.5">
                {origenes.map((o) => (
                  <label key={o.id} className="flex items-center gap-2 text-sm border border-slate-200 rounded-md px-3 py-2 cursor-pointer hover:border-slate-400">
                    <input
                      type="radio"
                      name="exp-existente"
                      checked={expExistenteId === o.id}
                      onChange={() => { setExpExistenteId(o.id); setError(""); }}
                      className="text-slate-800 focus:ring-slate-800"
                    />
                    <span className="font-mono font-medium text-slate-900">{o.exp}</span>
                  </label>
                ))}
                <p className="text-[11px] text-slate-500">
                  El expediente elegido se renombra (queda como antecedente) para liberar el número, que pasa a la renovación unificada.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de inicio</label>
              <input type="date" value={f.fechaInicio} onChange={(e) => set("fechaInicio", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de vencimiento</label>
              <input type="date" value={f.fechaVencimiento} onChange={(e) => set("fechaVencimiento", e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
          </div>
          <CampoDomiciliosRenglones
            id="lista-domicilios-unificar"
            valores={f.domiciliosRenglones}
            onChange={(v) => set("domiciliosRenglones", v)}
            conAscensores={esAscensores}
            ascensoresPorDomicilio={f.ascensoresPorDomicilio}
            onChangeAscensoresPorDomicilio={(v) => set("ascensoresPorDomicilio", v)}
          />
          {fechaMinima && (
            <p className="text-[11px] text-amber-700">
              La fecha de inicio no puede ser anterior al {fmtFecha(fechaMinima)} (cuando termina la cobertura vigente).
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mt-3">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCerrar} disabled={cargando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <BotonAccion
            onClick={confirmar}
            cargando={cargando}
            cargandoTexto="Creando..."
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
          >
            Unificar renovación
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
