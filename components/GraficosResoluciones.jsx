"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { AGENTES_RESOLUCIONES, compararResoluciones, esCompletado, esPrioritario, estaFueraDeResoluciones, fechaISO, TIPOS_CONTRATACION_RESOLUCIONES } from "@/lib/resoluciones";
import { diasRestantes, fmtFecha } from "@/lib/utils";
import EstrellaPrioridad from "./EstrellaPrioridad";
import EtiquetasPrioridad from "./EtiquetasPrioridad";

// Dos series en orden fijo de la paleta categórica (validada para
// daltonismo como par adyacente); el número va escrito en cada tramo y hay
// leyenda, así que la serie no se distingue solo por color.
const SERIES = [
  { clave: "en", etiqueta: "En Resoluciones", color: "#2a78d6" },
  { clave: "fuera", etiqueta: "Fuera de Resoluciones", color: "#eb6834" },
];

const SIN_ASIGNAR = "Sin asignar";
const SIN_TIPO = "Sin tipo";
const DIAS_POR_VENCER = 30;

// Vencimiento de ofertas entre hoy y dentro de DIAS_POR_VENCER días.
function vencePronto(e) {
  const f = fechaISO(e.vencOfertas);
  if (!f) return false;
  const dias = diasRestantes(f);
  return dias >= 0 && dias <= DIAS_POR_VENCER;
}

