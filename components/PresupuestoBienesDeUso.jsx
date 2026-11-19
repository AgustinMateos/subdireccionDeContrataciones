"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { montoNumero } from "@/lib/resoluciones";
import { PARTIDAS_INCISO_4, etiquetaPartida } from "@/lib/inciso4";
import EtiquetaResolucion from "./EtiquetaResolucion";

const fmtMonto = n => "$ " + Math.round(n).toLocaleString("es-AR");
const pct = (n, total) => (!total ? "-" : n && n / total < 0.01 ? "<1%" : Math.round((n / total) * 100) + "%");
const montoDe = e => montoNumero(e.monto);
const sumaMontos = es => es.reduce((s, e) => s + (montoDe(e) || 0), 0);
const esAntecedente = e => e.hoja === "antecedentes";
const anioMovDe = e => String(e.fechaUltimoMov || "").slice(0, 4);
const SIN_MOV = "sin";
// Adjudicadas: totales o parciales.
const ADJUDICADAS = ["Adjudicada", "Adjudicación parcial"];
const FRACASADAS = ["Fracasada", "Fracasa / Autoriza", "Fracasa / Desierta"];

// Solapa "Presupuesto 2026" (Cuadro de Informática y Varios, Licitaciones):
// los títulos de las planillas de bienes de uso (`presupuesto`, de
// lib/presupuestos.js) y qué expedientes del cuadro encuadran en cada uno.
// `lista`: los expedientes con exp, bloque (subtítulo), jurisdiccion,
// objeto, partida (ya resuelta), monto, resolucionConv y fechaUltimoMov.
// `textoDe`: el texto que se cruza con los títulos (por defecto, el objeto).
// `conAntecedentes`: muestra la opción de sumar los antecedentes (hoja
// "antecedentes" del Cuadro IyV).
// `resolucionesDeResoluciones` ({ [id]: { valor, enTramite } }): cómo
// terminó según Resoluciones, para los que no la tienen cargada en el cuadro
// (el mismo cruce que el Análisis).
export default function PresupuestoBienesDeUso({
  presupuesto, lista, onAbrir, resolucionesDeResoluciones, textoDe = e => e.objeto, conAntecedentes: opcionAntecedentes = false, archivo,
}) {
  const PRESUPUESTO = presupuesto;
  const RENGLONES = presupuesto.renglones;
  const tipoDe = id => presupuesto.tipos.find(t => t.id === id);
  const [conAntecedentes, setConAntecedentes] = useState(false);
  // Filtros: solo los bienes de uso del cuadro (Inciso 4) y el año del
  // último movimiento del expediente (del bloque: vigente, continuidad...).
  const [soloBienesDeUso, setSoloBienesDeUso] = useState(true);
  const [anioMov, setAnioMov] = useState("");
  const [abiertos, setAbiertos] = useState(() => new Set());
  // Lista abierta desde las tarjetas: null | "todos" | "revisar" | "adjudicadas" | "fracasadas" | "sinTitulo".
  const [verLista, setVerLista] = useState(null);

  const base = useMemo(() => lista.filter(e => (conAntecedentes || !opcionAntecedentes || !esAntecedente(e)) && (!soloBienesDeUso || PARTIDAS_INCISO_4[e.partida])),
    [lista, conAntecedentes, soloBienesDeUso]);
  const anios = useMemo(() => [...new Set(base.map(anioMovDe).filter(Boolean))].sort((a, b) => b.localeCompare(a)), [base]);
  const hayExpSinMov = base.some(e => !anioMovDe(e));
  const expedientes = useMemo(() => base.filter(e => !anioMov || anioMovDe(e) === (anioMov === SIN_MOV ? "" : anioMov)).map(e => {
    const r = !e.resolucionConv && resolucionesDeResoluciones?.[e.id];
    if (r) e = { ...e, resolucionConv: r.valor, resolucionDeResoluciones: true, resolucionEnTramite: r.enTramite };
    return { ...e, renglones: presupuesto.renglonesDe(textoDe(e)) };
    // textoDe es fijo para cada cuadro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [base, anioMov, resolucionesDeResoluciones, presupuesto]);
  const porRenglon = useMemo(() => {
    const m = new Map(RENGLONES.map(x => [x.id, []]));
    for (const e of expedientes) for (const x of e.renglones) m.get(x.id).push(e);
    return m;
  }, [expedientes, RENGLONES]);
  // Bienes de uso del cuadro que no encuadran en ningún título.
  const sinTitulo = useMemo(() => expedientes.filter(e => !e.renglones.length && PARTIDAS_INCISO_4[e.partida]), [expedientes]);
  const aRevisar = expedientes.filter(e => e.renglones.length > 1);
  // Encuadrados en algún título y adjudicados.
  const adjudicadas = expedientes.filter(e => e.renglones.length && ADJUDICADAS.includes(e.resolucionConv));
  const parciales = adjudicadas.filter(e => e.resolucionConv !== "Adjudicada").length;
  const fracasadas = expedientes.filter(e => e.renglones.length && FRACASADAS.includes(e.resolucionConv));
  const presupuestoTotal = PRESUPUESTO.tipos.reduce((s, t) => s + t.total, 0);
  const LISTAS = {
    todos: { titulo: (soloBienesDeUso ? "Todos los bienes de uso del cuadro" : "Todos los expedientes del cuadro") + (anioMov ? " (último movimiento: " + (anioMov === SIN_MOV ? "sin fecha" : anioMov) + ")" : "") + " y su título del presupuesto", es: expedientes },
    revisar: { titulo: "Expedientes que encuadran en más de un título", es: aRevisar },
    adjudicadas: { titulo: "Expedientes adjudicados que encuadran en el presupuesto", es: adjudicadas },
    fracasadas: { titulo: "Expedientes fracasados que encuadran en el presupuesto", es: fracasadas },
    sinTitulo: { titulo: "Bienes de uso del cuadro que no encuadran en ningún título", es: sinTitulo },
  };
  const alternarLista = id => setVerLista(v => (v === id ? null : id));

  function alternar(id) { setAbiertos(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); }

  function exportar() {
    const filas = [];
    for (const x of RENGLONES) {
      const es = porRenglon.get(x.id);
      if (!es.length) filas.push([tipoDe(x.tipo).titulo, x.seccion, x.descripcion, x.monto, "", "", "", "", "", "", ""]);
      for (const e of es) filas.push([tipoDe(x.tipo).titulo, x.seccion, x.descripcion, x.monto, e.exp, e.bloque || "", e.objeto, etiquetaPartida(e.partida),
        montoDe(e) ?? (e.monto || ""), e.resolucionConv || "", e.renglones.length > 1 ? "Encuadra en " + e.renglones.length + " títulos" : ""]);
    }
    for (const e of sinTitulo) filas.push(["", "", "SIN TÍTULO DEL PRESUPUESTO", "", e.exp, e.bloque || "", e.objeto, etiquetaPartida(e.partida), montoDe(e) ?? (e.monto || ""), e.resolucionConv || "", ""]);
    const ws = XLSX.utils.aoa_to_sheet([["TIPO", "SECCION", "DESCRIPCION", "PRESUPUESTO 2026", "EXP", "BLOQUE", "OBJETO", "PARTIDA", "MONTO DEL EXP.", "RESOLUCION CONV.", "A REVISAR"], ...filas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presupuesto " + PRESUPUESTO.anio);
    XLSX.writeFile(wb, archivo + "-" + PRESUPUESTO.anio + "-" + hoyLocalISO() + ".xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500 max-w-2xl">
          Bienes de uso {PRESUPUESTO.anio} ({PRESUPUESTO.fuente}). Cada expediente del cuadro
          encuadra en un título según su objeto. Los que encuadran en más de uno quedan <span className="text-amber-700 font-medium">a revisar</span>.
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={soloBienesDeUso} onChange={e => setSoloBienesDeUso(e.target.checked)} /> Solo bienes de uso
          </label>
          <select value={anioMov} onChange={e => setAnioMov(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
            <option value="">Último mov.: todos los años</option>
            {anios.map(a => <option key={a} value={a}>Último mov.: {a}</option>)}
            {hayExpSinMov && <option value={SIN_MOV}>Último mov.: sin fecha</option>}
          </select>
          {opcionAntecedentes && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={conAntecedentes} onChange={e => setConAntecedentes(e.target.checked)} /> Incluir antecedentes
            </label>
          )}
          <button type="button" onClick={exportar}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700">
            <Download size={14} /> Excel
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <button type="button" onClick={() => alternarLista("todos")}
          className={"text-left bg-white border border-slate-300 rounded-xl px-4 py-3 hover:bg-slate-50 " + (verLista === "todos" ? "ring-2 ring-slate-400" : "")}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{soloBienesDeUso ? "Bienes de uso" : "Expedientes"}</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{expedientes.length}</p>
          <p className="text-[11px] text-slate-500">
            {expedientes.filter(e => e.renglones.length).length} con título · {fmtMonto(sumaMontos(expedientes))} · {verLista === "todos" ? "ocultar" : "ver"}
          </p>
        </button>
        {PRESUPUESTO.tipos.map(t => {
          const es = [...new Set(RENGLONES.filter(x => x.tipo === t.id).flatMap(x => porRenglon.get(x.id)))];
          return (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-slate-500">{t.titulo}</p>
              <p className="text-lg font-semibold text-slate-900 tabular-nums">{fmtMonto(t.total)}</p>
              <p className="text-[11px] text-slate-500">{es.length} expediente{es.length !== 1 ? "s" : ""} encuadrado{es.length !== 1 ? "s" : ""} · {fmtMonto(sumaMontos(es))}</p>
            </div>
          );
        })}
        <button type="button" onClick={() => alternarLista("revisar")}
          className={"text-left bg-white border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-50/50 " + (verLista === "revisar" ? "ring-2 ring-amber-300" : "")}>
          <p className="text-[11px] uppercase tracking-wide text-amber-700">A revisar</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{aRevisar.length}</p>
          <p className="text-[11px] text-slate-500">encuadran en más de un título · {verLista === "revisar" ? "ocultar" : "ver"}</p>
        </button>
        <button type="button" onClick={() => alternarLista("adjudicadas")}
          className={"text-left bg-white border border-emerald-200 rounded-xl px-4 py-3 hover:bg-emerald-50/50 " + (verLista === "adjudicadas" ? "ring-2 ring-emerald-300" : "")}>
          <p className="text-[11px] uppercase tracking-wide text-emerald-700">Adjudicadas</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{adjudicadas.length}</p>
          <p className="text-[11px] text-slate-500">
            {fmtMonto(sumaMontos(adjudicadas))} · {pct(sumaMontos(adjudicadas), presupuestoTotal)} del presupuesto{parciales ? " · " + parciales + " parcial" + (parciales !== 1 ? "es" : "") : ""} · {verLista === "adjudicadas" ? "ocultar" : "ver"}
          </p>
        </button>
        <button type="button" onClick={() => alternarLista("fracasadas")}
          className={"text-left bg-white border border-rose-200 rounded-xl px-4 py-3 hover:bg-rose-50/50 " + (verLista === "fracasadas" ? "ring-2 ring-rose-300" : "")}>
          <p className="text-[11px] uppercase tracking-wide text-rose-700">Fracasadas</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{fracasadas.length}</p>
          <p className="text-[11px] text-slate-500">
            {fmtMonto(sumaMontos(fracasadas))} · {pct(sumaMontos(fracasadas), presupuestoTotal)} del presupuesto · {verLista === "fracasadas" ? "ocultar" : "ver"}
          </p>
        </button>
        <button type="button" onClick={() => alternarLista("sinTitulo")}
          className={"text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:bg-slate-50 " + (verLista === "sinTitulo" ? "ring-2 ring-slate-300" : "")}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Bienes de uso sin título</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">{sinTitulo.length}</p>
          <p className="text-[11px] text-slate-500">del cuadro, no encuadran en ninguno · {verLista === "sinTitulo" ? "ocultar" : "ver"}</p>
        </button>
      </div>

      {verLista && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <h3 className="text-sm font-semibold text-slate-900">{LISTAS[verLista].titulo}</h3>
          </div>
          <ListaExpedientes expedientes={LISTAS[verLista].es} onAbrir={onAbrir} />
        </div>
      )}

      {PRESUPUESTO.tipos.map(t => (
        <div key={t.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-baseline justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{t.titulo}</h3>
              <span className="text-[11px] text-slate-500">{t.subtitulo}</span>
            </div>
            <span className="text-xs font-semibold text-slate-900 tabular-nums">Total {fmtMonto(t.total)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-3">Descripción</th>
                  <th className="py-2 px-3 text-right">Presupuesto</th>
                  <th className="py-2 px-3 text-right">Expedientes</th>
                  <th className="py-2 px-3 text-right">Monto de los exp.</th>
                  <th className="py-2 px-3 text-right">% del presupuesto</th>
                </tr>
              </thead>
              <tbody>
                {t.secciones.map(s => (
                  <Fragment key={s.titulo}>
                    <tr className="bg-slate-50/60"><td colSpan={5} className="py-1.5 px-3 text-[11px] font-semibold italic text-slate-600">{s.titulo}</td></tr>
                    {RENGLONES.filter(x => x.tipo === t.id && x.seccion === s.titulo).map(x => {
                      const es = porRenglon.get(x.id);
                      const monto = sumaMontos(es);
                      const abierto = abiertos.has(x.id);
                      const dudosos = es.filter(e => e.renglones.length > 1).length;
                      return (
                        <Fragment key={x.id}>
                          <tr onClick={() => es.length && alternar(x.id)}
                            className={"border-b border-slate-50 " + (es.length ? "cursor-pointer hover:bg-slate-50 " : "") + (abierto ? "bg-slate-50" : "")}>
                            <td className="py-1.5 px-3">
                              <span className="flex items-center gap-1.5">
                                {es.length ? (abierto ? <ChevronDown size={13} className="text-slate-400 shrink-0" /> : <ChevronRight size={13} className="text-slate-400 shrink-0" />) : <span className="w-[13px] shrink-0" />}
                                <span className="text-slate-900">{x.descripcion}</span>
                                {!x.claves && <span className="text-[10px] text-slate-400">(no se cruza: previsión)</span>}
                              </span>
                            </td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-slate-900">{fmtMonto(x.monto)}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums">
                              {es.length ? <span className={"font-semibold " + (dudosos ? "text-amber-700" : "text-emerald-700")}>{es.length}</span> : <span className="text-slate-300">-</span>}
                              {dudosos > 0 && <span className="block text-[10px] text-amber-700">{dudosos} a revisar</span>}
                            </td>
                            <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-slate-700">{monto ? fmtMonto(monto) : <span className="text-slate-300">-</span>}</td>
                            <td className="py-1.5 px-3 text-right tabular-nums text-slate-600">{monto ? pct(monto, x.monto) : ""}</td>
                          </tr>
                          {abierto && (
                            <tr><td colSpan={5} className="bg-slate-50/40 px-3 pb-3"><ListaExpedientes expedientes={es} onAbrir={onAbrir} renglon={x} tipo={t} /></td></tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function ListaExpedientes({ expedientes, onAbrir, renglon, tipo }) {
  if (!expedientes.length) return <p className="px-5 py-4 text-xs text-slate-400">No hay expedientes.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
          <th className="py-2 px-3">Expediente</th><th className="py-2 px-3">Objeto</th><th className="py-2 px-3">Partida</th>
          <th className="py-2 px-3 text-right">Monto</th><th className="py-2 px-3">Resolución conv.</th>
        </tr>
      </thead>
      <tbody>
        {expedientes.map(e => {
          const otros = renglon ? e.renglones.filter(x => x.id !== renglon.id) : [];
          // La partida del expediente no es la de la planilla (tangible / intangible).
          const otraPartida = tipo && PARTIDAS_INCISO_4[e.partida] && !tipo.partidas.includes(e.partida);
          return (
            <tr key={e.id} onClick={() => onAbrir(e.id)} className="border-b border-slate-100 last:border-0 cursor-pointer hover:bg-white align-top">
              <td className="py-1.5 px-3 whitespace-nowrap">
                <span className="font-medium text-slate-900">{e.exp || "Sin N°"}</span>
                <span className="block text-[10px] text-slate-500">{e.bloque}{e.jurisdiccion ? " · " + e.jurisdiccion : ""}</span>
              </td>
              <td className="py-1.5 px-3 text-slate-700 min-w-[240px]">
                {e.objeto}
                {otros.length > 0 && <span className="block text-[10px] text-amber-700">A revisar: también encuadra en {otros.map(x => x.descripcion).join(", ")}</span>}
                {!renglon && e.renglones.length > 0 && (
                  <span className={"block text-[10px] " + (e.renglones.length > 1 ? "text-amber-700" : "text-emerald-700")}>Título: {e.renglones.map(x => x.descripcion).join(" / ")}</span>
                )}
                {!renglon && !e.renglones.length && <span className="block text-[10px] text-rose-700">Sin título del presupuesto</span>}
              </td>
              <td className="py-1.5 px-3 whitespace-nowrap">
                <span className={PARTIDAS_INCISO_4[e.partida] ? "text-slate-700" : "text-rose-700"}>{etiquetaPartida(e.partida)}</span>
                {otraPartida && <span className="block text-[10px] text-amber-700">No es la partida de esta planilla</span>}
              </td>
              <td className="py-1.5 px-3 text-right whitespace-nowrap tabular-nums text-slate-700">{montoDe(e) != null ? fmtMonto(montoDe(e)) : <span className="text-slate-300">-</span>}</td>
              <td className="py-1.5 px-3">
                <EtiquetaResolucion valor={e.resolucionConv} />
                {e.resolucionDeResoluciones && <span className="block text-[10px] text-violet-700">según Resoluciones{e.resolucionEnTramite ? " (en trámite)" : ""}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
