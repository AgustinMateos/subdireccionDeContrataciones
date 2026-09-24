"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ALERTA_ESTILO, ALERTA_LABEL, ROL_LABEL, ZONAS, TIPOS_SERVICIOS, SECTORES, ESTADOS_CONVOCATORIA } from "@/lib/constants";
import { diasRestantes, alerta, alertaFrenado, diasFrenado, fmtFecha } from "@/lib/utils";

const norm = s => String(s || "").trim().toLowerCase();

// El nombre de la columna es la primera opción del select — cuando esa es
// la elegida (sin filtro aplicado), se ve gris como un placeholder; al
// elegir un valor real, pasa a texto normal.
function selectClase(esPlaceholder) {
  return "w-full text-xs font-normal border border-slate-300 rounded px-1.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-800 " +
    (esPlaceholder ? "text-slate-400" : "text-slate-900");
}

// Niveles de "Días frenado" — mismos colores que alerta() pero sin
// "vencido" (acá no aplica: frenado mide días parado en un sector, no
// vencimiento) y sumando "Sin frenar" para lo que no tiene nada frenado.
const NIVELES_FRENADO = ["rojo", "amarillo", "verde"];

// Mismo criterio que TarjetaGrupoServicios: un parche muestra su tipo
// puntual (o "Parche / Contratación puente" si no tiene uno cargado), sin
// entrar en el detalle de meses de prórroga por departamento (esta tabla no
// tiene a mano el resto de la cadena para calcularlo).
function rolTexto(e) {
  if (e.rol === "parche") {
    return e.tipoParche || (e.tipoContratacionProrroga ? "Prórroga (departamento)" : ROL_LABEL.parche);
  }
  return ROL_LABEL[e.rol];
}

function filtroVacio() {
  return {
    exp: "", fuero: "", domicilio: "",
    zona: "Todas", tipo: "Todos", rol: "Todos", sector: "Todos", estadoConvocatoria: "Todos",
    diasRestantes: "Todos", diasFrenado: "Todos",
  };
}

