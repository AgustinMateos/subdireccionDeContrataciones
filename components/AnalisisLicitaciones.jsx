"use client";

import { useMemo, useState } from "react";
import { Download, X } from "lucide-react";
import * as XLSX from "xlsx";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import { fechaISO } from "@/lib/resoluciones";
import {
  FILTRO_BIENES_DE_USO, PARTIDAS_INCISO_4, NO_ES_BIEN_DE_USO, esBienDeUso, anioExpediente, partidaDe, etiquetaPartida,
  ENCUADRES_LICITACIONES,
} from "@/lib/licitaciones";
import { RESOLUCIONES_CONV_LICITACIONES, GRUPOS_RESOLUCION_CONV, grupoResolucionConv, pideMotivo, MOTIVOS_NO_ADJUDICACION, motivosDe } from "@/lib/resolucionConv";
import { FiltroColumna } from "./PanelResoluciones";
import EtiquetaResolucion from "./EtiquetaResolucion";

const SIN_MOTIVO = "Sin motivo cargado";
const SIN_ANIO = "Sin año";
// Las resoluciones que piden motivo (adjudicación parcial y las no adjudicadas).
const CON_MOTIVO = RESOLUCIONES_CONV_LICITACIONES.filter(pideMotivo);
const BASES_ANIO = {
  exp: { etiqueta: "Año del expediente", de: e => anioExpediente(e) },
  mov: { etiqueta: "Año del último movimiento", de: e => fechaISO(e.fechaUltimoMov).slice(0, 4) },
};

