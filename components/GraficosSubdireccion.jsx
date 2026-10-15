"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X, FileCheck, Gavel, ShoppingCart } from "lucide-react";
import { ALERTA_ESTILO } from "@/lib/constants";
import { alertaDias, diasEnSector } from "@/lib/diasEnSector";
import { diasRestantes, fmtFecha } from "@/lib/utils";
import {
  AGENTES_RESOLUCIONES, TIPOS_CONTRATACION_RESOLUCIONES, TIPOS_RESOLUCION, esCompletado, esPrioritario,
  estaFueraDeResoluciones, fechaISO, montoNumero,
} from "@/lib/resoluciones";
import {
  AGENTES_LICITACIONES, ENCUADRES_LICITACIONES, ESTADOS_CONVOCATORIA_LICITACIONES, diasEnSectorLicitacion,
  esPrioritarioLicitacion, esTerminada, estaEnLicitaciones,
} from "@/lib/licitaciones";
import {
  AGENTES_ORDENES_COMPRA, DIAS_AVISO_VENCIMIENTO_OC, ETAPAS_ORDEN_COMPRA, TIPOS_ORDEN_COMPRA, diasEnOC, esCompleta,
  esPrioritariaOC, etapaOC,
} from "@/lib/ordenesCompra";
import EstrellaPrioridad from "./EstrellaPrioridad";

// Análisis de gestión de la jefa de la Subdirección: los mismos análisis
// para Resoluciones y Licitaciones. Cada departamento se describe con
// DEPTOS (de dónde vienen los datos y qué campo es cada cosa) y el resto
// trabaja sobre esa forma común (ver `normalizar`).

const SIN_ASIGNAR = "Sin asignar";
const DIAS_DEMORA = 15;

// Fecha tipeada en una columna de texto ("30/01/2026", "9-1-26 KARI"):
// la primera d/m/aa(aa) que aparezca, o null.
function fechaDeTexto(t) {
  const m = String(t || "").match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})/);
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3].length === 2 ? "20" + m[3] : m[3])];
  return mes >= 1 && mes <= 12 && d >= 1 && d <= 31 ? a + "-" + String(mes).padStart(2, "0") + "-" + String(d).padStart(2, "0") : null;
}
const MESES = 12;

const DEPTOS = {
  resoluciones: {
    nombre: "Resoluciones", Icono: FileCheck, api: "/api/resoluciones", agentes: AGENTES_RESOLUCIONES,
    etapa: { titulo: "Por tipo de resolución", orden: TIPOS_RESOLUCION },
    encuadre: { titulo: "Por tipo de contratación", orden: TIPOS_CONTRATACION_RESOLUCIONES },
    origen: "Por fuero",
    terminados: "Completados",
    vencimiento: { etiqueta: "Vencen ofertas", columna: "Venc. ofertas", dias: 30, conVencidos: false },
    // Entradas y salidas por mes.
    series: [
      { clave: "entradas", etiqueta: "Ingresos al sector", fecha: e => e.fechaIngreso },
      { clave: "salidas", etiqueta: "Completados", fecha: e => (esCompletado(e) ? e.fechaUltimoMov : null) },
    ],
    normalizar: e => ({
      e, terminado: esCompletado(e), enDepto: !estaFueraDeResoluciones(e), dias: diasEnSector(e),
      sector: texto(e.sectorActual, "Sin sector"), prioritario: esPrioritario(e),
      etapa: texto(e.tipoResolucion, "Sin tipo"), encuadre: texto(e.tipoContratacion, "Sin tipo"),
      origen: texto(e.fuero, "Sin fuero"), detalle: e.organismo || e.fuero, monto: montoNumero(e.montos),
      vence: fechaISO(e.vencOfertas) || null,
    }),
  },
  licitaciones: {
    nombre: "Licitaciones", Icono: Gavel, api: "/api/licitaciones", agentes: AGENTES_LICITACIONES,
    etapa: { titulo: "Por estado de la convocatoria", orden: ESTADOS_CONVOCATORIA_LICITACIONES },
    encuadre: { titulo: "Por encuadre", orden: ENCUADRES_LICITACIONES },
    origen: "Por jurisdicción",
    terminados: "Concluidos y archivados",
    vencimiento: null,
    series: [
      { clave: "entradas", etiqueta: "Pases a la firma", fecha: e => e.paseFirma },
      { clave: "salidas", etiqueta: "Concluidos y archivados", fecha: e => (esTerminada(e) ? e.fechaUltimoMov : null) },
    ],
    normalizar: e => ({
      e, terminado: esTerminada(e), enDepto: estaEnLicitaciones(e), dias: diasEnSectorLicitacion(e),
      sector: texto(e.sector, "Sin sector"), prioritario: esPrioritarioLicitacion(e),
      etapa: texto(e.estadoConvocatoria, "Sin estado"), encuadre: texto(e.encuadre, "Sin encuadre"),
      origen: texto(e.jurisdiccion, "Sin jurisdicción"), detalle: e.organismo || e.jurisdiccion, monto: montoNumero(e.monto),
      vence: null,
    }),
  },
  ordenesCompra: {
    nombre: "Órdenes de Compra", Icono: ShoppingCart, api: "/api/ordenes-compra", agentes: AGENTES_ORDENES_COMPRA,
    etapa: { titulo: "Por etapa del circuito", orden: ETAPAS_ORDEN_COMPRA },
    encuadre: { titulo: "Provisión / servicio", orden: TIPOS_ORDEN_COMPRA },
    origen: "Por organismo",
    terminados: "Completas",
    vencimiento: { etiqueta: "OC vencidas o por vencer", columna: "Venc. OC", dias: DIAS_AVISO_VENCIMIENTO_OC, conVencidos: true },
    series: [
      { clave: "entradas", etiqueta: "Ingresos a OC", fecha: e => e.ingresoOC },
      { clave: "salidas", etiqueta: "Completas (notificadas)", fecha: e => (esCompleta(e) ? fechaDeTexto(e.notificada) : null) },
    ],
    // En el departamento hasta que tiene pase a otro sector.
    normalizar: e => ({
      e, terminado: esCompleta(e), enDepto: !String(e.pase || "").trim(), dias: diasEnOC(e),
      sector: texto(e.pase, "Órdenes de Compra"), prioritario: esPrioritariaOC(e),
      etapa: etapaOC(e), encuadre: texto(e.tipo, "Sin tipo"), origen: texto(e.organismo, "Sin organismo"),
      detalle: [e.numeroOC && "OC " + e.numeroOC, e.proveedor].filter(Boolean).join(" · ") || e.organismo,
      monto: montoNumero(e.montoAjustado) ?? montoNumero(e.montoResolucion),
      vence: esCompleta(e) ? null : fechaISO(e.vencimientoOC) || null,
    }),
  },
};