// Solapa de gráficos de la jefa de la Subdirección: cuántos expedientes en
// trámite (no completados) tiene cada agente en Resoluciones y fuera.
export default function GraficosResoluciones({ mostrarToast }) {
  const [expedientes, setExpedientes] = useState(null);
  const [activo, setActivo] = useState(null);
  // Lo tocado en el gráfico o el cuadro: { agente, ubicacion } con
  // ubicacion "en" | "fuera" (un tramo de la barra) o null (todo el agente).
  const [abiertoEn, setAbiertoEn] = useState(null);
  const [busquedaExp, setBusquedaExp] = useState("");

  // Reasignación y prioridad (la API solo se las permite a la jefa de la
  // Subdirección).
  async function cambiar(e, cambios, mensaje) {
    // Se muestra al instante; si el servidor lo rechaza, se vuelve atrás.
    const anteriores = Object.fromEntries(Object.keys(cambios).map(k => [k, e[k]]));
    setExpedientes(prev => prev.map(x => (x.id === e.id ? { ...x, ...cambios } : x)));
    let res, data;
    try {
      res = await fetch("/api/resoluciones/" + e.id, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios),
      });
      data = await res.json().catch(() => ({}));
    } catch {
      res = { ok: false };
      data = { error: "Sin conexión: no se guardó el cambio" };
    }
    if (!res.ok) {
      setExpedientes(prev => prev.map(x => (x.id === e.id ? { ...x, ...anteriores } : x)));
      mostrarToast(data.error || "No se pudo guardar el cambio");
      return;
    }
    setExpedientes(prev => prev.map(x => (x.id === data.expediente.id ? data.expediente : x)));
    mostrarToast(mensaje);
  }
  const reasignar = (e, agente) => cambiar(e, { agente }, e.exp + " asignado a " + (agente || "nadie"));
  const alternarPrioridad = e => cambiar(e, { prioritario: !e.prioritario },
    e.prioritario ? e.exp + " ya no es prioritario" : e.exp + " marcado como prioritario");

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/resoluciones");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (vivo) setExpedientes(data.expedientes || []);
      } catch (err) {
        if (vivo) { setExpedientes([]); mostrarToast(err.message); }
      }
    })();
    return () => { vivo = false; };
    // Solo al montar: mostrarToast del Dashboard cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filas = useMemo(() => {
    const porAgente = new Map();
    for (const e of expedientes || []) {
      if (esCompletado(e)) continue;
      const agente = String(e.agente || "").trim() || SIN_ASIGNAR;
      const fila = porAgente.get(agente) || { agente, en: 0, fuera: 0, tipos: {}, prioritarios: 0, porVencer: 0 };
      fila[estaFueraDeResoluciones(e) ? "fuera" : "en"]++;
      const tipo = String(e.tipoContratacion || "").trim() || SIN_TIPO;
      fila.tipos[tipo] = (fila.tipos[tipo] || 0) + 1;
      if (esPrioritario(e)) fila.prioritarios++;
      if (vencePronto(e)) fila.porVencer++;
      porAgente.set(agente, fila);
    }
    // Más cargado primero; "Sin asignar" siempre al final.
    return [...porAgente.values()].sort((a, b) =>
      (a.agente === SIN_ASIGNAR) - (b.agente === SIN_ASIGNAR) || (b.en + b.fuera) - (a.en + a.fuera) || a.agente.localeCompare(b.agente));
  }, [expedientes]);

  if (expedientes === null) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando...</div>;
  }

  const max = Math.max(1, ...filas.map(f => f.en + f.fuera));
  const totales = filas.reduce((t, f) => ({
    en: t.en + f.en,
    fuera: t.fuera + f.fuera,
    prioritarios: t.prioritarios + f.prioritarios,
    porVencer: t.porVencer + f.porVencer,
  }), { en: 0, fuera: 0, prioritarios: 0, porVencer: 0 });
  // Columnas de tipo de contratación: las de la lista que aparecen, en su
  // orden, más las que se cargaron fuera de lista; "Sin tipo" al final.
  const presentes = new Set(filas.flatMap(f => Object.keys(f.tipos)));
  const tipos = [
    ...TIPOS_CONTRATACION_RESOLUCIONES.filter(t => presentes.has(t)),
    ...[...presentes].filter(t => !TIPOS_CONTRATACION_RESOLUCIONES.includes(t) && t !== SIN_TIPO).sort(),
    ...(presentes.has(SIN_TIPO) ? [SIN_TIPO] : []),
  ];
  const totalTipo = t => filas.reduce((n, f) => n + (f.tipos[t] || 0), 0);
  const celda = n => (n ? n : <span className="text-slate-300">0</span>);

  const agentes = [...new Set([...AGENTES_RESOLUCIONES, ...(expedientes || []).map(e => e.agente).filter(Boolean)])];
  const resultadosBusqueda = buscarPorExp(expedientes || [], busquedaExp);

  return (
    <div className="space-y-6">
      {/* Buscar un expediente por N° para reasignarlo sin saber de quién es. */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busquedaExp}
              onChange={ev => setBusquedaExp(ev.target.value)}
              placeholder="Buscar por N° de expediente (ej. 13-01447/25 o 1447)"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>
          {busquedaExp.trim() && (
            <span className="text-xs text-slate-500">
              {resultadosBusqueda.length} expediente{resultadosBusqueda.length !== 1 ? "s" : ""}
              <button type="button" onClick={() => setBusquedaExp("")} className="ml-3 font-medium text-slate-500 hover:text-slate-900">Limpiar</button>
            </span>
          )}
        </div>
        {busquedaExp.trim() && (
          resultadosBusqueda.length === 0
            ? <p className="px-5 pb-4 text-sm text-slate-500">No hay expedientes con ese número.</p>
            : <div className="border-t border-slate-100"><TablaExpedientes lista={resultadosBusqueda} agentes={agentes} onReasignar={reasignar} onPrioridad={alternarPrioridad} /></div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Expedientes por agente</h3>
            <span className="text-[11px] text-slate-500">En trámite (sin completados): {totales.en + totales.fuera} expedientes</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-700">
            {SERIES.map(s => (
              <span key={s.clave} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.etiqueta}
              </span>
            ))}
          </div>
        </div>
        {filas.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">Sin expedientes en trámite.</div>
        ) : (
          <div className="px-5 py-4 space-y-1" onMouseLeave={() => setActivo(null)}>
            {filas.map(f => {
              const total = f.en + f.fuera;
              const esActivo = activo === f.agente;
              return (
                <div
                  key={f.agente}
                  onMouseEnter={() => setActivo(f.agente)}
                  className={"grid grid-cols-[90px_1fr_auto] items-center gap-3 rounded px-1 py-1 " + (esActivo ? "bg-slate-50" : "")}
                >
                  <button
                    type="button"
                    onClick={() => setAbiertoEn({ agente: f.agente, ubicacion: null })}
                    title={"Ver los expedientes de " + f.agente}
                    className="text-left text-xs font-medium text-slate-700 truncate hover:text-slate-900 hover:underline"
                  >
                    {f.agente}
                  </button>
                  <div className="flex h-5 min-w-0" style={{ width: (total / max) * 100 + "%", opacity: activo && !esActivo ? 0.45 : 1 }}>
                    {SERIES.map((s, i) => f[s.clave] > 0 && (
                      <button
                        type="button"
                        key={s.clave}
                        onClick={() => setAbiertoEn({ agente: f.agente, ubicacion: s.clave })}
                        title={s.etiqueta + ": " + f[s.clave] + " (ver expedientes)"}
                        className={"h-full flex items-center justify-center text-[11px] font-semibold text-white tabular-nums cursor-pointer hover:brightness-110 " +
                          (i === SERIES.length - 1 || !f[SERIES[i + 1].clave] ? "rounded-r" : "")}
                        style={{
                          width: (f[s.clave] / total) * 100 + "%",
                          minWidth: 18,
                          background: s.color,
                          // Separación de 2px entre los dos tramos.
                          marginLeft: i > 0 && f[SERIES[i - 1].clave] > 0 ? 2 : 0,
                        }}
                      >
                        {f[s.clave]}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setAbiertoEn({ agente: f.agente, ubicacion: null })}
                    title={"Ver los expedientes de " + f.agente}
                    className="text-xs font-semibold text-slate-900 tabular-nums w-8 text-right hover:underline"
                  >
                    {total}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Los mismos números en tabla, con el detalle por tipo de
          contratación, prioritarios y vencimientos próximos. */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-slate-500 bg-slate-50/60">
                <th rowSpan={2} className="py-2 px-4 font-medium text-left align-bottom">Agente</th>
                <th colSpan={3} className="pt-2 px-4 font-medium text-center border-l border-slate-200">Ubicación</th>
                {tipos.length > 0 && <th colSpan={tipos.length} className="pt-2 px-4 font-medium text-center border-l border-slate-200">Tipo de contratación</th>}
                <th rowSpan={2} className="py-2 px-4 font-medium text-right align-bottom border-l border-slate-200">Prioritarios</th>
                <th rowSpan={2} className="py-2 px-4 font-medium text-right align-bottom">Vencen en {DIAS_POR_VENCER} días</th>
              </tr>
              <tr className="text-[11px] text-slate-500 border-b border-slate-100 bg-slate-50/60">
                <th className="pb-2 px-4 font-medium text-right border-l border-slate-200">En Resoluciones</th>
                <th className="pb-2 px-4 font-medium text-right">Fuera</th>
                <th className="pb-2 px-4 font-medium text-right">Total</th>
                {tipos.map((t, i) => (
                  <th key={t} className={"pb-2 px-3 font-medium text-right whitespace-nowrap " + (i === 0 ? "border-l border-slate-200" : "")}>{t}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(f => (
                <tr
                  key={f.agente}
                  onClick={() => setAbiertoEn({ agente: f.agente, ubicacion: null })}
                  title={"Ver y reasignar los expedientes de " + f.agente}
                  className="border-b border-slate-50 tabular-nums cursor-pointer hover:bg-slate-50"
                >
                  <td className="py-1.5 px-4 text-slate-700 font-medium">{f.agente}</td>
                  <td className="py-1.5 px-4 text-right border-l border-slate-100">{celda(f.en)}</td>
                  <td className="py-1.5 px-4 text-right">{celda(f.fuera)}</td>
                  <td className="py-1.5 px-4 text-right font-semibold">{f.en + f.fuera}</td>
                  {tipos.map((t, i) => (
                    <td key={t} className={"py-1.5 px-3 text-right " + (i === 0 ? "border-l border-slate-100" : "")}>{celda(f.tipos[t] || 0)}</td>
                  ))}
                  <td className="py-1.5 px-4 text-right border-l border-slate-100">
                    {f.prioritarios ? (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">{f.prioritarios}</span>
                    ) : celda(0)}
                  </td>
                  <td className="py-1.5 px-4 text-right">
                    {f.porVencer ? (
                      <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border border-red-300 bg-red-50 text-red-700">{f.porVencer}</span>
                    ) : celda(0)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50/60 font-semibold tabular-nums">
                <td className="py-1.5 px-4">Total</td>
                <td className="py-1.5 px-4 text-right border-l border-slate-100">{totales.en}</td>
                <td className="py-1.5 px-4 text-right">{totales.fuera}</td>
                <td className="py-1.5 px-4 text-right">{totales.en + totales.fuera}</td>
                {tipos.map((t, i) => (
                  <td key={t} className={"py-1.5 px-3 text-right " + (i === 0 ? "border-l border-slate-100" : "")}>{totalTipo(t)}</td>
                ))}
                <td className="py-1.5 px-4 text-right border-l border-slate-100">{totales.prioritarios}</td>
                <td className="py-1.5 px-4 text-right">{totales.porVencer}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {abiertoEn && (
        <ExpedientesDelAgente
          agente={abiertoEn.agente}
          ubicacion={SERIES.find(s => s.clave === abiertoEn.ubicacion)?.etiqueta}
          expedientes={(expedientes || []).filter(e =>
            !esCompletado(e)
            && (String(e.agente || "").trim() || SIN_ASIGNAR) === abiertoEn.agente
            && (!abiertoEn.ubicacion || (abiertoEn.ubicacion === "fuera") === estaFueraDeResoluciones(e)))}
          agentes={agentes}
          onReasignar={reasignar}
          onPrioridad={alternarPrioridad}
          onCerrar={() => setAbiertoEn(null)}
        />
      )}
    </div>
  );
}

// Expedientes en trámite de un agente (la fila tocada del cuadro), con un
// desplegable para reasignar cada uno. Al reasignarlo deja de estar en la
// lista y el cuadro se actualiza.
function ExpedientesDelAgente({ agente, ubicacion, expedientes, agentes, onReasignar, onPrioridad, onCerrar }) {
  const lista = [...expedientes].sort(compararResoluciones);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Expedientes de {agente}{ubicacion ? " · " + ubicacion : ""}</h2>
            <p className="text-xs text-slate-500">{lista.length} en trámite · cambiá el agente para reasignar</p>
          </div>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        {lista.length === 0 ? (
          <p className="px-6 py-8 text-sm text-slate-500">No le quedan expedientes en trámite.</p>
        ) : (
          <TablaExpedientes lista={lista} agentes={agentes} onReasignar={onReasignar} onPrioridad={onPrioridad} />
        )}
      </div>
    </div>
  );
}

// Expedientes con un desplegable de agente para reasignar cada uno.
function TablaExpedientes({ lista, agentes, onReasignar, onPrioridad }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[11px] text-slate-500 border-b border-slate-100 bg-slate-50/60">
          <th className="py-2 px-4 font-medium">Exp.</th>
          <th className="py-2 px-4 font-medium">Objeto</th>
          <th className="py-2 px-4 font-medium">Tipo de contratación</th>
          <th className="py-2 px-4 font-medium">Tipo de resolución</th>
          <th className="py-2 px-4 font-medium">Sector actual</th>
          <th className="py-2 px-4 font-medium">Venc. ofertas</th>
          <th className="py-2 px-4 font-medium">Agente</th>
        </tr>
      </thead>
      <tbody>
        {lista.map(e => {
          const venc = fechaISO(e.vencOfertas);
          const dias = venc ? diasRestantes(venc) : null;
          return (
            <tr key={e.id} className="border-b border-slate-50 align-top">
              <td className="py-2 px-4 whitespace-nowrap">
                <div className="flex items-center gap-1 font-mono font-semibold text-slate-900">
                  <EstrellaPrioridad prioritario={e.prioritario} onClick={() => onPrioridad(e)} />
                  {e.exp}
                </div>
                <EtiquetasPrioridad expediente={e} />
                {/* Un completado ya se fue de Resoluciones: no cuenta en los gráficos. */}
                {esCompletado(e) && (
                  <span className="block w-fit mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-slate-300 bg-slate-100 text-slate-600">
                    Completado · fuera del sector Resoluciones
                  </span>
                )}
              </td>
              <td className="py-2 px-4 text-slate-700 max-w-[320px]"><span className="line-clamp-2" title={e.objeto}>{e.objeto}</span></td>
              <td className="py-2 px-4 text-slate-700 whitespace-nowrap">{e.tipoContratacion || "-"}</td>
              <td className="py-2 px-4 text-slate-700">{e.tipoResolucion || "-"}</td>
              <td className="py-2 px-4 text-slate-700">{e.sectorActual || "-"}</td>
              <td className="py-2 px-4 whitespace-nowrap">
                {venc ? fmtFecha(venc) : "-"}
                {dias != null && dias >= 0 && dias <= DIAS_POR_VENCER && (
                  <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border border-red-300 bg-red-50 text-red-700">{dias} días</span>
                )}
              </td>
              <td className="py-2 px-4">
                <select
                  value={e.agente || ""}
                  onChange={ev => onReasignar(e, ev.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-800"
                >
                  <option value="">Sin asignar</option>
                  {agentes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Coincidencia por N° de expediente: el texto tal cual o solo los dígitos
// ("1447" encuentra 13-01447/25). Primero los que siguen en trámite.
function buscarPorExp(expedientes, texto) {
  const q = texto.trim().toLowerCase();
  if (!q) return [];
  const digitos = q.replace(/\D/g, "");
  return expedientes
    .filter(e => {
      const exp = String(e.exp || "").toLowerCase();
      return exp.includes(q) || (digitos.length >= 3 && exp.replace(/\D/g, "").includes(digitos));
    })
    .sort(compararResoluciones);
}
