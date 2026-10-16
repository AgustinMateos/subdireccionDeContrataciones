"use client";

import { useEffect, useState } from "react";
import { ArrowRight, AlertTriangle, CalendarClock, Clock, RefreshCw, Search, Star, UserX, Building2, Gavel, FileCheck, ShoppingCart, X } from "lucide-react";
import { ALERTA_ESTILO } from "@/lib/constants";
import { alertaDias, diasEnSector } from "@/lib/diasEnSector";
import { diasRestantes, fmtFecha } from "@/lib/utils";
import { esFinalizado, estaFueraDeResoluciones, esPrioritario, fechaISO, montoNumero } from "@/lib/resoluciones";
import { diasEnSectorLicitacion, esPrioritarioLicitacion, esTerminada, estaEnLicitaciones } from "@/lib/licitaciones";
import { ESTADOS_OBRA } from "@/lib/planObras";
import { FormularioResolucion, SOLAPAS as SOLAPAS_RESOLUCIONES } from "./PanelResoluciones";
import { FormularioLicitacion, SOLAPAS as SOLAPAS_LICITACIONES } from "./PanelLicitaciones";
import { FormularioOrdenCompra, SOLAPAS as SOLAPAS_ORDENES } from "./PanelOrdenesCompra";
import { DIAS_AVISO_VENCIMIENTO_OC, avanceOC, diasEnOC, esCompleta, esPrioritariaOC } from "@/lib/ordenesCompra";
import { expParaBuscar, mismoExp } from "@/lib/numeroExpediente";

const DIAS_DEMORA = 15; // más de esto, rojo en el semáforo de días en sector
const DIAS_POR_VENCER = 30;

const deSolapa = (lista, solapas, id) => lista.filter(solapas.find(s => s.id === id).incluye);

// Fila común de un expediente de cualquier departamento (modal y tabla
// de demorados). `vence`: vencimiento de ofertas o de la OC.
const OC = "Órdenes de Compra";
const itemResolucion = e => ({ e, area: "Resoluciones", dias: diasEnSector(e), sector: e.sectorActual, prioritario: esPrioritario(e), vence: fechaISO(e.vencOfertas) || null });
const itemLicitacion = e => ({ e, area: "Licitaciones", dias: diasEnSectorLicitacion(e), sector: e.sector, prioritario: esPrioritarioLicitacion(e), vence: null });
const itemOrdenCompra = e => ({
  e, area: OC, dias: diasEnOC(e), sector: e.pase || avanceOC(e).etapa, prioritario: esPrioritariaOC(e),
  vence: esCompleta(e) ? null : fechaISO(e.vencimientoOC) || null,
});
const fmtMonto = n => "$ " + Math.round(n).toLocaleString("es-AR");

function vencePronto(e) {
  const f = fechaISO(e.vencOfertas);
  if (!f) return false;
  const dias = diasRestantes(f);
  return dias >= 0 && dias <= DIAS_POR_VENCER;
}

// Carga una API de la Subdirección; cada bloque del Inicio se muestra
// apenas llega lo suyo (Licitaciones tarda más).
function useDatos(url, clave, version) {
  const [estado, setEstado] = useState({ datos: null, error: false });
  useEffect(() => {
    let activo = true;
    fetch(url)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(j => activo && setEstado({ datos: j[clave] || [], error: false }))
      .catch(() => activo && setEstado({ datos: null, error: true }));
    return () => { activo = false; };
  }, [url, clave, version]);
  // Reemplaza (o saca, con `null`) un expediente sin volver a cargar todo.
  const actualizar = (id, nuevo) => setEstado(prev => ({
    ...prev,
    datos: prev.datos && (nuevo ? prev.datos.map(x => (x.id === id ? nuevo : x)) : prev.datos.filter(x => x.id !== id)),
  }));
  return { ...estado, actualizar };
}

const API_AREA = { Resoluciones: "/api/resoluciones/", Licitaciones: "/api/licitaciones/", [OC]: "/api/ordenes-compra/" };

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