// Si el vencimiento (de ofertas o de la OC) cae dentro del aviso del
// departamento; en OC también cuentan las ya vencidas.
function venceDentro(cfg, i) {
  if (!cfg.vencimiento || !i.vence) return false;
  const d = diasRestantes(i.vence);
  return d <= cfg.vencimiento.dias && (cfg.vencimiento.conVencidos || d >= 0);
}

const VISTAS = [
  { id: "panorama", etiqueta: "Panorama" },
  { id: "agentes", etiqueta: "Agentes" },
  { id: "tiempos", etiqueta: "Tiempos y sectores" },
];

// Colores: dos series fijas (en el departamento / fuera) y la paleta
// categórica en orden fijo; el número va siempre escrito al lado.
const COLOR_EN = "#2a78d6";
const COLOR_FUERA = "#eb6834";
const COLOR_SALIDAS = "#1baf7a";
const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const GRIS = "#94a3b8";

// Antigüedad en el sector actual.
const TRAMOS = [
  { clave: "0-10", etiqueta: "0–10", hasta: 10, alerta: "verde" },
  { clave: "11-15", etiqueta: "11–15", hasta: 15, alerta: "amarillo" },
  { clave: "16-30", etiqueta: "16–30", hasta: 30, alerta: "rojo" },
  { clave: "31-60", etiqueta: "31–60", hasta: 60, alerta: "rojo" },
  { clave: "61-90", etiqueta: "61–90", hasta: 90, alerta: "rojo" },
  { clave: "+90", etiqueta: "Más de 90", hasta: Infinity, alerta: "rojo" },
];
const tramoDe = dias => (dias == null ? null : TRAMOS.find(t => dias <= t.hasta).clave);

function texto(v, vacio) {
  return String(v ?? "").trim() || vacio;
}
const agenteDe = i => texto(i.e.agente, SIN_ASIGNAR);
const fmtMonto = n => "$ " + Math.round(n).toLocaleString("es-AR");
const fmtMontoCorto = n =>
  n >= 1e9 ? "$ " + (n / 1e9).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " mil M"
    : n >= 1e6 ? "$ " + (n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M"
      : fmtMonto(n);
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0) + "%";

function promedio(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
function mediana(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const redondo = n => (n == null ? "-" : Math.round(n));

// Cantidad por grupo con suma de montos legibles; `orden` pone primero los
// de la lista en su orden, después el resto por cantidad.
function agrupar(items, de, orden) {
  const m = new Map();
  for (const i of items) {
    const clave = de(i);
    const g = m.get(clave) || { clave, valor: 0, monto: 0, sinMonto: 0 };
    g.valor++;
    if (i.monto == null) g.sinMonto++;
    else g.monto += i.monto;
    m.set(clave, g);
  }
  const pos = c => (orden && orden.includes(c) ? orden.indexOf(c) : Infinity);
  return [...m.values()].sort((a, b) => pos(a.clave) - pos(b.clave) || b.valor - a.valor || a.clave.localeCompare(b.clave));
}

// Últimos MESES meses hasta el actual: "2026-10" → etiqueta "oct 26".
function ultimosMeses() {
  const hoy = new Date();
  return Array.from({ length: MESES }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (MESES - 1 - i), 1);
    const clave = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    return { clave, etiqueta: d.toLocaleDateString("es-AR", { month: "short" }).replace(".", "") + " " + String(d.getFullYear()).slice(2) };
  });
}

