"use client";

import { useMemo, useState } from "react";
import { X, Plus, FilePlus2, ChevronDown } from "lucide-react";
import { ALERTA_ESTILO, ALERTA_LABEL, ZONAS, TIPOS_SERVICIOS, SECTORES, ESTADOS_CONVOCATORIA } from "@/lib/constants";
import FiltroDesplegable from "./FiltroDesplegable";
import { diasRestantes, alerta, alertaFrenado, diasFrenado, fmtFecha } from "@/lib/utils";

const norm = s => String(s || "").trim().toLowerCase();

// Filtro de columna: el desplegable propio (el mismo de la barra de filtros)
// con el nombre de la columna como primera opción — cuando esa es la
// elegida (sin filtro aplicado), se ve gris como un placeholder; al elegir
// un valor real, pasa a texto normal. Flota sobre la tabla para que el
// scroll horizontal no recorte la lista.
function FiltroColumna({ valor, vacio, etiqueta, opciones, onChange }) {
  return (
    <FiltroDesplegable
      valor={valor}
      onChange={onChange}
      opciones={[{ valor: vacio, etiqueta }, ...opciones]}
      clase={"bg-white border-slate-300 " + (valor === vacio ? "text-slate-400" : "text-slate-900")}
      anchoCompleto
      flotante
    />
  );
}

const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";

// Niveles de "Días frenado" — mismos colores que alerta() pero sin
// "vencido" (acá no aplica: frenado mide días parado en un sector, no
// vencimiento) y sumando "Sin frenar" para lo que no tiene nada frenado.
const NIVELES_FRENADO = ["rojo", "amarillo", "verde"];

function filtroVacio() {
  return {
    exp: "", fuero: "", domicilio: "",
    zona: "Todas", tipo: "Todos", sector: "Todos", estadoConvocatoria: "Todos",
    diasRestantes: "Todos", diasFrenado: "Todos",
  };
}