const pct = (n, total) => (!total ? "-" : n && n / total < 0.01 ? "<1%" : Math.round((n / total) * 100) + "%");
// Colores de cada grupo (acá para que Tailwind los vea). Adjudicación parcial, en gris.
const COLOR = {
  adjudicadas: { color: "bg-emerald-500", tarjeta: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  parcial: { color: "bg-slate-400", tarjeta: "border-slate-300 bg-slate-100 text-slate-800" },
  noPaso: { color: "bg-sky-400", tarjeta: "border-sky-200 bg-sky-50 text-sky-900" },
  noAdjudicadas: { color: "bg-rose-500", tarjeta: "border-rose-200 bg-rose-50 text-rose-900" },
  sinDefinir: { color: "bg-slate-200", tarjeta: "border-dashed border-slate-300 bg-white text-slate-600" },
};
const GRUPOS = GRUPOS_RESOLUCION_CONV.map(g => ({ ...g, ...COLOR[g.id] }));
const grupoDe = r => GRUPOS.find(g => g.id === grupoResolucionConv(r).id);
const ordenAnios = (a, b) => (a === SIN_ANIO) - (b === SIN_ANIO) || b.localeCompare(a);
// Una contratación puede tener varios motivos: cuenta en cada uno.
const motivosDeExp = e => { const ms = motivosDe(e.motivoResolucion); return ms.length ? ms : [SIN_MOTIVO]; };
const tieneMotivo = (e, m) => motivosDeExp(e).includes(m);

// Solapa Análisis de Licitaciones (jefa y jefe del departamento): cómo
// terminaron las contrataciones, por año y partida, y por qué no se
// adjudicaron. Tocar un número muestra esos expedientes abajo.
// `motivosResoluciones`: { [id]: "..." } lo que cargó Resoluciones; se usa
// cuando Licitaciones no cargó el motivo (el de Licitaciones gana).
export default function AnalisisLicitaciones({ lista: listaPropia, motivosResoluciones, onAbrir }) {
  const lista = useMemo(() => listaPropia.map(e => (!e.motivoResolucion && motivosResoluciones?.[e.id]
    ? { ...e, motivoResolucion: motivosResoluciones[e.id], motivoDeResoluciones: true } : e)), [listaPropia, motivosResoluciones]);
  const [base, setBase] = useState("exp");
  const [f, setF] = useState({ anio: "", partida: FILTRO_BIENES_DE_USO, jurisdiccion: "", encuadre: "" });
  const [sel, setSel] = useState(null); // { titulo, incluye }
  const set = (k, v) => { setF(prev => ({ ...prev, [k]: v })); setSel(null); };
  const anioDe = e => BASES_ANIO[base].de(e) || SIN_ANIO;

  const opciones = useMemo(() => ({
    anio: [...new Set(lista.map(anioDe))].sort(ordenAnios),
    partida: [FILTRO_BIENES_DE_USO, ...Object.keys(PARTIDAS_INCISO_4).map(etiquetaPartida), etiquetaPartida(NO_ES_BIEN_DE_USO)],
    jurisdiccion: [...new Set(lista.map(e => e.jurisdiccion).filter(Boolean))].sort(),
    encuadre: [...new Set([...ENCUADRES_LICITACIONES, ...lista.map(e => e.encuadre).filter(Boolean)])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lista, base]);

  // Todos los filtros menos el año (para el cuadro por año).
  const sinAnio = useMemo(() => lista.filter(e => {
    if (f.partida === FILTRO_BIENES_DE_USO ? !esBienDeUso(e) : f.partida && etiquetaPartida(partidaDe(e)) !== f.partida) return false;
    if (f.jurisdiccion && e.jurisdiccion !== f.jurisdiccion) return false;
    if (f.encuadre && e.encuadre !== f.encuadre) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [lista, f.partida, f.jurisdiccion, f.encuadre]);
  const filas = useMemo(() => (f.anio ? sinAnio.filter(e => anioDe(e) === f.anio) : sinAnio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sinAnio, f.anio, base]);

  const total = filas.length;
  const porGrupo = Object.fromEntries(GRUPOS.map(g => [g.id, filas.filter(e => grupoDe(e.resolucionConv) === g)]));
  const conMotivo = filas.filter(e => pideMotivo(e.resolucionConv));
  const motivos = [...MOTIVOS_NO_ADJUDICACION, SIN_MOTIVO].filter(m => m !== SIN_MOTIVO || conMotivo.some(e => tieneMotivo(e, SIN_MOTIVO)));
  const anios = [...new Set(sinAnio.map(anioDe))].sort(ordenAnios);
  const elegir = (titulo, incluye) => setSel(s => (s?.titulo === titulo ? null : { titulo, incluye }));
  const seleccionados = sel ? filas.filter(sel.incluye) : [];
  const hayFiltros = f.anio || f.partida !== FILTRO_BIENES_DE_USO || f.jurisdiccion || f.encuadre;

  // Celda con un número que filtra la lista de abajo.
  const Num = ({ n, titulo, incluye, fuerte }) => (
    n ? (
      <button type="button" onClick={() => elegir(titulo, incluye)}
        className={"tabular-nums px-1.5 rounded hover:bg-slate-200 " + (fuerte ? "font-semibold text-slate-900 " : "text-slate-700 ") + (sel?.titulo === titulo ? "bg-slate-900 text-white hover:bg-slate-800" : "")}>
        {n}
      </button>
    ) : <span className="text-slate-300">-</span>
  );

  function exportar() {
    const datos = [
      ["EXP", "AÑO", "JURISDICCION", "OBJETO", "PARTIDA (INCISO 4)", "ENCUADRE", "RESOLUCION CONV.", "MOTIVO", "DETALLE DEL MOTIVO"],
      ...seleccionados.map(e => [e.exp, anioDe(e), e.jurisdiccion || "", e.objeto, etiquetaPartida(partidaDe(e)), e.encuadre || "",
        e.resolucionConv || "", (e.motivoResolucion || "") + (e.motivoDeResoluciones ? " (según Resoluciones)" : ""), e.motivoDetalle || ""]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(datos);
    ws["!cols"] = [16, 8, 26, 60, 26, 14, 22, 40, 50].map(wch => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Análisis");
    XLSX.writeFile(wb, "licitaciones-analisis-" + hoyLocalISO() + ".xlsx");
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 flex flex-wrap items-end gap-3">
        <label className="text-[11px] text-slate-500 space-y-1">
          <span className="block">Año según</span>
          <select value={base} onChange={e => { setBase(e.target.value); set("anio", ""); }}
            className="text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-900">
            {Object.entries(BASES_ANIO).map(([k, b]) => <option key={k} value={k}>{b.etiqueta}</option>)}
          </select>
        </label>
        <div className="w-36 text-[11px] text-slate-500 space-y-1"><span className="block">Año</span>
          <FiltroColumna valor={f.anio} etiqueta="Todos los años" opciones={opciones.anio} onChange={v => set("anio", v)} /></div>
        <div className="w-60 text-[11px] text-slate-500 space-y-1"><span className="block">Partida</span>
          <FiltroColumna valor={f.partida} etiqueta="Todas las partidas" opciones={opciones.partida} onChange={v => set("partida", v)} /></div>
        <div className="w-52 text-[11px] text-slate-500 space-y-1"><span className="block">Jurisdicción</span>
          <FiltroColumna valor={f.jurisdiccion} etiqueta="Todas" opciones={opciones.jurisdiccion} onChange={v => set("jurisdiccion", v)} /></div>
        <div className="w-40 text-[11px] text-slate-500 space-y-1"><span className="block">Encuadre</span>
          <FiltroColumna valor={f.encuadre} etiqueta="Todos" opciones={opciones.encuadre} onChange={v => set("encuadre", v)} /></div>
        {hayFiltros && (
          <button type="button" onClick={() => { setF({ anio: "", partida: FILTRO_BIENES_DE_USO, jurisdiccion: "", encuadre: "" }); setSel(null); }}
            className="ml-auto flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 pb-2">
            <X size={12} /> Volver a bienes de uso, todos los años
          </button>
        )}
      </div>

      {/* Totales */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <button type="button" onClick={() => elegir("Total de contrataciones", () => true)}
          className={"text-left rounded-xl border px-4 py-3 bg-slate-900 text-white " + (sel?.titulo === "Total de contrataciones" ? "ring-2 ring-offset-2 ring-slate-900" : "")}>
          <p className="text-[11px] text-slate-300">Total de contrataciones</p>
          <p className="text-2xl font-semibold tabular-nums">{total}</p>
          <p className="text-[11px] text-slate-400">{f.anio || "Todos los años"}</p>
        </button>
        {GRUPOS.map(g => (
          <button key={g.id} type="button" onClick={() => elegir(g.etiqueta, e => grupoDe(e.resolucionConv) === g)}
            className={"text-left rounded-xl border px-4 py-3 " + g.tarjeta + (sel?.titulo === g.etiqueta ? " ring-2 ring-offset-2 ring-slate-900" : "")}>
            <p className="text-[11px] opacity-80">{g.etiqueta}</p>
            <p className="text-2xl font-semibold tabular-nums">{porGrupo[g.id].length}</p>
            <p className="text-[11px] opacity-70">{pct(porGrupo[g.id].length, total)} del total</p>
          </button>
        ))}
      </div>

      {total > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 space-y-2">
          <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
            {GRUPOS.map(g => porGrupo[g.id].length > 0 && (
              <div key={g.id} className={g.color} style={{ width: (porGrupo[g.id].length / total) * 100 + "%" }}
                title={g.etiqueta + ": " + porGrupo[g.id].length + " (" + pct(porGrupo[g.id].length, total) + ")"} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
            {GRUPOS.map(g => (
              <span key={g.id} className="flex items-center gap-1.5"><span className={"w-2.5 h-2.5 rounded-sm " + g.color} />{g.etiqueta} {pct(porGrupo[g.id].length, total)}</span>
            ))}
          </div>
        </div>
      )}

      <div className="grid xl:grid-cols-2 gap-4">
        {/* Por año */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <h3 className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 text-sm font-semibold text-slate-900">Por año <span className="font-normal text-slate-500">({BASES_ANIO[base].etiqueta.toLowerCase()})</span></h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-3">Año</th><th className="py-2 px-2 text-right">Total</th>
                  {GRUPOS.map(g => <th key={g.id} className="py-2 px-2 text-right"><span className={"inline-block w-2 h-2 rounded-sm mr-1 " + g.color} />{g.etiqueta}</th>)}
                </tr>
              </thead>
              <tbody>
                {anios.map(a => {
                  const delAnio = sinAnio.filter(e => anioDe(e) === a);
                  return (
                    <tr key={a} className={"border-b border-slate-50 " + (f.anio === a ? "bg-slate-50" : "")}>
                      <td className="py-1.5 px-3 font-medium text-slate-900">{a}</td>
                      <td className="py-1.5 px-2 text-right">
                        <Num n={delAnio.length} fuerte titulo={a + " · total"} incluye={e => anioDe(e) === a} />
                      </td>
                      {GRUPOS.map(g => {
                        const n = delAnio.filter(e => grupoDe(e.resolucionConv) === g).length;
                        return (
                          <td key={g.id} className="py-1.5 px-2 text-right whitespace-nowrap">
                            <Num n={n} titulo={a + " · " + g.etiqueta} incluye={e => anioDe(e) === a && grupoDe(e.resolucionConv) === g} />
                            {n > 0 && <span className="ml-1 text-[10px] text-slate-400">{pct(n, delAnio.length)}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Por resolución */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <h3 className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 text-sm font-semibold text-slate-900">Por resolución de la convocatoria</h3>
          <table className="w-full text-xs">
            <tbody>
              {[...RESOLUCIONES_CONV_LICITACIONES, ""].map(r => {
                const n = filas.filter(e => (e.resolucionConv || "") === r).length;
                const g = grupoDe(r);
                return (
                  <tr key={r || "-"} className="border-b border-slate-50">
                    <td className="py-1.5 px-3">
                      <span className="flex items-center gap-2"><span className={"w-2.5 h-2.5 rounded-sm " + g.color} />{r || "Sin resolución cargada"}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right w-16"><Num n={n} fuerte titulo={r || "Sin resolución cargada"} incluye={e => (e.resolucionConv || "") === r} /></td>
                    <td className="py-1.5 px-3 text-right w-14 text-[10px] text-slate-400">{n ? pct(n, total) : ""}</td>
                    <td className="py-1.5 px-3 w-1/3">
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={"h-full " + g.color} style={{ width: (total ? (n / total) * 100 : 0) + "%" }} /></div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Motivos */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <h3 className="text-sm font-semibold text-slate-900">Por qué no se adjudicaron</h3>
          <span className="text-[11px] text-slate-500">
            {conMotivo.length} contratacion{conMotivo.length !== 1 ? "es" : ""} con adjudicación parcial o sin adjudicar · {conMotivo.filter(e => !tieneMotivo(e, SIN_MOTIVO)).length} con motivo cargado ({conMotivo.filter(e => e.motivoDeResoluciones).length} según Resoluciones) · una contratación con varios motivos cuenta en cada uno
          </span>
        </div>
        {conMotivo.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No hay contrataciones con adjudicación parcial o sin adjudicar con estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-3">Motivo</th>
                  {CON_MOTIVO.map(r => <th key={r} className="py-2 px-2 text-right">{r}</th>)}
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {motivos.map(m => {
                  const delMotivo = conMotivo.filter(e => tieneMotivo(e, m));
                  return (
                    <tr key={m} className={"border-b border-slate-50 " + (m === SIN_MOTIVO ? "bg-amber-50/60" : "")}>
                      <td className={"py-1.5 px-3 " + (m === SIN_MOTIVO ? "text-amber-800 font-medium" : "text-slate-800")}>{m}</td>
                      {CON_MOTIVO.map(r => (
                        <td key={r} className="py-1.5 px-2 text-right">
                          <Num n={delMotivo.filter(e => e.resolucionConv === r).length} titulo={m + " · " + r} incluye={e => pideMotivo(e.resolucionConv) && tieneMotivo(e, m) && e.resolucionConv === r} />
                        </td>
                      ))}
                      <td className="py-1.5 px-3 text-right">
                        <Num n={delMotivo.length} fuerte titulo={m} incluye={e => pideMotivo(e.resolucionConv) && tieneMotivo(e, m)} />
                        {delMotivo.length > 0 && <span className="ml-1 text-[10px] text-slate-400">{pct(delMotivo.length, conMotivo.length)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{sel ? sel.titulo : "Expedientes"}</h3>
            <span className="text-[11px] text-slate-500">
              {sel ? seleccionados.length + " expediente" + (seleccionados.length !== 1 ? "s" : "") + " · tocá uno para abrir su ficha" : "Tocá un número o una tarjeta para ver esos expedientes"}
            </span>
          </div>
          {sel && seleccionados.length > 0 && (
            <button type="button" onClick={exportar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">
              <Download size={14} /> Exportar a Excel
            </button>
          )}
        </div>
        {sel && (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-xs min-w-[1000px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                  <th className="py-2 px-3">Exp.</th><th className="py-2 px-3">Año</th><th className="py-2 px-3">Objeto</th>
                  <th className="py-2 px-3">Partida</th><th className="py-2 px-3">Resolución conv.</th><th className="py-2 px-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {seleccionados.map(e => (
                  <tr key={e.id} onClick={() => onAbrir(e.id)} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer align-top">
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900 whitespace-nowrap">{e.exp}</td>
                    <td className="py-2 px-3 text-slate-600">{anioDe(e)}</td>
                    <td className="py-2 px-3 text-slate-700"><span className="line-clamp-2" title={e.objeto}>{e.objeto}</span></td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{etiquetaPartida(partidaDe(e))}</td>
                    <td className="py-2 px-3">{e.resolucionConv ? <EtiquetaResolucion valor={e.resolucionConv} /> : <span className="text-slate-400">-</span>}</td>
                    <td className="py-2 px-3 text-slate-700">
                      {pideMotivo(e.resolucionConv) ? (e.motivoResolucion || <span className="text-amber-700">Sin cargar</span>) : <span className="text-slate-300">-</span>}
                      {pideMotivo(e.resolucionConv) && e.motivoDeResoluciones && <span className="block text-[10px] text-violet-700">según Resoluciones</span>}
                      {e.motivoDetalle && <span className="block text-[11px] text-slate-500">{e.motivoDetalle}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