export default function GraficosSubdireccion({ mostrarToast }) {
  const [depto, setDepto] = useState("resoluciones");
  const [vista, setVista] = useState("panorama");
  const [soloPrioritarios, setSoloPrioritarios] = useState(false);
  const [datos, setDatos] = useState({}); // { resoluciones: [...], licitaciones: [...] }
  // Lista abierta en la ventana: { titulo, subtitulo, filtro(item) }. Se
  // recalcula con los datos, así una reasignación se ve al instante.
  const [modal, setModal] = useState(null);

  const cfg = DEPTOS[depto];

  useEffect(() => {
    if (datos[depto]) return;
    let vivo = true;
    (async () => {
      try {
        const res = await fetch(cfg.api);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Error del servidor (" + res.status + "). Probá recargar la página.");
        if (vivo) setDatos(d => ({ ...d, [depto]: data.expedientes || [] }));
      } catch (err) {
        if (vivo) { setDatos(d => ({ ...d, [depto]: [] })); mostrarToast(err.message); }
      }
    })();
    return () => { vivo = false; };
    // mostrarToast del Dashboard cambia en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depto, datos[depto], cfg.api]);

  const items = useMemo(() => (datos[depto] || []).map(cfg.normalizar), [datos, depto, cfg]);
  const base = useMemo(() => (soloPrioritarios ? items.filter(i => i.prioritario) : items), [items, soloPrioritarios]);
  const enTramite = useMemo(() => base.filter(i => !i.terminado), [base]);

  // Reasignación y prioridad (la API solo se las permite a la jefa). Se
  // muestra al instante; si el servidor lo rechaza, se vuelve atrás.
  async function cambiar(e, cambios, mensaje) {
    const d = depto;
    const anteriores = Object.fromEntries(Object.keys(cambios).map(k => [k, e[k]]));
    const aplicar = (id, valores) => setDatos(prev => ({ ...prev, [d]: prev[d].map(x => (x.id === id ? { ...x, ...valores } : x)) }));
    aplicar(e.id, cambios);
    let res, data;
    try {
      res = await fetch(DEPTOS[d].api + "/" + e.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cambios) });
      data = await res.json().catch(() => ({}));
    } catch {
      res = { ok: false };
      data = { error: "Sin conexión: no se guardó el cambio" };
    }
    if (!res.ok) {
      aplicar(e.id, anteriores);
      mostrarToast(data.error || "No se pudo guardar el cambio");
      return;
    }
    aplicar(data.expediente.id, data.expediente);
    mostrarToast(mensaje);
  }
  const acciones = {
    reasignar: (e, agente) => cambiar(e, { agente: agente || null }, e.exp + " asignado a " + (agente || "nadie")),
    prioridad: e => cambiar(e, { prioritario: !e.prioritario }, e.exp + (e.prioritario ? " ya no es prioritario" : " marcado como prioritario")),
  };
  const agentes = [...new Set([...cfg.agentes, ...items.map(i => String(i.e.agente || "").trim()).filter(Boolean)])];
  const abrir = (titulo, subtitulo, filtro, universo = "tramite") => setModal({ titulo, subtitulo, filtro, universo });

  const cargando = !datos[depto];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Análisis de gestión</h1>
          <p className="text-xs text-slate-500">
            {cfg.nombre} · {soloPrioritarios ? "solo prioritarios" : "todos los expedientes"} · tocá cualquier barra o cifra para ver los expedientes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmentado
            opciones={Object.entries(DEPTOS).map(([id, d]) => ({ id, etiqueta: d.nombre, Icono: d.Icono }))}
            valor={depto} onChange={id => { setDepto(id); setModal(null); }} />
          <Segmentado
            opciones={[{ id: "todos", etiqueta: "Todos" }, { id: "prioritarios", etiqueta: "Prioritarios" }]}
            valor={soloPrioritarios ? "prioritarios" : "todos"} onChange={id => setSoloPrioritarios(id === "prioritarios")} />
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200">
        {VISTAS.map(v => (
          <button key={v.id} type="button" onClick={() => setVista(v.id)}
            className={"px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors " +
              (vista === v.id ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {v.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-24 rounded-xl bg-white border border-slate-200 animate-pulse" />)}
          <div className="col-span-full h-72 rounded-xl bg-white border border-slate-200 animate-pulse" />
        </div>
      ) : base.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-12 text-center text-sm text-slate-500">
          {soloPrioritarios ? "No hay expedientes prioritarios." : "Todavía no hay expedientes cargados."}
        </div>
      ) : vista === "panorama" ? (
        <Panorama cfg={cfg} base={base} enTramite={enTramite} soloPrioritarios={soloPrioritarios} abrir={abrir} />
      ) : vista === "agentes" ? (
        <Agentes cfg={cfg} base={base} enTramite={enTramite} agentes={agentes} acciones={acciones} abrir={abrir} />
      ) : (
        <Tiempos cfg={cfg} enTramite={enTramite} abrir={abrir} />
      )}

      {modal && (
        <ModalLista
          titulo={modal.titulo} subtitulo={modal.subtitulo} cfg={cfg} agentes={agentes} acciones={acciones}
          items={(modal.universo === "todos" ? base : enTramite).filter(modal.filtro)}
          onCerrar={() => setModal(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Panorama

function Panorama({ cfg, base, enTramite, soloPrioritarios, abrir }) {
  const conDias = enTramite.map(i => i.dias).filter(d => d != null);
  const demorados = enTramite.filter(i => (i.dias ?? 0) > DIAS_DEMORA);
  const enDepto = enTramite.filter(i => i.enDepto);
  const sinAgente = enTramite.filter(i => agenteDe(i) === SIN_ASIGNAR);
  const conMonto = enTramite.filter(i => i.monto != null);
  const montoTotal = conMonto.reduce((s, i) => s + i.monto, 0);
  const vencen = enTramite.filter(i => venceDentro(cfg, i));

  const meses = ultimosMeses();
  const porMes = cfg.series.map(s => {
    const c = {};
    for (const i of base) {
      const f = fechaISO(s.fecha(i.e));
      if (f) c[f.slice(0, 7)] = (c[f.slice(0, 7)] || 0) + 1;
    }
    return { ...s, valores: meses.map(m => c[m.clave] || 0) };
  });
  const enRango = s => s.valores.reduce((a, b) => a + b, 0);

  const etapas = agrupar(enTramite, i => i.etapa, cfg.etapa.orden);
  const encuadres = agrupar(enTramite, i => i.encuadre, cfg.encuadre.orden);
  const origenes = agrupar(enTramite, i => i.origen).sort((a, b) => b.valor - a.valor);
  const prioridad = agrupar(enTramite, i => (i.e.prioritario && i.e.enPlanObras ? "Estrella y Plan de Obras" : i.e.prioritario ? "Con estrella" : "Plan de Obras"),
    ["Con estrella", "Plan de Obras", "Estrella y Plan de Obras"]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi etiqueta="En trámite" valor={enTramite.length} detalle={enDepto.length + " en el depto. · " + (enTramite.length - enDepto.length) + " fuera"}
          onClick={() => abrir("En trámite", null, () => true)} />
        <Kpi etiqueta="Días en sector · promedio" valor={redondo(promedio(conDias))} detalle={"mediana " + redondo(mediana(conDias)) + " días"} />
        <Kpi etiqueta={"Demorados · +" + DIAS_DEMORA + " días"} valor={demorados.length} detalle={pct(demorados.length, enTramite.length) + " de lo en trámite"}
          tono={demorados.length ? "rojo" : null} onClick={() => abrir("Demorados", "Más de " + DIAS_DEMORA + " días en el sector actual", i => (i.dias ?? 0) > DIAS_DEMORA)} />
        {enTramite.some(i => i.vence) ? (
          <Kpi etiqueta={cfg.vencimiento.etiqueta} valor={vencen.length} detalle={(cfg.vencimiento.conVencidos ? "vencidas o en " : "próximos ") + cfg.vencimiento.dias + " días"} tono={vencen.length ? "rojo" : null}
            onClick={() => abrir(cfg.vencimiento.etiqueta, (cfg.vencimiento.conVencidos ? "Vencidas o en los próximos " : "Próximos ") + cfg.vencimiento.dias + " días", i => vencen.includes(i))} />
        ) : (
          <Kpi etiqueta="Prioritarios en trámite" valor={enTramite.filter(i => i.prioritario).length} detalle="estrella o Plan de Obras"
            onClick={() => abrir("Prioritarios en trámite", null, i => i.prioritario)} />
        )}
        <Kpi etiqueta="Sin asignar" valor={sinAgente.length} detalle="en trámite sin agente" tono={sinAgente.length ? "ambar" : null}
          onClick={() => abrir("Sin asignar", null, i => agenteDe(i) === SIN_ASIGNAR)} />
        <Kpi etiqueta="Monto en trámite" valor={fmtMontoCorto(montoTotal)} detalle={(enTramite.length - conMonto.length) + " sin monto legible"} />
      </div>

      <Tarjeta titulo={"Entradas y salidas · últimos " + MESES + " meses"}
        subtitulo={porMes.map(s => s.etiqueta + ": " + enRango(s)).join(" · ")}
        leyenda={[{ etiqueta: porMes[0].etiqueta, color: COLOR_EN }, { etiqueta: porMes[1].etiqueta, color: COLOR_SALIDAS }]}>
        <Columnas meses={meses} series={porMes.map((s, k) => ({ ...s, color: k ? COLOR_SALIDAS : COLOR_EN }))}
          onElegir={(s, m) => abrir(s.etiqueta + " · " + m.etiqueta, null, i => fechaISO(s.fecha(i.e)).startsWith(m.clave), "todos")} />
      </Tarjeta>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Tarjeta titulo={cfg.etapa.titulo} subtitulo="En trámite, en el orden del circuito">
          <Barras datos={etapas} colorDe={() => COLOR_EN} onElegir={d => abrir(cfg.etapa.titulo.replace("Por ", "") + ": " + d.clave, null, i => i.etapa === d.clave)} />
        </Tarjeta>
        <Tarjeta titulo={cfg.encuadre.titulo} subtitulo="En trámite, con la suma de montos">
          <Anillo datos={encuadres}
            onElegir={d => abrir(cfg.encuadre.titulo.replace("Por ", "") + ": " + d.clave, null, i => (d.claves ? d.claves.includes(i.encuadre) : i.encuadre === d.clave))} />
        </Tarjeta>
        <Tarjeta titulo={cfg.origen + " · 10 con más expedientes"} subtitulo={origenes.length + " en total · en trámite"} className={soloPrioritarios ? "" : "xl:col-span-2"}>
          <Barras datos={origenes.slice(0, 10)} colorDe={() => COLOR_EN} conMonto ancho
            onElegir={d => abrir(d.clave, cfg.origen.replace("Por ", ""), i => i.origen === d.clave)} />
        </Tarjeta>
        {soloPrioritarios && (
          <Tarjeta titulo="Origen de la prioridad" subtitulo="En trámite">
            <Barras datos={prioridad} conMonto colorDe={c => ({ "Con estrella": "#eda100", "Plan de Obras": COLOR_EN })[c] || "#4a3aa7"}
              onElegir={d => abrir("Prioridad: " + d.clave, null, i => (i.e.prioritario && i.e.enPlanObras ? "Estrella y Plan de Obras" : i.e.prioritario ? "Con estrella" : "Plan de Obras") === d.clave)} />
          </Tarjeta>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- Agentes

function Agentes({ cfg, base, enTramite, agentes, acciones, abrir }) {
  const [busqueda, setBusqueda] = useState("");
  const filas = useMemo(() => {
    const m = new Map();
    for (const i of enTramite) {
      const a = agenteDe(i);
      const f = m.get(a) || { agente: a, en: 0, fuera: 0, dias: [], demorados: 0, prioritarios: 0, vencen: 0, monto: 0 };
      f[i.enDepto ? "en" : "fuera"]++;
      if (i.dias != null) f.dias.push(i.dias);
      if ((i.dias ?? 0) > DIAS_DEMORA) f.demorados++;
      if (i.prioritario) f.prioritarios++;
      if (venceDentro(cfg, i)) f.vencen++;
      if (i.monto != null) f.monto += i.monto;
      m.set(a, f);
    }
    return [...m.values()].sort((a, b) => (a.agente === SIN_ASIGNAR) - (b.agente === SIN_ASIGNAR) || (b.en + b.fuera) - (a.en + a.fuera));
  }, [enTramite]);
  const total = enTramite.length;
  const max = Math.max(1, ...filas.map(f => f.en + f.fuera));
  const promedioCarga = filas.filter(f => f.agente !== SIN_ASIGNAR).length
    ? total / filas.filter(f => f.agente !== SIN_ASIGNAR).length : 0;
  const conVencimientos = enTramite.some(i => i.vence);
  const deAgente = a => i => agenteDe(i) === a;

  const q = busqueda.trim().toLowerCase();
  const digitos = q.replace(/\D/g, "");
  const encontrados = q
    ? base.filter(i => {
        const exp = String(i.e.exp || "").toLowerCase();
        return exp.includes(q) || (digitos.length >= 3 && exp.replace(/\D/g, "").includes(digitos));
      })
    : [];

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={busqueda} onChange={ev => setBusqueda(ev.target.value)} placeholder="Buscar un expediente para reasignarlo (ej. 13-01447/25 o 1447)"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          {q && <span className="text-xs text-slate-500">{encontrados.length} expediente{encontrados.length !== 1 ? "s" : ""}</span>}
        </div>
        {q && (encontrados.length
          ? <div className="border-t border-slate-100 overflow-x-auto"><TablaItems items={encontrados} cfg={cfg} agentes={agentes} acciones={acciones} /></div>
          : <p className="px-5 pb-4 text-sm text-slate-500">No hay expedientes con ese número.</p>)}
      </div>

      <Tarjeta titulo="Carga por agente" subtitulo={total + " en trámite · promedio " + promedioCarga.toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " por agente"}
        leyenda={[{ etiqueta: "En " + cfg.nombre, color: COLOR_EN }, { etiqueta: "Fuera de " + cfg.nombre, color: COLOR_FUERA }]}>
        <div className="space-y-1">
          {filas.map(f => {
            const t = f.en + f.fuera;
            return (
              <div key={f.agente} className="grid grid-cols-[96px_1fr_40px] items-center gap-3 rounded px-1 py-0.5 hover:bg-slate-50">
                <button type="button" onClick={() => abrir("Expedientes de " + f.agente, null, deAgente(f.agente))}
                  className={"text-left text-xs font-medium truncate hover:underline " + (f.agente === SIN_ASIGNAR ? "text-amber-700" : "text-slate-700")}>{f.agente}</button>
                <div className="relative h-5">
                  {promedioCarga > 0 && (
                    <div className="absolute top-[-2px] bottom-[-2px] border-l border-dashed border-slate-400" style={{ left: (promedioCarga / max) * 100 + "%" }} title={"Promedio: " + promedioCarga.toFixed(1)} />
                  )}
                  <div className="flex h-full" style={{ width: (t / max) * 100 + "%" }}>
                    {[["en", COLOR_EN], ["fuera", COLOR_FUERA]].map(([k, color], n) => f[k] > 0 && (
                      <button key={k} type="button" title={(k === "en" ? "En " : "Fuera de ") + cfg.nombre + ": " + f[k]}
                        onClick={() => abrir("Expedientes de " + f.agente, (k === "en" ? "En " : "Fuera de ") + cfg.nombre, i => deAgente(f.agente)(i) && i.enDepto === (k === "en"))}
                        className="h-full flex items-center justify-center text-[11px] font-semibold text-white tabular-nums hover:brightness-110 first:rounded-l last:rounded-r"
                        style={{ width: (f[k] / t) * 100 + "%", minWidth: 18, background: color, marginLeft: n && f.en ? 2 : 0 }}>
                        {f[k]}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-xs font-semibold text-slate-900 tabular-nums text-right">{t}</span>
              </div>
            );
          })}
          <p className="pt-2 text-[11px] text-slate-400">La línea punteada marca el promedio por agente.</p>
        </div>
      </Tarjeta>

      <Tarjeta titulo="Indicadores por agente" subtitulo="En trámite · tocá una fila para ver y reasignar" sinPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-[11px] text-slate-500 border-b border-slate-200 bg-slate-50/60">
                <th className="py-2 px-4 text-left font-medium">Agente</th>
                <th className="py-2 px-3 text-right font-medium">En depto.</th>
                <th className="py-2 px-3 text-right font-medium">Fuera</th>
                <th className="py-2 px-3 text-right font-medium">Total</th>
                <th className="py-2 px-3 text-right font-medium">% del total</th>
                <th className="py-2 px-3 text-right font-medium">Días prom.</th>
                <th className="py-2 px-3 text-right font-medium">Máx. días</th>
                <th className="py-2 px-3 text-right font-medium">Demorados</th>
                <th className="py-2 px-3 text-right font-medium">Prioritarios</th>
                {conVencimientos && <th className="py-2 px-3 text-right font-medium">{cfg.vencimiento.etiqueta}</th>}
                <th className="py-2 px-4 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const t = f.en + f.fuera;
                const prom = promedio(f.dias);
                return (
                  <tr key={f.agente} onClick={() => abrir("Expedientes de " + f.agente, null, deAgente(f.agente))}
                    className="border-b border-slate-50 cursor-pointer hover:bg-slate-50">
                    <td className={"py-2 px-4 font-medium " + (f.agente === SIN_ASIGNAR ? "text-amber-700" : "text-slate-800")}>{f.agente}</td>
                    <td className="py-2 px-3 text-right">{cero(f.en)}</td>
                    <td className="py-2 px-3 text-right">{cero(f.fuera)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">{t}</td>
                    <td className="py-2 px-3 text-right text-slate-500">{pct(t, total)}</td>
                    <td className="py-2 px-3 text-right">{prom == null ? "-" : <Dias dias={Math.round(prom)} />}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{f.dias.length ? Math.max(...f.dias) : "-"}</td>
                    <td className="py-2 px-3 text-right">{f.demorados ? <Chip tono="rojo">{f.demorados}</Chip> : cero(0)}</td>
                    <td className="py-2 px-3 text-right">{f.prioritarios ? <Chip tono="ambar">{f.prioritarios}</Chip> : cero(0)}</td>
                    {conVencimientos && <td className="py-2 px-3 text-right">{f.vencen ? <Chip tono="rojo">{f.vencen}</Chip> : cero(0)}</td>}
                    <td className="py-2 px-4 text-right text-slate-700 whitespace-nowrap">{f.monto ? fmtMontoCorto(f.monto) : "-"}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-50/60 font-semibold">
                <td className="py-2 px-4">Total</td>
                <td className="py-2 px-3 text-right">{filas.reduce((s, f) => s + f.en, 0)}</td>
                <td className="py-2 px-3 text-right">{filas.reduce((s, f) => s + f.fuera, 0)}</td>
                <td className="py-2 px-3 text-right">{total}</td>
                <td className="py-2 px-3 text-right">100%</td>
                <td className="py-2 px-3 text-right">{redondo(promedio(filas.flatMap(f => f.dias)))}</td>
                <td className="py-2 px-3 text-right">{filas.some(f => f.dias.length) ? Math.max(...filas.flatMap(f => f.dias)) : "-"}</td>
                <td className="py-2 px-3 text-right">{filas.reduce((s, f) => s + f.demorados, 0)}</td>
                <td className="py-2 px-3 text-right">{filas.reduce((s, f) => s + f.prioritarios, 0)}</td>
                {conVencimientos && <td className="py-2 px-3 text-right">{filas.reduce((s, f) => s + f.vencen, 0)}</td>}
                <td className="py-2 px-4 text-right whitespace-nowrap">{fmtMontoCorto(filas.reduce((s, f) => s + f.monto, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Tarjeta>
    </div>
  );
}

// ----------------------------------------------------- Tiempos y sectores

function Tiempos({ cfg, enTramite, abrir }) {
  const tramos = TRAMOS.map(t => {
    const del = enTramite.filter(i => tramoDe(i.dias) === t.clave);
    return { ...t, en: del.filter(i => i.enDepto).length, fuera: del.filter(i => !i.enDepto).length };
  });
  const sinFecha = enTramite.filter(i => i.dias == null).length;
  const maxTramo = Math.max(1, ...tramos.map(t => t.en + t.fuera));

  const sectores = [...enTramite.reduce((m, i) => {
    const s = m.get(i.sector) || { sector: i.sector, dias: [], cantidad: 0, propio: i.enDepto };
    s.cantidad++;
    if (i.dias != null) s.dias.push(i.dias);
    return m.set(i.sector, s);
  }, new Map()).values()]
    .map(s => ({ ...s, prom: promedio(s.dias), med: mediana(s.dias), max: s.dias.length ? Math.max(...s.dias) : null, demorados: s.dias.filter(d => d > DIAS_DEMORA).length }))
    .sort((a, b) => b.cantidad - a.cantidad);
  const maxProm = Math.max(1, ...sectores.map(s => s.prom || 0));
  const antiguos = [...enTramite].filter(i => i.dias != null).sort((a, b) => b.dias - a.dias).slice(0, 10);

  return (
    <div className="space-y-4">
      <Tarjeta titulo="Antigüedad en el sector actual" subtitulo={"Días desde el último movimiento · en trámite" + (sinFecha ? " · " + sinFecha + " sin fecha" : "")}
        leyenda={[{ etiqueta: "En " + cfg.nombre, color: COLOR_EN }, { etiqueta: "Fuera de " + cfg.nombre, color: COLOR_FUERA }]}>
        <div className="grid grid-cols-6 gap-3 items-end h-52 pt-4">
          {tramos.map(t => {
            const total = t.en + t.fuera;
            return (
              <div key={t.clave} className="flex flex-col items-center h-full justify-end gap-1">
                <span className="text-xs font-semibold text-slate-900 tabular-nums">{total}</span>
                <div className="w-full max-w-[72px] flex flex-col-reverse" style={{ height: (total / maxTramo) * 100 + "%", minHeight: total ? 4 : 0 }}>
                  {[["en", COLOR_EN], ["fuera", COLOR_FUERA]].map(([k, color]) => t[k] > 0 && (
                    <button key={k} type="button" title={(k === "en" ? "En " : "Fuera de ") + cfg.nombre + ": " + t[k]}
                      onClick={() => abrir(t.etiqueta + " días en el sector", (k === "en" ? "En " : "Fuera de ") + cfg.nombre, i => tramoDe(i.dias) === t.clave && i.enDepto === (k === "en"))}
                      className="w-full hover:brightness-110 first:rounded-b last:rounded-t" style={{ height: (t[k] / total) * 100 + "%", background: color }} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-6 gap-3 mt-2 border-t border-slate-100 pt-2">
          {tramos.map(t => (
            <button key={t.clave} type="button" onClick={() => abrir(t.etiqueta + " días en el sector", null, i => tramoDe(i.dias) === t.clave)}
              className="text-center text-[11px] text-slate-600 hover:text-slate-900">
              <span className={"inline-block w-2 h-2 rounded-full mr-1 align-middle " + ({ verde: "bg-emerald-500", amarillo: "bg-amber-500", rojo: "bg-red-600" })[t.alerta]} />
              {t.etiqueta} días
            </button>
          ))}
        </div>
      </Tarjeta>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Tarjeta titulo="Dónde se demoran" subtitulo="Por sector actual · días desde el último movimiento" className="xl:col-span-3" sinPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="text-[11px] text-slate-500 border-b border-slate-200 bg-slate-50/60">
                  <th className="py-2 px-4 text-left font-medium">Sector</th>
                  <th className="py-2 px-3 text-right font-medium">Expedientes</th>
                  <th className="py-2 px-3 text-left font-medium w-[34%]">Días promedio</th>
                  <th className="py-2 px-3 text-right font-medium">Mediana</th>
                  <th className="py-2 px-3 text-right font-medium">Máx.</th>
                  <th className="py-2 px-4 text-right font-medium">+{DIAS_DEMORA} días</th>
                </tr>
              </thead>
              <tbody>
                {sectores.map(s => (
                  <tr key={s.sector} onClick={() => abrir("Sector: " + s.sector, null, i => i.sector === s.sector)} className="border-b border-slate-50 cursor-pointer hover:bg-slate-50">
                    <td className="py-2 px-4 font-medium text-slate-800">
                      {s.sector}{s.propio && <span className="ml-1.5 text-[10px] font-medium text-slate-400">(propio)</span>}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">{s.cantidad}</td>
                    <td className="py-2 px-3">
                      {s.prom == null ? "-" : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: (s.prom / maxProm) * 100 + "%", background: s.prom > DIAS_DEMORA ? "#dc2626" : s.prom > 10 ? "#f59e0b" : "#10b981" }} />
                          </div>
                          <span className="w-8 text-right text-slate-800">{Math.round(s.prom)}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-600">{redondo(s.med)}</td>
                    <td className="py-2 px-3 text-right text-slate-600">{s.max ?? "-"}</td>
                    <td className="py-2 px-4 text-right">{s.demorados ? <Chip tono="rojo">{s.demorados}</Chip> : cero(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Los 10 con más días sin movimiento" subtitulo="En trámite" className="xl:col-span-2" sinPadding>
          <ul className="divide-y divide-slate-50">
            {antiguos.map(i => (
              <li key={i.e.id}>
                <button type="button" onClick={() => abrir(i.e.exp, i.e.objeto, x => x.e.id === i.e.id)}
                  className="w-full flex items-center gap-3 px-5 py-2 text-left hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold text-slate-900 truncate" title={i.e.exp}>{i.e.exp}</div>
                    <div className="text-[11px] text-slate-500 truncate">{i.sector} · {agenteDe(i)} · {i.e.objeto}</div>
                  </div>
                  <Dias dias={i.dias} />
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ Componentes

function Segmentado({ opciones, valor, onChange }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      {opciones.map(({ id, etiqueta, Icono }) => (
        <button key={id} type="button" onClick={() => onChange(id)}
          className={"flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
            (valor === id ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900")}>
          {Icono && <Icono size={13} />} {etiqueta}
        </button>
      ))}
    </div>
  );
}

function Tarjeta({ titulo, subtitulo, leyenda, children, className = "", sinPadding }) {
  return (
    <section className={"bg-white border border-slate-200 rounded-xl overflow-hidden " + className}>
      <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
          {subtitulo && <p className="text-[11px] text-slate-500 mt-0.5">{subtitulo}</p>}
        </div>
        {leyenda && (
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-600">
            {leyenda.map(l => (
              <span key={l.etiqueta} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} /> {l.etiqueta}</span>
            ))}
          </div>
        )}
      </div>
      <div className={sinPadding ? "" : "px-5 py-4"}>{children}</div>
    </section>
  );
}

const TONO_KPI = { rojo: "text-red-700", ambar: "text-amber-700" };

function Kpi({ etiqueta, valor, detalle, tono, onClick }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp type={onClick ? "button" : undefined} onClick={onClick}
      className={"text-left bg-white border border-slate-200 rounded-xl px-4 py-3 " + (onClick ? "hover:border-slate-400 transition-colors" : "")}>
      <div className="text-[11px] font-medium text-slate-500 truncate">{etiqueta}</div>
      <div className={"mt-1 text-2xl font-semibold tabular-nums truncate " + (TONO_KPI[tono] || "text-slate-900")}>{valor}</div>
      {detalle && <div className="text-[11px] text-slate-500 truncate">{detalle}</div>}
    </Comp>
  );
}

function Chip({ tono, children }) {
  return (
    <span className={"text-[11px] font-semibold px-1.5 py-0.5 rounded border " +
      (tono === "rojo" ? "border-red-300 bg-red-50 text-red-700" : "border-amber-300 bg-amber-50 text-amber-800")}>{children}</span>
  );
}

function Dias({ dias }) {
  return (
    <span className={"inline-block text-[11px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap tabular-nums " + ALERTA_ESTILO[alertaDias(dias)]}>
      {dias} día{dias !== 1 ? "s" : ""}
    </span>
  );
}

const cero = n => (n ? n : <span className="text-slate-300">0</span>);

// Barras horizontales; con `conMonto`, la suma de montos de cada grupo.
function Barras({ datos, colorDe, onElegir, conMonto, ancho }) {
  const max = Math.max(1, ...datos.map(d => d.valor));
  if (!datos.length) return <p className="text-xs text-slate-400">Sin datos.</p>;
  return (
    <div className="space-y-0.5">
      {datos.map(d => (
        <button key={d.clave} type="button" onClick={() => onElegir(d)}
          title={d.clave + ": " + d.valor + (conMonto ? " · " + (d.valor === d.sinMonto ? "sin monto" : fmtMonto(d.monto)) : "")}
          className={"w-full grid items-center gap-3 rounded px-1 py-1 text-left hover:bg-slate-50 " +
            (ancho ? "grid-cols-[minmax(0,180px)_1fr_auto] md:grid-cols-[minmax(0,340px)_1fr_auto]" : "grid-cols-[minmax(0,180px)_1fr_auto]") +
            (conMonto ? " md:grid-cols-[minmax(0,340px)_1fr_auto_auto]" : "")}>
          <span className="text-xs text-slate-700 truncate">{d.clave}</span>
          <span className="h-3.5 rounded-r" style={{ width: (d.valor / max) * 100 + "%", minWidth: 4, background: colorDe ? colorDe(d.clave) : COLOR_EN }} />
          <span className="text-xs font-semibold text-slate-900 tabular-nums w-8 text-right">{d.valor}</span>
          {conMonto && <span className="hidden md:block text-xs text-slate-600 tabular-nums w-24 text-right whitespace-nowrap">{d.valor === d.sinMonto ? "-" : fmtMontoCorto(d.monto)}</span>}
        </button>
      ))}
    </div>
  );
}

// Columnas agrupadas por mes (dos series), con el valor arriba de cada una.
function Columnas({ meses, series, onElegir }) {
  const max = Math.max(1, ...series.flatMap(s => s.valores));
  return (
    <div>
      <div className="grid gap-2 h-48 items-end" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
        {meses.map((m, k) => (
          <div key={m.clave} className="flex items-end justify-center gap-1 h-full">
            {series.map(s => {
              const v = s.valores[k];
              return (
                <button key={s.clave} type="button" disabled={!v} onClick={() => onElegir(s, m)} title={s.etiqueta + " · " + m.etiqueta + ": " + v}
                  className="flex-1 max-w-[22px] flex flex-col items-center justify-end h-full group">
                  <span className="text-[10px] font-semibold text-slate-700 tabular-nums mb-0.5">{v || ""}</span>
                  <span className="w-full rounded-t group-hover:brightness-110" style={{ height: (v / max) * 85 + "%", minHeight: v ? 3 : 0, background: s.color }} />
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="grid gap-2 mt-1.5 pt-1.5 border-t border-slate-100" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
        {meses.map(m => <span key={m.clave} className="text-center text-[10px] text-slate-500 truncate">{m.etiqueta}</span>)}
      </div>
    </div>
  );
}

// Anillo con leyenda (cantidad, % y monto). Hasta 7 porciones con color
// propio de la paleta (en el orden del circuito); el resto se junta en
// "Otros", en gris, para que ningún color se repita.
const MAX_PORCIONES = 7;
function Anillo({ datos: todos, onElegir }) {
  const total = todos.reduce((n, d) => n + d.valor, 0);
  const mayores = [...todos].sort((a, b) => b.valor - a.valor).slice(0, todos.length > MAX_PORCIONES + 1 ? MAX_PORCIONES : todos.length);
  const resto = todos.filter(d => !mayores.includes(d));
  const datos = [
    ...todos.filter(d => mayores.includes(d)),
    ...(resto.length ? [{
      clave: "Otros (" + resto.length + ")", valor: resto.reduce((n, d) => n + d.valor, 0), monto: resto.reduce((n, d) => n + d.monto, 0),
      sinMonto: resto.reduce((n, d) => n + d.sinMonto, 0), claves: resto.map(d => d.clave),
    }] : []),
  ];
  const colores = new Map(datos.filter(d => !d.claves).map((d, k) => [d.clave, PALETA[k]]));
  const colorDe = c => colores.get(c) || GRIS;
  const R = 70, r = 44, C = 80;
  let angulo = -Math.PI / 2;
  const punto = (a, radio) => [C + radio * Math.cos(a), C + radio * Math.sin(a)];
  const porciones = datos.map(d => {
    const desde = angulo;
    angulo += (d.valor / total) * Math.PI * 2;
    const hasta = angulo;
    const grande = hasta - desde > Math.PI ? 1 : 0;
    const camino = datos.length === 1
      ? `M ${C} ${C - R} A ${R} ${R} 0 1 1 ${C - 0.01} ${C - R} Z M ${C} ${C - r} A ${r} ${r} 0 1 0 ${C + 0.01} ${C - r} Z`
      : (() => {
        const [x1, y1] = punto(desde, R), [x2, y2] = punto(hasta, R), [x3, y3] = punto(hasta, r), [x4, y4] = punto(desde, r);
        return `M ${x1} ${y1} A ${R} ${R} 0 ${grande} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${grande} 0 ${x4} ${y4} Z`;
      })();
    return { ...d, camino };
  });
  if (!total) return <p className="text-xs text-slate-400">Sin datos.</p>;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0" role="img">
        {porciones.map(p => (
          <path key={p.clave} d={p.camino} fill={colorDe(p.clave)} fillRule="evenodd" stroke="#fff" strokeWidth={2}
            onClick={() => onElegir(p)} className="cursor-pointer hover:brightness-110">
            <title>{p.clave + ": " + p.valor}</title>
          </path>
        ))}
        <text x={C} y={C - 2} textAnchor="middle" className="fill-slate-900 text-[22px] font-semibold">{total}</text>
        <text x={C} y={C + 14} textAnchor="middle" className="fill-slate-500 text-[9px]">expedientes</text>
      </svg>
      <ul className="flex-1 min-w-[220px] space-y-0.5">
        {porciones.map(p => (
          <li key={p.clave}>
            <button type="button" onClick={() => onElegir(p)} className="w-full flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-slate-50">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorDe(p.clave) }} />
              <span className="text-slate-700 truncate">{p.clave}</span>
              <span className="ml-auto font-semibold text-slate-900 tabular-nums">{p.valor}</span>
              <span className="w-9 text-right text-slate-500 tabular-nums">{pct(p.valor, total)}</span>
              <span className="w-20 text-right text-slate-600 tabular-nums whitespace-nowrap">{p.valor === p.sinMonto ? "-" : fmtMontoCorto(p.monto)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Ventana con los expedientes de lo tocado: estrella y agente se cambian
// desde acá.
function ModalLista({ titulo, subtitulo, items, cfg, agentes, acciones, onCerrar }) {
  useEffect(() => {
    const cerrar = ev => ev.key === "Escape" && onCerrar();
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [onCerrar]);
  const lista = [...items].sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[88vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
            <p className="text-xs text-slate-500 truncate">{cfg.nombre} · {lista.length} expediente{lista.length !== 1 ? "s" : ""}{subtitulo ? " · " + subtitulo : ""}</p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1 rounded-md hover:bg-slate-100 text-slate-500"><X size={16} /></button>
        </div>
        <div className="overflow-auto">
          {lista.length === 0
            ? <p className="px-6 py-8 text-sm text-slate-500">No quedan expedientes en este grupo.</p>
            : <TablaItems items={lista} cfg={cfg} agentes={agentes} acciones={acciones} />}
        </div>
      </div>
    </div>
  );
}

function TablaItems({ items, cfg, agentes, acciones }) {
  const conVencimiento = items.some(i => i.vence);
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-white">
        <tr className="text-left text-[11px] text-slate-500 border-b border-slate-200">
          <th className="py-2 px-4 font-medium">Exp.</th>
          <th className="py-2 px-4 font-medium">Objeto</th>
          <th className="py-2 px-4 font-medium">{cfg.etapa.titulo.replace("Por ", "").replace(/^./, c => c.toUpperCase())}</th>
          <th className="py-2 px-4 font-medium">Sector</th>
          <th className="py-2 px-4 font-medium">Días en sector</th>
          {conVencimiento && <th className="py-2 px-4 font-medium">{cfg.vencimiento?.columna || "Vencimiento"}</th>}
          <th className="py-2 px-4 font-medium">Agente</th>
        </tr>
      </thead>
      <tbody>
        {items.map(i => {
          const e = i.e;
          const venceEn = i.vence ? diasRestantes(i.vence) : null;
          return (
            <tr key={e.id} className="border-b border-slate-50 align-top">
              <td className="py-2 px-4 whitespace-nowrap">
                <div className="flex items-center gap-1 font-mono font-semibold text-slate-900">
                  <EstrellaPrioridad prioritario={e.prioritario} onClick={() => acciones.prioridad(e)} />
                  <span className="inline-block max-w-[190px] whitespace-normal break-words align-top" title={e.exp}>{e.exp}</span>
                </div>
                {e.enPlanObras && <span className="block w-fit mt-0.5 text-[10px] font-semibold text-sky-700">Plan de Obras</span>}
                {i.terminado && <span className="block w-fit mt-0.5 text-[10px] font-semibold text-slate-500">{cfg.terminados}</span>}
              </td>
              <td className="py-2 px-4 text-slate-700 min-w-[260px] max-w-[380px]">
                <span className="line-clamp-2" title={e.objeto}>{e.objeto}</span>
                {i.detalle && <span className="block text-[11px] text-slate-400 truncate">{i.detalle}</span>}
              </td>
              <td className="py-2 px-4 text-slate-700">{i.etapa}</td>
              <td className="py-2 px-4 text-slate-700 whitespace-nowrap">{i.sector}</td>
              <td className="py-2 px-4">{i.dias == null ? <span className="text-slate-300">-</span> : <Dias dias={i.dias} />}</td>
              {conVencimiento && (
                <td className="py-2 px-4 whitespace-nowrap">
                  {i.vence ? fmtFecha(i.vence) : "-"}
                  {venceDentro(cfg, i) && <span className="ml-1.5"><Chip tono="rojo">{venceEn < 0 ? "vencida" : venceEn + " d"}</Chip></span>}
                </td>
              )}
              <td className="py-2 px-4">
                <select value={e.agente || ""} onChange={ev => acciones.reasignar(e, ev.target.value)}
                  className="text-xs bg-white border border-slate-300 rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-slate-800">
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
