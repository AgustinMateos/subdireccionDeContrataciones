"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Plus, Download, Trash2, ArrowRight, ArrowUp, Archive, Search, MessageSquare } from "lucide-react";
import * as XLSX from "xlsx";
import { fmtFecha } from "@/lib/utils";
import { hoyLocalISO } from "@/lib/mesaEntradas";
import {
  HOJAS_IYV, ORDEN_HOJAS_IYV, TIPOS_IYV, AGENTES_IYV, SITUACIONES_IYV, camposDeHoja, campoIyV, diasHasta, ultimoMovIyV,
  sectoresIyV, estadosIyV, puedeEditarIyV, puedeEliminarIyV, bloqueVacioIyV, camposObsIyV, claveObsIyV,
  partidaIyV, partidaSegunObjetoIyV, esBienDeUsoIyV, esAnticipoIyV, expDeBloqueIyV, siguienteSubidaIyV, TITULO_BLOQUE_IYV,
} from "@/lib/cuadroIyV";
import Paginacion, { OPCIONES_POR_PAGINA } from "./Paginacion";
import CampoOpciones from "./CampoOpciones";
import { FiltroColumna, Seccion } from "./PanelResoluciones";
import { expParaBuscar } from "@/lib/numeroExpediente";
import { PARTIDAS_INCISO_4, NO_ES_BIEN_DE_USO, FILTRO_BIENES_DE_USO, etiquetaPartida } from "@/lib/inciso4";
import { Campo_Select } from "./CamposFormulario";

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const CLASE_INPUT = "w-full text-xs font-normal bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-900 hover:border-slate-500 transition-colors focus:outline-none focus:border-slate-500 placeholder:text-slate-400";
// Color de la cabecera de cada bloque de la tabla y la ficha.
const COLOR_BLOQUE = {
  vigente: "bg-emerald-50 text-emerald-800 border-emerald-200",
  continuidad: "bg-amber-50 text-amber-800 border-amber-200",
  renovacion: "bg-sky-50 text-sky-800 border-sky-200",
};
// Columnas de inicio que muestran cuántos días faltan.
const CON_DIAS = ["cInicio", "rInicio"];

// Opciones del filtro de partida (como en Licitaciones).
const OPCIONES_PARTIDA = [FILTRO_BIENES_DE_USO, ...Object.keys(PARTIDAS_INCISO_4).map(etiquetaPartida), etiquetaPartida(NO_ES_BIEN_DE_USO)];

const filtroVacio = () => ({ partida: "", texto: "", grupo: "", tipoServicio: "", agente: "", sector: "", estado: "", situacion: "", anioMov: "" });

// Días que faltan para una fecha (o hace cuántos pasó), como etiqueta.
function EtiquetaDias({ dias }) {
  if (dias == null) return null;
  const clase = dias < 0 ? "bg-slate-100 text-slate-500 border-slate-200"
    : dias <= 30 ? "bg-red-50 text-red-700 border-red-200"
      : dias <= 90 ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <span className={"block mt-0.5 w-fit text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap " + clase}>
      {dias < 0 ? "hace " + -dias + " d" : dias === 0 ? "hoy" : "faltan " + dias + " d"}
    </span>
  );
}

// Las observaciones de un historial, en texto ("12/11/2026 Ana: ...").
const textoObs = lista => (lista || []).map(o => fmtFecha(String(o.fecha).slice(0, 10)) + " " + o.usuario + ": " + o.texto).join("\n");