// Vista alternativa a las tarjetas para el listado de Servicios: una fila
// por expediente (sin agrupar por trámite), en el mismo estilo que la tabla
// "Detalle de expedientes" del Informe de Servicios — con un filtro propio
// por cada columna, independiente de los filtros generales de arriba. Los
// antecedentes no se muestran, mismo criterio que las tarjetas de grupo (ya
// es cobertura cerrada y reemplazada).
export default function TablaExpedientesServicios({ expedientes, onVer, puedeEditar, onCambiarSector, onCambiarEstadoConvocatoria }) {
  const [f, setF] = useState(filtroVacio);
  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); }
  function limpiar() { setF(filtroVacio()); }
  const hayFiltros = Object.entries(f).some(([k, v]) => v !== filtroVacio()[k]);

  const base = useMemo(() => (expedientes || []).filter(e => e.rol !== "antecedente"), [expedientes]);

  const filas = useMemo(() => {
    return base.filter(e => {
      if (f.exp && !norm(e.exp + " " + (e.nombreCorto || "")).includes(norm(f.exp))) return false;
      if (f.fuero && !norm((e.fuero || []).join(" ")).includes(norm(f.fuero))) return false;
      if (f.domicilio && !norm((e.domiciliosRenglones || []).join(" ")).includes(norm(f.domicilio))) return false;
      if (f.zona !== "Todas" && e.zona !== f.zona) return false;
      if (f.tipo !== "Todos" && e.tipo !== f.tipo) return false;
      if (f.rol !== "Todos" && e.rol !== f.rol) return false;
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
  // el resto la deja vacía en vez de repetir el mismo texto.
  const filasConFuero = useMemo(() => {
    const ordenadas = [...filas].sort((a, b) => {
      const fa = (a.fuero || []).join(" · ");
      const fb = (b.fuero || []).join(" · ");
      if (fa !== fb) return fa.localeCompare(fb);
      return new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento);
    });
    return ordenadas.map((e, i) => {
      const fuero = (e.fuero || []).join(" · ");
      const esInicioGrupo = i === 0 || (ordenadas[i - 1].fuero || []).join(" · ") !== fuero;
      let span = 0;
      if (esInicioGrupo) {
        for (let j = i; j < ordenadas.length && (ordenadas[j].fuero || []).join(" · ") === fuero; j++) span++;
      }
      return { exp: e, fuero, esInicioGrupo, span };
    });
  }, [filas]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <span className="text-[11px] text-slate-500">{filas.length} de {base.length} expediente{base.length !== 1 ? "s" : ""}</span>
        {hayFiltros && (
          <button type="button" onClick={limpiar} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900">
            <X size={12} /> Limpiar filtros de la tabla
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[980px]">
          <thead>
            <tr className="text-left border-b border-slate-100 bg-slate-50/40">
              <th className="py-2 px-5 align-top">
                <input value={f.fuero} onChange={e => set("fuero", e.target.value)} placeholder="Fuero"
                  className="w-full text-xs font-normal border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-800 placeholder:text-slate-400" />
              </th>
              <th className="py-2 px-5 align-top">
                <input value={f.domicilio} onChange={e => set("domicilio", e.target.value)} placeholder="Domicilio"
                  className="w-full text-xs font-normal border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-800 placeholder:text-slate-400" />
              </th>
              <th className="py-2 px-5 align-top">
                <select value={f.zona} onChange={e => set("zona", e.target.value)}
                  className={selectClase(f.zona === "Todas")}>
                  <option value="Todas">Zona</option>
                  {ZONAS.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
              </th>
              <th className="py-2 px-5 align-top">
                <select value={f.tipo} onChange={e => set("tipo", e.target.value)}
                  className={selectClase(f.tipo === "Todos")}>
                  <option value="Todos">Tipo</option>
                  {TIPOS_SERVICIOS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </th>
              <th className="py-2 px-5 align-top">
                <input value={f.exp} onChange={e => set("exp", e.target.value)} placeholder="Expediente"
                  className="w-full text-xs font-normal border border-slate-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-800 placeholder:text-slate-400" />
              </th>
              <th className="py-2 px-5 align-top">
                <select value={f.rol} onChange={e => set("rol", e.target.value)}
                  className={selectClase(f.rol === "Todos")}>
                  <option value="Todos">Trámite</option>
                  <option value="vigente">{ROL_LABEL.vigente}</option>
                  <option value="parche">{ROL_LABEL.parche}</option>
                  <option value="renovacion">{ROL_LABEL.renovacion}</option>
                </select>
              </th>
              <th className="py-2 px-5 align-top">
                <span className="text-xs text-slate-400">Período</span>
              </th>
              <th className="py-2 px-5 align-top">
                <select value={f.sector} onChange={e => set("sector", e.target.value)}
                  className={selectClase(f.sector === "Todos")}>
                  <option value="Todos">Sector</option>
                  {SECTORES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
              <th className="py-2 px-5 align-top">
                <select value={f.estadoConvocatoria} onChange={e => set("estadoConvocatoria", e.target.value)}
                  className={selectClase(f.estadoConvocatoria === "Todos")}>
                  <option value="Todos">Estado de convocatoria</option>
                  {ESTADOS_CONVOCATORIA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </th>
              <th className="py-2 px-5 align-top">
                <select value={f.diasRestantes} onChange={e => set("diasRestantes", e.target.value)}
                  className={selectClase(f.diasRestantes === "Todos")}>
                  <option value="Todos">Días restantes</option>
                  {Object.keys(ALERTA_LABEL).map(n => <option key={n} value={n}>{ALERTA_LABEL[n]}</option>)}
                </select>
              </th>
              <th className="py-2 px-5 align-top">
                <select value={f.diasFrenado} onChange={e => set("diasFrenado", e.target.value)}
                  className={selectClase(f.diasFrenado === "Todos")}>
                  <option value="Todos">Días frenado</option>
                  <option value="sinFrenar">Sin frenar</option>
                  {NIVELES_FRENADO.map(n => <option key={n} value={n}>{ALERTA_LABEL[n]}</option>)}
                </select>
              </th>
            </tr>
          </thead>
          <tbody>
            {filasConFuero.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-sm text-slate-500">
                  No se encontraron expedientes con esos filtros.
                </td>
              </tr>
            ) : filasConFuero.map(({ exp: e, fuero, esInicioGrupo, span }) => {
              const yaCerrado = e.estadoGeneral === "Finalizado" || e.estadoGeneral === "Archivado";
              const dias = diasRestantes(e.fechaVencimiento);
              const niv = alerta(dias);
              const frenado = diasFrenado(e.observaciones, e.creadoEn);
              const domiciliosLista = e.domiciliosRenglones || [];
              const domicilio = domiciliosLista.join(" · ");
              // Compacto: se ve el primer domicilio + cuántos más hay, no la
              // lista entera — el detalle completo queda en el título
              // (tooltip) y es sobre eso que sigue filtrando la columna.
              const domicilioCompacto = domiciliosLista.length > 1
                ? domiciliosLista[0] + " +" + (domiciliosLista.length - 1) + " más"
                : (domiciliosLista[0] || "");
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
                  <td className="py-2.5 px-5 text-slate-600 max-w-[170px] truncate" title={domicilio}>{domicilioCompacto || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.zona || "-"}</td>
                  <td className="py-2.5 px-5 text-slate-600">{e.tipo}</td>
                  <td className="py-2.5 px-5">
                    <div className="font-mono text-xs font-semibold text-slate-900">{e.exp}</div>
                    {e.nombreCorto && <div className="text-[11px] text-slate-500">{e.nombreCorto}</div>}
                  </td>
                  <td className="py-2.5 px-5 text-slate-600">{rolTexto(e)}</td>
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