// Vista alternativa a las tarjetas para el listado de Servicios: una fila
// por expediente (sin agrupar por trámite), en el mismo estilo que la tabla
// "Detalle de expedientes" del Informe de Servicios — con un filtro propio
// por cada columna, independiente de los filtros generales de arriba. Solo
// muestra lo que está en trámite: renovaciones y parches (ni vigentes ni
// antecedentes).
export default function TablaExpedientesServicios({ expedientes, onVer, puedeEditar, onCambiarSector, onCambiarEstadoConvocatoria, onNuevo, onCaratular }) {
  const [f, setF] = useState(filtroVacio);
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }
  function limpiar() { setF(filtroVacio()); }
  // Celdas de Domicilio desplegadas (por id del expediente que dibuja la
  // celda): cerradas muestran solo el primer domicilio.
  const [domiciliosAbiertos, setDomiciliosAbiertos] = useState(() => new Set());
  function alternarDomicilios(id) {
    setDomiciliosAbiertos(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
  }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  const base = useMemo(() => (expedientes || []).filter(e => e.rol === "renovacion" || e.rol === "parche"), [expedientes]);

  const filas = useMemo(() => {
    return base.filter(e => {
      if (f.exp && !norm(e.exp + " " + (e.nombreCorto || "")).includes(norm(f.exp))) return false;
      if (f.fuero && !norm((e.fuero || []).join(" ")).includes(norm(f.fuero))) return false;
      if (f.domicilio && !norm((e.domiciliosRenglones || []).join(" ")).includes(norm(f.domicilio))) return false;
      if (f.zona !== "Todas" && e.zona !== f.zona) return false;
      if (f.tipo !== "Todos" && e.tipo !== f.tipo) return false;
      if (f.sector !== "Todos" && e.sector !== f.sector) return false;
      if (f.estadoConvocatoria !== "Todos" && (e.estadoConvocatoria || "") !== f.estadoConvocatoria) return false;
      if (f.diasRestantes !== "Todos" && alerta(diasRestantes(e.fechaVencimiento)) !== f.diasRestantes) return false;
      if (f.diasFrenado !== "Todos") {
        const frenado = diasFrenado(e.observaciones, e.creadoEn);
        if (f.diasFrenado === "sinFrenar") { if (frenado != null) return false; }
        else if (frenado == null || alertaFrenado(frenado) !== f.diasFrenado) return false;
      }
      return true;
    });
  }, [base, f]);

  // Fuero se muestra "acoplado" — como una celda combinada de Excel: se
  // ordena por fuero para que las filas que comparten uno queden juntas, y
  // solo la primera fila de cada grupo dibuja la celda (con rowSpan);
  // el resto la deja vacía en vez de repetir el mismo texto. Dentro de cada
  // fuero, los expedientes con los mismos edificios (mismo conjunto de
  // domicilios, sin importar el orden) se acoplan igual en Domicilio.
  const filasConFuero = useMemo(() => {
    const claveFuero = e => (e.fuero || []).join(" · ");
    const claveDomicilios = e => claveFuero(e) + "||" + [...(e.domiciliosRenglones || [])].sort().join("|");
    const ordenadas = [...filas].sort((a, b) => {
      const fa = claveFuero(a);
      const fb = claveFuero(b);
      if (fa !== fb) return fa.localeCompare(fb);
      const da = claveDomicilios(a);
      const db = claveDomicilios(b);
      if (da !== db) return da.localeCompare(db);
      return new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento);
    });
    // Cantidad de filas seguidas, desde i, con la misma clave (0 si la
    // fila i no es la primera de su grupo).
    function spanDesde(i, clave) {
      if (i > 0 && clave(ordenadas[i - 1]) === clave(ordenadas[i])) return 0;
      let span = 0;
      while (i + span < ordenadas.length && clave(ordenadas[i + span]) === clave(ordenadas[i])) span++;
      return span;
    }
    return ordenadas.map((e, i) => {
      // Sin domicilios cargados no hay edificios en común: no se acoplan.
      const spanDomicilio = (e.domiciliosRenglones || []).length === 0 ? 1 : spanDesde(i, claveDomicilios);
      const span = spanDesde(i, claveFuero);
      return { exp: e, fuero: claveFuero(e), esInicioGrupo: span > 0, span, spanDomicilio };
    });
  }, [filas]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Renovaciones en trámite y parches</h3>
          <span className="text-[11px] text-slate-500">{filas.length} de {base.length} expediente{base.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-3">
          {hayFiltros && (
            <button type="button" onClick={limpiar} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
              <X size={12} /> Limpiar filtros de la tabla
            </button>
          )}
          {puedeEditar && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCaratular} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">
                <FilePlus2 size={14} /> Caratular
              </button>
              <button type="button" onClick={onNuevo} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                <Plus size={14} /> Cargar expediente
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              <th className="py-2 px-5 align-top">
                <input value={f.fuero} onChange={e => set("fuero", e.target.value)} placeholder="Fuero" className={CLASE_INPUT} />
              </th>
              <th className="py-2 px-5 align-top">
                <input value={f.domicilio} onChange={e => set("domicilio", e.target.value)} placeholder="Domicilio" className={CLASE_INPUT} />
              </th>
              <th className="py-2 px-5 align-top">
                <FiltroColumna valor={f.zona} vacio="Todas" etiqueta="Zona" onChange={v => set("zona", v)}
                  opciones={ZONAS.map(z => ({ valor: z, etiqueta: z }))} />
              </th>
              <th className="py-2 px-5 align-top">
                <FiltroColumna valor={f.tipo} vacio="Todos" etiqueta="Tipo" onChange={v => set("tipo", v)}
                  opciones={TIPOS_SERVICIOS.map(t => ({ valor: t, etiqueta: t }))} />
              </th>
              <th className="py-2 px-5 align-top">
                <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Expediente" className={CLASE_INPUT} />
              </th>
              <th className="py-2 px-5 align-top">
                <span className="text-xs text-slate-400">Período</span>
              </th>
              <th className="py-2 px-5 align-top">
                <FiltroColumna valor={f.sector} vacio="Todos" etiqueta="Sector" onChange={v => set("sector", v)}
                  opciones={SECTORES.map(x => ({ valor: x, etiqueta: x }))} />
              </th>
              <th className="py-2 px-5 align-top">
                <FiltroColumna valor={f.estadoConvocatoria} vacio="Todos" etiqueta="Estado de convocatoria" onChange={v => set("estadoConvocatoria", v)}
                  opciones={ESTADOS_CONVOCATORIA.map(x => ({ valor: x, etiqueta: x }))} />
              </th>
              <th className="py-2 px-5 align-top">
                <FiltroColumna valor={f.diasRestantes} vacio="Todos" etiqueta="Días restantes" onChange={v => set("diasRestantes", v)}
                  opciones={Object.keys(ALERTA_LABEL).map(n => ({ valor: n, etiqueta: ALERTA_LABEL[n] }))} />
              </th>
              <th className="py-2 px-5 align-top">
                <FiltroColumna valor={f.diasFrenado} vacio="Todos" etiqueta="Días frenado" onChange={v => set("diasFrenado", v)}
                  opciones={[{ valor: "sinFrenar", etiqueta: "Sin frenar" }, ...NIVELES_FRENADO.map(n => ({ valor: n, etiqueta: ALERTA_LABEL[n] }))]} />
              </th>
            </tr>
          </thead>
          <tbody>
            {filasConFuero.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-slate-500">
                  No se encontraron expedientes con esos filtros.
                </td>
              </tr>
            ) : filasConFuero.map(({ exp: e, fuero, esInicioGrupo, span, spanDomicilio }) => {
              const yaCerrado = e.estadoGeneral === "Finalizado" || e.estadoGeneral === "Archivado";
              const dias = diasRestantes(e.fechaVencimiento);
              const niv = alerta(dias);
              const frenado = diasFrenado(e.observaciones, e.creadoEn);
              const domiciliosLista = e.domiciliosRenglones || [];
              return (
                <tr
                  key={e.id}
                  onClick={() => onVer(e.id)}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer"
                >
                  {esInicioGrupo && (
                    <td
                      rowSpan={span}
                      onClick={e2 => e2.stopPropagation()}
                      className="py-2.5 px-3 align-top border-r border-slate-50 cursor-default"
                    >
                      <div
                        title={fuero}
                        className="w-[110px] text-[11px] leading-snug text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1.5"
                      >
                        {fuero || "-"}
                      </div>
                    </td>
                  )}
                  {spanDomicilio > 0 && (
                    <td
                      rowSpan={spanDomicilio}
                      onClick={e2 => e2.stopPropagation()}
                      className="py-2.5 px-3 align-top border-r border-slate-50 cursor-default"
                    >
                      <div className="w-[130px] text-[11px] leading-snug text-slate-700 bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                        {domiciliosLista.length === 0 ? "-" : (
                          <>
                            {(domiciliosAbiertos.has(e.id) ? domiciliosLista : domiciliosLista.slice(0, 1)).map(d => <div key={d}>{d}</div>)}
                            {domiciliosLista.length > 1 && (
                              <button
                                type="button"
                                onClick={() => alternarDomicilios(e.id)}
                                className="mt-1 flex items-center gap-0.5 font-medium text-slate-500 hover:text-slate-900"
                              >
                                {domiciliosAbiertos.has(e.id) ? "Ver menos" : "+" + (domiciliosLista.length - 1) + " más"}
                                <ChevronDown size={11} className={"transition-transform " + (domiciliosAbiertos.has(e.id) ? "rotate-180" : "")} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="py-2.5 px-5 text-slate-600">{e.zona || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.tipo}</td>
                  <td className="py-2.5 px-5">
                    <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                    {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600 whitespace-nowrap">
                    {e.fechaInicio ? fmtFecha(e.fechaInicio) : "Sin fecha de inicio"} — {fmtFecha(e.fechaVencimiento)}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600">
                    {puedeEditar ? (
                      <button
                        type="button"
                        onClick={e2 => { e2.stopPropagation(); onCambiarSector(e); }}
                        className="underline decoration-dotted underline-offset-2 hover:text-slate-900 hover:decoration-solid"
                        title="Cambiar sector"
                      >
                        {e.sector || "Sin definir"}
                      </button>
                    ) : (e.sector || "-")}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600">
                    {puedeEditar ? (
                      <button
                        type="button"
                        onClick={e2 => { e2.stopPropagation(); onCambiarEstadoConvocatoria(e); }}
                        className="underline decoration-dotted underline-offset-2 hover:text-slate-900 hover:decoration-solid"
                        title="Cambiar estado de convocatoria"
                      >
                        {e.estadoConvocatoria || "Sin definir"}
                      </button>
                    ) : (e.estadoConvocatoria || "-")}
                  </td>
                  <td className="py-2.5 px-5">
                    {yaCerrado ? "-" : (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[niv]}>
                        {dias >= 0 ? dias + " días" : Math.abs(dias) + " días vencido"}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-5">
                    {frenado != null ? (
                      <span className={"text-[11px] font-medium px-2 py-0.5 rounded border " + ALERTA_ESTILO[alertaFrenado(frenado)]}>
                        {frenado + " días"}
                      </span>
                    ) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