// Excel de lo que se ve (la solapa con sus filtros), con todas las
// columnas; las observaciones, con su historial por N° de expediente.
function exportarExcel(hoja, filas, obsPorClave) {
  const def = HOJAS_IYV[hoja];
  const campos = def.bloques.flatMap(b => b.campos.map(campo => ({ ...campo, bloque: b })));
  const titulo = campo => (campo.bloque === def.bloques[0] ? campo.label : campo.bloque.titulo + " - " + campo.label).toUpperCase();
  const valor = (f, campo) => (campo.historial ? textoObs(obsPorClave.get(claveObsIyV(f.datos, f.id, campo)))
    : campo.partida ? etiquetaPartida(partidaIyV(f.datos)) : f.datos?.[campo.k] || "");
  const datos = [campos.map(titulo), ...filas.map(f => campos.map(campo => valor(f, campo)))];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  ws["!cols"] = campos.map(campo => ({ wch: campo.largo || campo.historial ? 50 : campo.exp ? 16 : 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, def.etiqueta.slice(0, 31));
  XLSX.writeFile(wb, "informatica-y-varios-" + hoja + "-" + hoyLocalISO() + ".xlsx");
}

// Cuadro de Informática y Varios: la planilla del departamento, en cuatro
// solapas. El panel anterior (tarjetas de expedientes) sigue en el menú.
export default function PanelCuadroIyV({ sesion, mostrarToast }) {
  const puedeEditar = puedeEditarIyV(sesion);
  const [filas, setFilas] = useState(null);
  const [observaciones, setObservaciones] = useState([]);
  const [hoja, setHoja] = useState("servicios");
  const [f, setF] = useState(filtroVacio);
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(OPCIONES_POR_PAGINA[1]);
  const [ficha, setFicha] = useState(null); // null | "nueva" | id
  const hoy = hoyLocalISO();

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const res = await fetch("/api/cuadro-iyv");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + ")");
        if (activo) { setFilas(data.filas || []); setObservaciones(data.observaciones || []); }
      } catch (err) {
        if (activo) { setFilas([]); mostrarToast(err.message || "No se pudo cargar el cuadro"); }
      }
    })();
    return () => { activo = false; };
    // Solo al montar: mostrarToast cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lista = filas || [];
  // Observaciones por clave (N° de expediente o bloque sin N°).
  const obsPorClave = useMemo(() => {
    const m = new Map();
    for (const o of observaciones) { if (!m.has(o.clave)) m.set(o.clave, []); m.get(o.clave).push(o); }
    return m;
  }, [observaciones]);
  const deLaHoja = useMemo(() => lista.filter(x => x.hoja === hoja), [lista, hoja]);
  const def = HOJAS_IYV[hoja];
  const tieneGrupo = !!campoIyV(hoja, "grupo");
  const tieneSituacion = !!campoIyV(hoja, "estado");

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); setPagina(0); }
  function cambiarHoja(h) { setHoja(h); setF(filtroVacio()); setPagina(0); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  const opciones = useMemo(() => {
    const de = (valores, base = []) => [...new Set([...base, ...valores.filter(Boolean)])].sort((a, b) => a.localeCompare(b));
    return {
      grupo: de(deLaHoja.map(x => x.datos.grupo)),
      tipoServicio: de(deLaHoja.map(x => x.datos.tipoServicio), TIPOS_IYV),
      agente: de(deLaHoja.map(x => x.datos.agente), AGENTES_IYV),
      sector: de(deLaHoja.flatMap(x => sectoresIyV(x.datos))),
      estado: de(deLaHoja.flatMap(x => estadosIyV(x.datos))),
      situacion: de(deLaHoja.map(x => x.datos.estado), SITUACIONES_IYV),
      anioMov: [...new Set(deLaHoja.map(x => ultimoMovIyV(x.datos).slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
    };
  }, [deLaHoja]);

  const filtradas = useMemo(() => {
    const q = norm(expParaBuscar(f.texto));
    return deLaHoja.filter(x => {
      const d = x.datos;
      if (q && !norm(Object.values(d).join(" ") + " " + camposObsIyV(hoja).flatMap(c => (obsPorClave.get(claveObsIyV(d, x.id, c)) || []).map(o => o.texto)).join(" ")).includes(q)) return false;
      if (f.grupo && d.grupo !== f.grupo) return false;
      if (f.tipoServicio && d.tipoServicio !== f.tipoServicio) return false;
      if (f.agente && d.agente !== f.agente) return false;
      if (f.sector && !sectoresIyV(d).includes(f.sector)) return false;
      if (f.estado && !estadosIyV(d).includes(f.estado)) return false;
      if (f.situacion && d.estado !== f.situacion) return false;
      if (f.anioMov && ultimoMovIyV(d).slice(0, 4) !== f.anioMov) return false;
      if (f.partida === FILTRO_BIENES_DE_USO ? !esBienDeUsoIyV(d) : f.partida && etiquetaPartida(partidaIyV(d)) !== f.partida) return false;
      return true;
    });
  }, [deLaHoja, f, obsPorClave, hoja]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const filasPagina = filtradas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);
  const seleccionada = ficha && ficha !== "nueva" ? lista.find(x => x.id === ficha) : null;

  async function enviar(url, method, body) {
    let res;
    try {
      res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    } catch {
      return { error: "Sin conexión: no se guardó el cambio" };
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "No se pudo guardar" };
    return data;
  }

  async function guardar(datos) {
    const data = seleccionada
      ? await enviar("/api/cuadro-iyv/" + seleccionada.id, "PATCH", { datos })
      : await enviar("/api/cuadro-iyv", "POST", { hoja, datos });
    if (data.error) return data;
    setFilas(prev => (seleccionada ? prev.map(x => (x.id === data.fila.id ? data.fila : x)) : [...prev, data.fila]));
    if (data.observaciones) setObservaciones(data.observaciones);
    setFicha(null);
    mostrarToast(seleccionada ? "Cambios guardados" : "Fila cargada en " + def.etiqueta);
  }

  // Archivar el vigente o subir un bloque (ver la API): la ficha sigue
  // abierta con la fila actualizada; lo archivado se suma a Antecedentes.
  async function accionFila(body) {
    const data = await enviar("/api/cuadro-iyv/" + seleccionada.id, "POST", body);
    if (data.error) return data;
    setFilas(prev => [...prev.map(x => (x.id === data.fila.id ? data.fila : x)), ...(data.antecedente ? [data.antecedente] : [])]);
    if (data.observaciones) setObservaciones(data.observaciones);
    mostrarToast(body.accion === "archivarVigente" ? "Vigente archivado en Antecedentes"
      : "Pasó de " + TITULO_BLOQUE_IYV[body.desde] + " a " + TITULO_BLOQUE_IYV[body.hacia]);
    return data;
  }

  // Observaciones: se guardan al toque (no con "Guardar cambios").
  async function agregarObs(clave, texto) {
    const data = await enviar("/api/cuadro-iyv/observaciones", "POST", { clave, texto });
    if (data.error) return data;
    setObservaciones(prev => [...prev, data.observacion]);
    mostrarToast("Observación agregada");
    return data;
  }
  async function borrarObs(id) {
    const data = await enviar("/api/cuadro-iyv/observaciones?id=" + encodeURIComponent(id), "DELETE");
    if (data.error) { mostrarToast(data.error); return; }
    setObservaciones(prev => prev.filter(o => o.id !== id));
    mostrarToast("Observación borrada");
  }

  async function eliminar() {
    const data = await enviar("/api/cuadro-iyv/" + seleccionada.id, "DELETE");
    if (data.error) return data;
    setFilas(prev => prev.filter(x => x.id !== seleccionada.id));
    setFicha(null);
    mostrarToast("Fila eliminada");
  }

  if (filas === null) return <div className="py-16 text-center text-sm text-slate-500">Cargando el cuadro...</div>;

  const bloquesTabla = def.tabla.map(([id, claves]) => ({ bloque: def.bloques.find(b => b.id === id), claves }));
  const totalColumnas = bloquesTabla.reduce((n, b) => n + b.claves.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Cuadro de Informática y Varios</h2>
        <p className="text-xs text-slate-500">Servicios, provisiones (con los servicios temporales) y antecedentes del departamento.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {ORDEN_HOJAS_IYV.map(h => (
          <button key={h} type="button" onClick={() => cambiarHoja(h)}
            className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5 whitespace-nowrap " +
              (hoja === h ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {HOJAS_IYV[h].etiqueta}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 tabular-nums">
              {lista.filter(x => x.hoja === h).length}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{def.etiqueta}</h3>
            <span className="text-[11px] text-slate-500">{filtradas.length} de {deLaHoja.length} fila{deLaHoja.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-3">
            {hayFiltros && (
              <button type="button" onClick={() => { setF(filtroVacio()); setPagina(0); }} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
                <X size={12} /> Limpiar filtros
              </button>
            )}
            <button type="button" onClick={() => exportarExcel(hoja, filtradas, obsPorClave)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50">
              <Download size={14} /> Exportar a Excel
            </button>
            {puedeEditar && (
              <button type="button" onClick={() => setFicha("nueva")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
                <Plus size={14} /> Cargar fila
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 px-5 py-3 border-b border-slate-100">
          <div className="col-span-2 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={f.texto} onChange={e => set("texto", e.target.value)} placeholder="Buscar exp., objeto, organismo, adjudicatario..." className={CLASE_INPUT + " pl-7"} />
          </div>
          {tieneGrupo && <FiltroColumna valor={f.grupo} etiqueta="Todos los grupos" opciones={opciones.grupo} onChange={v => set("grupo", v)} />}
          <FiltroColumna valor={f.tipoServicio} etiqueta="Informática y Varios" opciones={opciones.tipoServicio} onChange={v => set("tipoServicio", v)} />
          <FiltroColumna valor={f.agente} etiqueta="Todos los agentes" opciones={opciones.agente} onChange={v => set("agente", v)} />
          <FiltroColumna valor={f.sector} etiqueta="Todos los sectores" opciones={opciones.sector} onChange={v => set("sector", v)} />
          <FiltroColumna valor={f.estado} etiqueta="Todos los estados" opciones={opciones.estado} onChange={v => set("estado", v)} />
          {tieneSituacion && <FiltroColumna valor={f.situacion} etiqueta="Tramitando y finalizados" opciones={opciones.situacion} onChange={v => set("situacion", v)} />}
          <FiltroColumna valor={f.anioMov} etiqueta="Último mov.: todos" opciones={opciones.anioMov} onChange={v => set("anioMov", v)} />
          <FiltroColumna valor={f.partida} etiqueta="Todas las partidas" opciones={OPCIONES_PARTIDA} onChange={v => set("partida", v)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1500px]">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wide">
                {bloquesTabla.map(({ bloque, claves }, i) => (
                  <th key={bloque.id} colSpan={claves.length}
                    className={"px-3 py-1.5 border-b " + (i > 0 ? "border-l " : "") + (COLOR_BLOQUE[bloque.id] || "bg-slate-50 text-slate-500 border-slate-100")}>
                    {bloque.titulo}
                  </th>
                ))}
              </tr>
              <tr className="text-left border-b border-slate-100 bg-slate-50/40 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                {bloquesTabla.map(({ bloque, claves }, i) => claves.map((k, j) => (
                  <th key={k} className={"py-2 px-3 " + (i > 0 && j === 0 ? "border-l border-slate-100" : "")}>{campoIyV(hoja, k).label}</th>
                )))}
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? (
                <tr><td colSpan={totalColumnas} className="py-10 text-center text-sm text-slate-500">No hay filas con esos filtros.</td></tr>
              ) : filasPagina.map((x, i) => {
                const d = x.datos;
                // Un grupo nuevo (otro código) arranca con una línea más marcada.
                const nuevoGrupo = tieneGrupo && i > 0 && d.grupo !== filasPagina[i - 1].datos.grupo;
                return (
                  <tr key={x.id} onClick={() => setFicha(x.id)}
                    className={"border-b hover:bg-slate-50/60 cursor-pointer align-top text-xs text-slate-700 " + (nuevoGrupo ? "border-t-2 border-t-slate-300 " : "") + "border-slate-50"}>
                    {bloquesTabla.map(({ claves }, bi) => claves.map((k, j) => {
                      const campo = campoIyV(hoja, k);
                      const valor = d[k];
                      return (
                        <td key={k} className={"py-2 px-3 " + (bi > 0 && j === 0 ? "border-l border-slate-100 " : "") + (campo.exp ? "whitespace-nowrap" : "")}>
                          <span title={valor || ""} className={(campo.exp ? "font-mono font-semibold text-slate-900 " : "") + (k === "objeto" ? "line-clamp-2 min-w-[180px] " : "line-clamp-2 ")}>
                            {valor || "-"}
                          </span>
                          {CON_DIAS.includes(k) && <EtiquetaDias dias={diasHasta(valor, hoy)} />}
                          {k === "objeto" && esBienDeUsoIyV(d) && (
                            <span title={etiquetaPartida(partidaIyV(d))} className="block mt-1 w-fit text-[10px] font-semibold px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-800">
                              {partidaIyV(d)} · Bien de uso
                            </span>
                          )}
                        </td>
                      );
                    }))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Paginacion total={filtradas.length} pagina={paginaActual} porPagina={porPagina}
          onPagina={setPagina} onPorPagina={n => { setPorPagina(n); setPagina(0); }} />
      </div>

      {ficha && (
        <FichaFila
          key={ficha}
          hoja={seleccionada?.hoja || hoja}
          inicial={seleccionada}
          puedeEditar={puedeEditar}
          puedeEliminar={puedeEliminarIyV(sesion)}
          onCerrar={() => setFicha(null)}
          onGuardar={guardar}
          onEliminar={eliminar}
          onAccion={seleccionada?.hoja === "servicios" ? accionFila : null}
          obsPorClave={obsPorClave}
          onAgregarObs={agregarObs}
          onBorrarObs={borrarObs}
        />
      )}
    </div>
  );
}

// Ficha de una fila: sus campos por bloque (editables para el
// departamento) y el historial de cambios.
function FichaFila({ hoja, inicial, puedeEditar, puedeEliminar, onCerrar, onGuardar, onEliminar, onAccion, obsPorClave, onAgregarObs, onBorrarObs }) {
  const def = HOJAS_IYV[hoja];
  const [d, setD] = useState(() => ({ ...(inicial?.datos || {}) }));
  const [solapa, setSolapa] = useState("datos");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  // null | "eliminar" | "archivar" | { desde, hacia } (subir un bloque)
  const [confirmar, setConfirmar] = useState(null);
  // Adjudicatario del vigente recién archivado (para una prórroga que sube).
  const [adjudicatarioArchivado, setAdjudicatarioArchivado] = useState("");
  // Tras archivar o subir un bloque, la fila cambia: se muestra como quedó.
  useEffect(() => { if (inicial) setD({ ...(inicial.datos || {}) }); }, [inicial?.actualizadoEn]); // eslint-disable-line react-hooks/exhaustive-deps
  const historial = [...(inicial?.movimientos || [])].reverse();
  const hoy = hoyLocalISO();
  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));

  async function correr(accion) {
    setGuardando(true); setError("");
    const r = await accion();
    setGuardando(false);
    if (r?.error) setError(r.error);
  }
  // Solo los campos que cambiaron (vacío = borrar).
  function guardar() {
    const antes = inicial?.datos || {};
    const cambios = Object.fromEntries(camposDeHoja(hoja).map(c => c.k).filter(k => (d[k] || "") !== (antes[k] || "")).map(k => [k, d[k] || ""]));
    if (inicial && !Object.keys(cambios).length) { onCerrar(); return; }
    correr(() => onGuardar(inicial ? cambios : d));
  }

  const hayCambios = !!inicial && camposDeHoja(hoja).some(c => (d[c.k] || "") !== (inicial.datos?.[c.k] || ""));
  const subida = inicial && onAccion && puedeEditar ? siguienteSubidaIyV(inicial.datos || {}) : null;
  // Archivar o subir: con cambios sin guardar, primero hay que guardarlos.
  // Después de cada paso se propone el siguiente (continuidad → vigente,
  // renovación → continuidad...).
  function pedir(paso) {
    if (hayCambios) { setError("Guardá o cancelá los cambios antes de archivar o pasar bloques"); return; }
    setError(""); setConfirmar(paso);
  }
  async function hacer(body) {
    setGuardando(true); setError("");
    const r = await onAccion(body);
    setGuardando(false);
    if (r?.error) { setError(r.error); return; }
    if (r.antecedente) setAdjudicatarioArchivado(r.antecedente.datos?.adjudicatario || "");
    setConfirmar(siguienteSubidaIyV(r.fila.datos || {}));
  }
  const textoConfirmar = confirmar === "eliminar" ? "¿Eliminar esta fila y su historial? No se puede deshacer."
    : confirmar === "archivar" ? "¿Archivar el vigente (" + (expDeBloqueIyV(inicial?.datos, "vigente") || "sin N°") + ") en Antecedentes? Pasa con los datos del servicio; acá el vigente queda vacío."
      : confirmar ? "¿Pasar el exp. de " + TITULO_BLOQUE_IYV[confirmar.desde] + " (" + (expDeBloqueIyV(inicial?.datos, confirmar.desde) || "sin N°") + ") a " + TITULO_BLOQUE_IYV[confirmar.hacia] + "?" : "";

  const titulo = inicial ? (d.exp || d.rExp || d.cExp || "Sin N° de expediente") : "Cargar fila en " + def.etiqueta;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl my-8">
        <div className="px-6 pt-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 font-mono break-words">{titulo}</h2>
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{[d.grupo, d.organismo, d.objeto].filter(Boolean).join(" · ") || def.etiqueta}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {inicial && puedeEliminar && (
                <button onClick={() => setConfirmar("eliminar")} title="Eliminar" className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><Trash2 size={16} /></button>
              )}
              <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
            </div>
          </div>
          {inicial && (
            <div className="flex items-center gap-1 mt-3">
              {[{ id: "datos", etiqueta: "Datos" }, { id: "historial", etiqueta: "Historial (" + historial.length + ")" }].map(t => (
                <button key={t.id} type="button" onClick={() => setSolapa(t.id)}
                  className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors " +
                    (solapa === t.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
                  {t.etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-5 space-y-6">
          {solapa === "datos" ? def.bloques.map(b => (
            <div key={b.id} className={COLOR_BLOQUE[b.id] ? "rounded-lg border p-4 " + COLOR_BLOQUE[b.id].split(" ").filter(c => c.startsWith("border")).join(" ") : ""}>
              <Seccion titulo={b.titulo}>
                {b.campos.map(campo => {
                  const ancho = campo.largo ? "col-span-2 md:col-span-4" : "";
                  if (campo.partida) {
                    const segun = "Según el objeto: " + etiquetaPartida(partidaSegunObjetoIyV(d.objeto));
                    const nota = esAnticipoIyV(d) ? "Anticipo de fondos: nunca cuenta como bien de uso." : null;
                    if (!puedeEditar) {
                      return (
                        <div key={campo.k} className="col-span-2 min-w-0">
                          <p className="text-xs font-medium text-slate-500 mb-1">{campo.label}</p>
                          <p className="text-sm text-slate-900">{etiquetaPartida(partidaIyV(d)) + (d.partida ? "" : " (según el objeto)")}</p>
                          {nota && <p className="text-[11px] text-slate-500 mt-0.5">{nota}</p>}
                        </div>
                      );
                    }
                    return (
                      <div key={campo.k} className="col-span-2">
                        <Campo_Select label="Partida (Inciso 4 · bienes de uso)" value={d.partida || ""} onChange={v => set("partida", v)}
                          opciones={["", ...Object.keys(PARTIDAS_INCISO_4), NO_ES_BIEN_DE_USO]}
                          labels={{ "": segun, ...Object.fromEntries([...Object.keys(PARTIDAS_INCISO_4), NO_ES_BIEN_DE_USO].map(p => [p, etiquetaPartida(p)])) }} />
                        {nota && <p className="text-[11px] text-slate-500 mt-1">{nota}</p>}
                      </div>
                    );
                  }
                  if (campo.historial) {
                    return (
                      <div key={campo.k} className="col-span-2 md:col-span-4">
                        <HistorialObs
                          exp={inicial?.datos?.[campo.historial] || ""}
                          clave={inicial ? claveObsIyV(inicial.datos, inicial.id, campo) : null}
                          expCambiado={!!inicial && (d[campo.historial] || "") !== (inicial.datos?.[campo.historial] || "")}
                          lista={inicial ? obsPorClave.get(claveObsIyV(inicial.datos, inicial.id, campo)) || [] : []}
                          puedeEditar={puedeEditar} puedeEliminar={puedeEliminar}
                          onAgregar={onAgregarObs} onBorrar={onBorrarObs}
                        />
                      </div>
                    );
                  }
                  if (!puedeEditar) {
                    return (
                      <div key={campo.k} className={"min-w-0 " + ancho}>
                        <p className="text-xs font-medium text-slate-500 mb-1">{campo.label}</p>
                        <p className={"text-sm text-slate-900 break-words whitespace-pre-line " + (campo.exp ? "font-mono" : "")}>{d[campo.k] || "-"}</p>
                        {CON_DIAS.includes(campo.k) && <EtiquetaDias dias={diasHasta(d[campo.k], hoy)} />}
                      </div>
                    );
                  }
                  if (campo.largo) {
                    return (
                      <label key={campo.k} className={"block " + ancho}>
                        <span className="block text-xs font-medium text-slate-600 mb-1">{campo.label}</span>
                        <textarea value={d[campo.k] || ""} onChange={e => set(campo.k, e.target.value)} rows={2}
                          className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y" />
                      </label>
                    );
                  }
                  if (campo.opciones) {
                    return <div key={campo.k}><CampoOpciones label={campo.label} value={d[campo.k] || ""} onChange={v => set(campo.k, v)} opciones={campo.opciones} /></div>;
                  }
                  return (
                    <label key={campo.k} className="block">
                      <span className="block text-xs font-medium text-slate-600 mb-1">{campo.label}</span>
                      <input value={d[campo.k] || ""} onChange={e => set(campo.k, e.target.value)}
                        placeholder={/inicio|vencimiento|ultimo/i.test(campo.k) ? "dd/mm/aaaa" : ""}
                        className={"w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 " + (campo.exp ? "font-mono" : "")} />
                      {CON_DIAS.includes(campo.k) && <EtiquetaDias dias={diasHasta(d[campo.k], hoy)} />}
                    </label>
                  );
                })}
              </Seccion>
            </div>
          )) : (
            historial.length === 0 ? <p className="text-sm text-slate-500">Sin cambios registrados.</p> : (
              <ol className="relative border-l border-slate-200 ml-1.5 space-y-4">
                {historial.map(m => (
                  <li key={m.id} className="pl-5 relative">
                    <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ring-2 ring-white bg-slate-800" />
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span className="font-medium text-slate-700">{fmtFecha(String(m.fecha).slice(0, 10))}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{m.campo}</span>
                      <span className="ml-auto">{m.usuario}</span>
                    </div>
                    <p className="mt-1 text-sm flex flex-wrap items-center gap-1.5">
                      {m.anterior && (<><span className="text-slate-500 line-through whitespace-pre-line">{m.anterior}</span><ArrowRight size={13} className="text-slate-400" /></>)}
                      <span className="font-medium text-slate-900 whitespace-pre-line">{m.valor}</span>
                    </p>
                  </li>
                ))}
              </ol>
            )
          )}
        </div>

        <div className="sticky bottom-0 bg-white rounded-b-xl">
                {confirmar && (
          <div className={"mx-6 mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2 border " +
            (confirmar === "eliminar" ? "bg-red-50 border-red-200" : "bg-sky-50 border-sky-200")}>
            <p className={"text-xs " + (confirmar === "eliminar" ? "text-red-800" : "text-sky-900")}>{textoConfirmar}</p>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => setConfirmar(null)} disabled={guardando} className="px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium">
                {typeof confirmar === "object" ? "No" : "Cancelar"}
              </button>
              <button disabled={guardando}
                onClick={() => (confirmar === "eliminar" ? correr(onEliminar)
                  : confirmar === "archivar" ? hacer({ accion: "archivarVigente" })
                    : hacer({ accion: "subirBloque", desde: confirmar.desde, hacia: confirmar.hacia, adjudicatario: adjudicatarioArchivado }))}
                className={"px-3 py-1.5 rounded-md text-white text-xs font-medium disabled:opacity-50 " +
                  (confirmar === "eliminar" ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800")}>
                {guardando ? "..." : confirmar === "eliminar" ? "Eliminar" : confirmar === "archivar" ? "Archivar vigente" : "Sí, pasar"}
              </button>
            </div>
          </div>
        )}
        {error && <p className="mx-6 mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

        {solapa === "datos" && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
            <div>
              {inicial && puedeEditar && onAccion && (
                <div className="flex items-center gap-2 flex-wrap">
                  {!bloqueVacioIyV(inicial.datos, "vigente") && (
                    <button onClick={() => pedir("archivar")} disabled={guardando}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <Archive size={13} /> Archivar vigente
                    </button>
                  )}
                  {subida && (
                    <button onClick={() => pedir(subida)} disabled={guardando}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50">
                      <ArrowUp size={13} /> Pasar {TITULO_BLOQUE_IYV[subida.desde]} a {TITULO_BLOQUE_IYV[subida.hacia]}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onCerrar} disabled={guardando} className="px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50">
                {puedeEditar ? "Cancelar" : "Cerrar"}
              </button>
              {puedeEditar && (
                <button onClick={guardar} disabled={guardando} className="px-4 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50">
                  {guardando ? "Guardando..." : inicial ? "Guardar cambios" : "Cargar fila"}
                </button>
              )}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

// Historial de observaciones de un bloque: las de su N° de expediente (las
// mismas en cualquier bloque o solapa donde esté ese N°), y un cuadro para
// agregar una.
function HistorialObs({ exp, clave, expCambiado, lista, puedeEditar, puedeEliminar, onAgregar, onBorrar }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const ordenadas = [...lista].reverse();

  async function agregar() {
    if (!texto.trim()) return;
    setEnviando(true); setError("");
    const r = await onAgregar(clave, texto);
    setEnviando(false);
    if (r?.error) setError(r.error); else setTexto("");
  }

  return (
    <div className="bg-white/70 border border-slate-200 rounded-md p-3 space-y-2.5">
      <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
        <MessageSquare size={13} /> Observaciones {exp ? <>del <span className="font-mono">{exp}</span></> : <span className="text-slate-400">(este bloque todavía no tiene N° de expediente)</span>}
        <span className="text-slate-400">· {lista.length}</span>
      </p>
      {!clave ? (
        <p className="text-xs text-slate-500">Cargá la fila para agregar observaciones.</p>
      ) : (
        <>
          {ordenadas.length > 0 && (
            <ol className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {ordenadas.map(o => (
                <li key={o.id} className="text-sm bg-slate-50 border border-slate-100 rounded-md px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700">{fmtFecha(String(o.fecha).slice(0, 10))}</span>
                    <span>{o.usuario}</span>
                    {puedeEliminar && (
                      <button type="button" onClick={() => onBorrar(o.id)} title="Borrar observación" className="ml-auto text-slate-300 hover:text-red-600"><Trash2 size={12} /></button>
                    )}
                  </div>
                  <p className="mt-0.5 text-slate-800 whitespace-pre-line break-words">{o.texto}</p>
                </li>
              ))}
            </ol>
          )}
          {puedeEditar && (
            <div className="flex items-start gap-2">
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} placeholder={"Nueva observación" + (exp ? " del " + exp : "") + "..."}
                className="flex-1 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800 resize-y bg-white" />
              <button type="button" onClick={agregar} disabled={enviando || !texto.trim()}
                className="px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-40">
                {enviando ? "..." : "Agregar"}
              </button>
            </div>
          )}
          {expCambiado && <p className="text-[11px] text-amber-700">Cambiaste el N° de expediente: guardá los cambios para ver las observaciones del N° nuevo.</p>}
          {error && <p className="text-xs text-red-700">{error}</p>}
        </>
      )}
    </div>
  );
}