// Inicio de la jefa de la Subdirección: lo que necesita su atención en
// Resoluciones, Licitaciones, Órdenes de Compra y el Plan de Obras, con
// atajos a cada panel.
// `onIr(vista, solapa)` abre la sección en esa solapa.
export default function InicioSubdireccion({ onIr, mostrarToast }) {
  const [version, setVersion] = useState(0);
  const res = useDatos("/api/resoluciones", "expedientes", version);
  const lic = useDatos("/api/licitaciones", "expedientes", version);
  const ord = useDatos("/api/ordenes-compra", "expedientes", version);
  const obras = useDatos("/api/plan-obras", "obras", version);

  const R = res.datos, L = lic.datos;
  // Si Órdenes de Compra no responde, el resto del Inicio sigue igual.
  const O = ord.datos ?? (ord.error ? [] : null);
  const ordEnTramite = O?.filter(e => !esCompleta(e));
  const resEnTramite = R?.filter(e => !esFinalizado(e));
  const licEnTramite = L?.filter(e => !esTerminada(e));
  // Lista de expedientes que se abre al tocar una cifra.
  const [modal, setModal] = useState(null);
  // Ficha abierta: { area, id }. Es la misma del panel del departamento
  // (la jefa solo cambia agente y prioridad).
  const [ficha, setFicha] = useState(null);
  const fuente = { Resoluciones: res, Licitaciones: lic, [OC]: ord };
  const expFicha = ficha && fuente[ficha.area].datos?.find(e => e.id === ficha.id);
  async function guardarFicha(datos) {
    const data = await enviar(API_AREA[ficha.area] + ficha.id, "PUT", datos);
    if (data.error) return data;
    fuente[ficha.area].actualizar(ficha.id, data.expediente);
    setFicha(null);
    mostrarToast("Expediente actualizado");
  }
  async function eliminarFicha() {
    const data = await enviar(API_AREA[ficha.area] + ficha.id, "DELETE");
    if (data.error) { mostrarToast(data.error); return; }
    fuente[ficha.area].actualizar(ficha.id, null);
    setFicha(null);
    mostrarToast("Expediente eliminado");
  }
  const abrirFicha = (area, e) => setFicha({ area, id: e.id });
  const res_ = (id, lista = R && deSolapa(R, SOLAPAS_RESOLUCIONES, id)) => lista?.map(itemResolucion);
  const lic_ = (id, lista = L && deSolapa(L, SOLAPAS_LICITACIONES, id)) => lista?.map(itemLicitacion);
  const ord_ = (id, lista = O && deSolapa(O, SOLAPAS_ORDENES, id)) => lista?.map(itemOrdenCompra);

  // Demorados: en trámite y dentro del propio departamento, más de 15 días.
  const resDemorados = resEnTramite?.filter(e => !estaFueraDeResoluciones(e) && (diasEnSector(e) ?? 0) > DIAS_DEMORA);
  const licDemorados = licEnTramite?.filter(e => estaEnLicitaciones(e) && (diasEnSectorLicitacion(e) ?? 0) > DIAS_DEMORA);
  // En OC: sin pase a otro sector, más de 15 días desde el ingreso.
  const ordDemorados = ordEnTramite?.filter(e => !String(e.pase || "").trim() && (diasEnOC(e) ?? 0) > DIAS_DEMORA);

  const atencion = [
    {
      titulo: "Sin asignar", Icono: UserX, tono: "amber",
      detalle: "Expedientes en trámite sin agente",
      filas: [
        { area: "Resoluciones", items: res_("sinAsignar"), ir: () => onIr("expedientes", "sinAsignar") },
        { area: "Licitaciones", items: lic_("sinAsignar"), ir: () => onIr("licitaciones", "sinAsignar") },
        { area: OC, items: ord_("sinAsignar"), ir: () => onIr("ordenesCompra", "sinAsignar") },
      ],
    },
    {
      titulo: "Demorados", Icono: Clock, tono: "red",
      detalle: "Más de " + DIAS_DEMORA + " días sin movimiento en el departamento",
      filas: [
        { area: "Resoluciones", items: res_(null, resDemorados), ir: () => onIr("expedientes", "escritorio") },
        { area: "Licitaciones", items: lic_(null, licDemorados), ir: () => onIr("licitaciones", "enDepto") },
        { area: OC, items: ord_(null, ordDemorados), ir: () => onIr("ordenesCompra", "escritorio") },
      ],
    },
    {
      titulo: "Prioritarios en trámite", Icono: Star, tono: "slate",
      detalle: "Con estrella o en el Plan de Obras",
      filas: [
        { area: "Resoluciones", items: res_("prioritarios"), ir: () => onIr("expedientes", "prioritarios") },
        { area: "Licitaciones", items: lic_("prioritarios"), ir: () => onIr("licitaciones", "prioritarios") },
        { area: OC, items: ord_("prioritarios"), ir: () => onIr("ordenesCompra", "prioritarios") },
      ],
    },
    {
      titulo: "Vencimientos", Icono: CalendarClock, tono: "red",
      detalle: "Ofertas en " + DIAS_POR_VENCER + " días · OC vencidas o en " + DIAS_AVISO_VENCIMIENTO_OC,
      filas: [
        { area: "Resoluciones", items: res_(null, resEnTramite?.filter(vencePronto)), ir: () => onIr("expedientes", "escritorio") },
        { area: OC, items: ord_("porVencer"), ir: () => onIr("ordenesCompra", "porVencer") },
      ],
      vencimientos: true,
    },
  ];

  const hoy = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-6 ">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Resumen de la Subdirección</h1>
          <p className="text-xs text-slate-500 first-letter:uppercase">{hoy}</p>
        </div>
        <button type="button" onClick={() => setVersion(v => v + 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50">
          <RefreshCw size={13} /> Actualizar
        </button>
      </div>

      <Bloque titulo="Requiere atención">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {atencion.map(a => (
            <TarjetaAtencion key={a.titulo} {...a}
              onAbrir={filas => setModal({
                titulo: a.titulo + (filas.length === 1 && a.filas.length > 1 ? " · " + filas[0].area : ""),
                detalle: a.detalle, vencimientos: a.vencimientos,
                items: filas.flatMap(f => f.items),
                ir: filas.length === 1 ? filas[0].ir : null,
              })} />
          ))}
        </div>
      </Bloque>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TarjetaDepartamento
          titulo="Resoluciones" Icono={FileCheck} error={res.error} lista={R}
          onPanel={() => onIr("expedientes")}
          cifras={R && [
            { etiqueta: "En trámite", items: res_("escritorio"), ir: () => onIr("expedientes", "escritorio") },
            { etiqueta: "Para adjudicar", items: res_("adjudicar"), ir: () => onIr("expedientes", "adjudicar") },
            { etiqueta: "Fuera del depto.", items: res_("fuera"), ir: () => onIr("expedientes", "fuera") },
            { etiqueta: "Finalizados", items: res_("finalizados"), ir: () => onIr("expedientes", "finalizados") },
          ]}
          carga={resEnTramite}
          onAbrir={c => setModal({ titulo: "Resoluciones · " + c.etiqueta, items: c.items, ir: c.ir })}
        />
        <TarjetaDepartamento
          titulo="Licitaciones" Icono={Gavel} error={lic.error} lista={L}
          onPanel={() => onIr("licitaciones")}
          cifras={L && [
            { etiqueta: "En trámite", items: lic_("escritorio"), ir: () => onIr("licitaciones", "escritorio") },
            { etiqueta: "En el depto.", items: lic_("enDepto"), ir: () => onIr("licitaciones", "enDepto") },
            { etiqueta: "Fuera del depto.", items: lic_("fuera"), ir: () => onIr("licitaciones", "fuera") },
            { etiqueta: "Concluidos y archivados", items: lic_("terminados"), ir: () => onIr("licitaciones", "terminados") },
          ]}
          carga={licEnTramite}
          onAbrir={c => setModal({ titulo: "Licitaciones · " + c.etiqueta, items: c.items, ir: c.ir })}
        />
        <TarjetaDepartamento
          titulo={OC} Icono={ShoppingCart} error={ord.error} lista={ord.datos} className="xl:col-span-2"
          onPanel={() => onIr("ordenesCompra")}
          cifras={ord.datos && [
            { etiqueta: "En trámite", items: ord_("escritorio"), ir: () => onIr("ordenesCompra", "escritorio") },
            { etiqueta: "Vencidas y por vencer", items: ord_("porVencer"), ir: () => onIr("ordenesCompra", "porVencer") },
            { etiqueta: "Sin pase (en el depto.)", items: ord_(null, ordEnTramite.filter(e => !String(e.pase || "").trim())), ir: () => onIr("ordenesCompra", "escritorio") },
            { etiqueta: "Completas", items: ord_("completas"), ir: () => onIr("ordenesCompra", "completas") },
          ]}
          carga={ordEnTramite}
          onAbrir={c => setModal({ titulo: OC + " · " + c.etiqueta, items: c.items, ir: c.ir, vencimientos: c.etiqueta.startsWith("Vencidas") })}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-2">
          <TarjetaPlanObras obras={obras.datos} error={obras.error} onPanel={() => onIr("planObras")} />
        </div>
        <div className="xl:col-span-3">
          <TablaDemorados
            filas={resDemorados && licDemorados && [
              ...resDemorados.map(e => ({ ...itemResolucion(e), ir: () => abrirFicha("Resoluciones", e) })),
              ...licDemorados.map(e => ({ ...itemLicitacion(e), ir: () => abrirFicha("Licitaciones", e) })),
              ...(ordDemorados || []).map(e => ({ ...itemOrdenCompra(e), ir: () => abrirFicha(OC, e) })),
            ].sort((a, b) => b.dias - a.dias).slice(0, 8)}
            cargando={!R || !L || !O}
          />
        </div>
      </div>

      {modal && (
        <ModalExpedientes {...modal} onCerrar={() => setModal(null)} onFicha={abrirFicha} fichaAbierta={!!expFicha}
          onIr={modal.ir && (() => { setModal(null); modal.ir(); })} />
      )}

      {expFicha && ficha.area === "Resoluciones" && (
        <FormularioResolucion key={ficha.id} inicial={expFicha} esJefa expedientes={R} onCerrar={() => setFicha(null)} onGuardar={guardarFicha} onEliminar={eliminarFicha} />
      )}
      {expFicha && ficha.area === OC && (
        <FormularioOrdenCompra key={ficha.id} inicial={expFicha} esJefa onCerrar={() => setFicha(null)} onGuardar={guardarFicha} onEliminar={eliminarFicha} />
      )}
      {expFicha && ficha.area === "Licitaciones" && (
        <FormularioLicitacion key={ficha.id} inicial={expFicha} esJefa onCerrar={() => setFicha(null)} onGuardar={guardarFicha} onEliminar={eliminarFicha} />
      )}
    </div>
  );
}

function Bloque({ titulo, children }) {
  return (
    <section className="space-y-2.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{titulo}</h2>
      {children}
    </section>
  );
}

function Cifra({ valor }) {
  if (valor == null) return <span className="inline-block w-6 h-4 rounded bg-slate-100 animate-pulse align-middle" />;
  return <span className="tabular-nums">{valor}</span>;
}

const TONOS = {
  amber: { icono: "bg-amber-50 text-amber-700", valor: "text-amber-700" },
  red: { icono: "bg-red-50 text-red-700", valor: "text-red-700" },
  slate: { icono: "bg-slate-100 text-slate-700", valor: "text-slate-900" },
};

function TarjetaAtencion({ titulo, detalle, Icono, tono, filas, onAbrir }) {
  const t = TONOS[tono];
  const listo = filas.every(f => f.items);
  const total = listo ? filas.reduce((s, f) => s + f.items.length, 0) : null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
      <div role="button" tabIndex={0} title="Ver todos" onClick={() => listo && onAbrir(filas)}
        onKeyDown={ev => ev.key === "Enter" && listo && onAbrir(filas)}
        className="flex items-start justify-between gap-3 cursor-pointer rounded-md -m-1 p-1 hover:bg-slate-50">
        <div>
          <div className="text-xs font-medium text-slate-600">{titulo}</div>
          <div className={"mt-1 text-2xl font-semibold " + (total ? t.valor : "text-slate-300")}><Cifra valor={total} /></div>
        </div>
        <span className={"w-8 h-8 rounded-lg flex items-center justify-center " + t.icono}><Icono size={16} /></span>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{detalle}</p>
      <div className="mt-3 pt-2 border-t border-slate-100 space-y-0.5 mt-auto">
        {filas.map(f => (
          <button key={f.area} type="button" onClick={() => onAbrir([f])} disabled={!f.items}
            className="group w-full flex items-center justify-between rounded-md px-1.5 py-1 -mx-1.5 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900">
            <span>{f.area}</span>
            <span className="flex items-center gap-1.5 font-medium text-slate-900">
              <Cifra valor={f.items?.length} />
              <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-600" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EncabezadoTarjeta({ titulo, Icono, onPanel, accion = "Abrir panel" }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icono size={15} className="text-slate-400" /> {titulo}
      </h3>
      <button type="button" onClick={onPanel} className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900">
        {accion} <ArrowRight size={13} />
      </button>
    </div>
  );
}

function ErrorCarga() {
  return (
    <div className="px-5 py-8 text-center text-xs text-red-600 flex items-center justify-center gap-1.5">
      <AlertTriangle size={14} /> No se pudieron cargar los datos.
    </div>
  );
}

// Cifras del departamento y carga en trámite por agente (dentro y fuera
// del departamento).
function TarjetaDepartamento({ titulo, Icono, error, lista, cifras, carga, onPanel, onAbrir, className = "" }) {
  const porAgente = carga
    ? Object.entries(carga.reduce((m, e) => {
        const a = String(e.agente || "").trim() || "Sin asignar";
        m[a] = (m[a] || 0) + 1;
        return m;
      }, {})).sort((a, b) => (a[0] === "Sin asignar") - (b[0] === "Sin asignar") || b[1] - a[1])
    : null;
  const max = porAgente ? Math.max(1, ...porAgente.map(([, n]) => n)) : 1;

  return (
    <div className={"bg-white border border-slate-200 rounded-xl " + className}>
      <EncabezadoTarjeta titulo={titulo} Icono={Icono} onPanel={onPanel} />
      {error ? <ErrorCarga /> : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-slate-100">
            {(cifras || Array.from({ length: 4 }, (_, i) => ({ etiqueta: " ", valor: null, key: i }))).map((c, i) => (
              <button key={c.etiqueta + i} type="button" onClick={() => onAbrir(c)} disabled={!c.items}
                className={"text-left px-5 py-3 hover:bg-slate-50 disabled:hover:bg-transparent " + (i ? "sm:border-l border-slate-100" : "")}>
                <div className="text-[11px] text-slate-500 truncate">{c.etiqueta}</div>
                <div className="mt-0.5 text-xl font-semibold text-slate-900"><Cifra valor={c.items?.length ?? null} /></div>
              </button>
            ))}
          </div>
          <div className="px-5 py-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-2.5">Carga por agente · en trámite</div>
            {!porAgente ? (
              <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-3 rounded bg-slate-100 animate-pulse" />)}</div>
            ) : porAgente.length === 0 ? (
              <p className="text-xs text-slate-400">No hay expedientes en trámite.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                {porAgente.map(([a, n]) => (
                  <div key={a} className="flex items-center gap-2 text-xs">
                    <span className={"w-20 truncate " + (a === "Sin asignar" ? "text-amber-700 font-medium" : "text-slate-700")}>{a}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={"h-full rounded-full " + (a === "Sin asignar" ? "bg-amber-400" : "bg-slate-700")} style={{ width: (n / max) * 100 + "%" }} />
                    </div>
                    <span className="w-8 text-right tabular-nums font-medium text-slate-900">{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {lista && lista.length === 0 && !error && <p className="px-5 pb-4 text-xs text-slate-400">Todavía no hay expedientes cargados.</p>}
    </div>
  );
}

// Obras del plan por etapa, en el orden del circuito.
function TarjetaPlanObras({ obras, error, onPanel }) {
  const etapas = obras
    ? [...ESTADOS_OBRA, ...new Set(obras.map(o => o.estado || "Sin estado").filter(s => !ESTADOS_OBRA.includes(s)))]
        .map(s => [s, obras.filter(o => (o.estado || "Sin estado") === s).length])
        .filter(([, n]) => n)
    : null;
  const max = etapas ? Math.max(1, ...etapas.map(([, n]) => n)) : 1;
  const montoTotal = obras ? obras.reduce((s, o) => s + (montoNumero(o.monto) || 0), 0) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl h-full">
      <EncabezadoTarjeta titulo="Plan de Obras 2026" Icono={Building2} onPanel={onPanel} />
      {error ? <ErrorCarga /> : (
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Obras</div>
              <div className="mt-0.5 text-xl font-semibold text-slate-900"><Cifra valor={obras?.length} /></div>
            </div>
            <div>
              <div className="text-[11px] text-slate-500">Monto estimado</div>
              <div className="mt-0.5 text-xl font-semibold text-slate-900 truncate">{montoTotal == null ? <Cifra valor={null} /> : fmtMonto(montoTotal)}</div>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 mb-2">Por etapa</div>
            {!etapas ? (
              <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-3 rounded bg-slate-100 animate-pulse" />)}</div>
            ) : (
              <div className="space-y-1.5">
                {etapas.map(([s, n]) => (
                  <div key={s} className="text-xs">
                    <div className="flex justify-between gap-2 text-slate-700">
                      <span className="truncate" title={s}>{s}</span>
                      <span className="tabular-nums font-medium text-slate-900">{n}</span>
                    </div>
                    <div className="mt-0.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-slate-700" style={{ width: (n / max) * 100 + "%" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TablaDemorados({ filas, cargando }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl h-full">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Clock size={15} className="text-slate-400" /> Más tiempo sin movimiento
        </h3>
        <p className="text-[11px] text-slate-500 mt-0.5">En trámite dentro de cada departamento, más de {DIAS_DEMORA} días</p>
      </div>
      {cargando ? (
        <div className="p-5 space-y-3">{[0, 1, 2, 3, 4].map(i => <div key={i} className="h-4 rounded bg-slate-100 animate-pulse" />)}</div>
      ) : filas.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-slate-400">No hay expedientes demorados.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-5 py-2 font-medium">Exp.</th>
                <th className="px-3 py-2 font-medium">Objeto</th>
                <th className="px-3 py-2 font-medium">Área</th>
                <th className="px-3 py-2 font-medium">Agente</th>
                <th className="px-5 py-2 font-medium text-right">Días</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ e, area, dias, prioritario, ir }) => (
                <tr key={area + e.id} onClick={ir} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 cursor-pointer">
                  <td className="px-5 py-2 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {prioritario && <Star size={11} className="inline -mt-0.5 mr-1 fill-amber-400 text-amber-400" />}<span className="inline-block max-w-[190px] whitespace-normal break-words align-top" title={e.exp}>{e.exp}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-[260px] truncate" title={e.objeto}>{e.objeto}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{area}</td>
                  <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{e.agente || <span className="text-amber-700">Sin asignar</span>}</td>
                  <td className="px-5 py-2 text-right">
                    <span className={"inline-block px-1.5 py-0.5 rounded border text-[11px] font-medium tabular-nums " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} días</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Lista de expedientes detrás de una cifra del Inicio: búsqueda, días en
// sector (o vencimiento de ofertas) y atajo al panel del departamento.
function ModalExpedientes({ titulo, detalle, items, vencimientos, onCerrar, onIr, onFicha, fichaAbierta }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    // Con la ficha abierta encima, Esc no cierra la lista.
    const cerrar = ev => ev.key === "Escape" && !fichaAbierta && onCerrar();
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onCerrar, fichaAbierta]);

  const variasAreas = new Set(items.map(i => i.area)).size > 1;
  const norm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filas = items
    .filter(({ e, sector }) => !q || norm([e.exp, e.objeto, e.agente, sector, e.organismo, e.jurisdiccion, e.fuero].join(" ")).includes(norm(expParaBuscar(q))))
    .sort(vencimientos
      ? (a, b) => String(a.vence || "9999").localeCompare(String(b.vence || "9999"))
      : (a, b) => (b.dias ?? -1) - (a.dias ?? -1));

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/40 flex items-start justify-center p-4 sm:p-8 overflow-y-auto" onClick={onCerrar}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl flex flex-col max-h-[calc(100vh-4rem)]" onClick={ev => ev.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {items.length} {items.length === 1 ? "expediente" : "expedientes"}{detalle ? " · " + detalle : ""}
            </p>
          </div>
          <button type="button" onClick={onCerrar} title="Cerrar" className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X size={16} /></button>
        </div>

        {items.length > 0 && (
          <div className="px-6 py-3 border-b border-slate-100">
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus value={q} onChange={ev => setQ(ev.target.value)} placeholder="Buscar por expediente, objeto, agente o sector"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-300" />
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          {filas.length === 0 ? (
            <p className="px-6 py-10 text-center text-xs text-slate-400">{items.length ? "Ningún expediente coincide con la búsqueda." : "No hay expedientes."}</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <th className="px-6 py-2 font-medium">Exp.</th>
                  <th className="px-3 py-2 font-medium">Objeto</th>
                  {variasAreas && <th className="px-3 py-2 font-medium">Área</th>}
                  <th className="px-3 py-2 font-medium">Sector</th>
                  <th className="px-3 py-2 font-medium">Agente</th>
                  <th className="px-6 py-2 font-medium text-right whitespace-nowrap">{vencimientos ? "Vencimiento" : "Días en sector"}</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ e, area, dias, sector, prioritario, vence }) => (
                  <tr key={area + e.id} onClick={() => onFicha(area, e)} title="Abrir la ficha"
                    className="border-b border-slate-100 last:border-0 align-top cursor-pointer hover:bg-slate-50">
                    <td className="px-6 py-2 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {prioritario && <Star size={11} className="inline -mt-0.5 mr-1 fill-amber-400 text-amber-400" />}<span className="inline-block max-w-[190px] whitespace-normal break-words align-top" title={e.exp}>{e.exp}</span>
                    </td>
                    <td className="px-3 py-2 text-slate-700 min-w-[240px]">
                      <div className="line-clamp-2" title={e.objeto}>{e.objeto}</div>
                      {(e.proveedor || e.organismo || e.jurisdiccion || e.fuero) && (
                        <div className="text-[11px] text-slate-400 truncate max-w-[380px]">
                          {e.proveedor ? [e.numeroOC && "OC " + e.numeroOC, e.proveedor].filter(Boolean).join(" · ") : e.organismo || e.jurisdiccion || e.fuero}
                        </div>
                      )}
                    </td>
                    {variasAreas && <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{area}</td>}
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{sector || "-"}</td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{e.agente || <span className="text-amber-700">Sin asignar</span>}</td>
                    <td className="px-6 py-2 text-right whitespace-nowrap">
                      {vencimientos ? (
                        <span className="tabular-nums text-slate-700">
                          {vence ? fmtFecha(vence) : "-"}
                          {vence && <span className="ml-1.5 text-red-700 font-medium">({diasRestantes(vence) < 0 ? "vencida" : diasRestantes(vence) + " d"})</span>}
                        </span>
                      ) : dias == null ? <span className="text-slate-300">-</span> : (
                        <span className={"inline-block px-1.5 py-0.5 rounded border text-[11px] font-medium tabular-nums " + ALERTA_ESTILO[alertaDias(dias)]}>{dias} días</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/60 flex items-center justify-end gap-2 rounded-b-xl">
          <button type="button" onClick={onCerrar} className="px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50">Cerrar</button>
          {onIr && (
            <button type="button" onClick={onIr} className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              Ver en el panel <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
