"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";

import { HOY, ROL_USUARIO_LABEL } from "@/lib/constants";
import { diasRestantes, alerta, documentacionDeExpediente } from "@/lib/utils";

// Prisma serializa las fechas como ISO ("2026-09-10T00:00:00.000Z"), pero los
// componentes hijos y utils esperan strings "YYYY-MM-DD". Además `documentacion`
// vacío debe caer al checklist por defecto (mismo comportamiento que antes).
function normalizarExpediente(e) {
  return {
    ...e,
    organismos: Array.isArray(e.organismos) ? e.organismos : e.organismo ? [e.organismo] : [],
    domiciliosRenglones: Array.isArray(e.domiciliosRenglones) ? e.domiciliosRenglones : [],
    fechaInicio: e.fechaInicio ? String(e.fechaInicio).slice(0, 10) : "",
    fechaVencimiento: e.fechaVencimiento ? String(e.fechaVencimiento).slice(0, 10) : "",
    fechaPublicacion: e.fechaPublicacion ? String(e.fechaPublicacion).slice(0, 10) : "",
    fechaApertura: e.fechaApertura ? String(e.fechaApertura).slice(0, 10) : "",
    creadoEn: e.creadoEn ? String(e.creadoEn).slice(0, 10) : "",
    observaciones: Array.isArray(e.observaciones)
      ? e.observaciones.map((o) => ({ ...o, fecha: o.fecha ? String(o.fecha).slice(0, 10) : "" }))
      : [],
    documentacion:
      Array.isArray(e.documentacion) && e.documentacion.length > 0 ? e.documentacion : undefined,
  };
}

// Resuelve a qué cadena entra un expediente nuevo según el N° de expediente
// antecedente que se haya cargado (usado tanto por "Cargar expediente" como
// por "Caratular"): si referencia a un Vigente O a un Parche (ambos son
// cobertura activa de la cadena, no algo ya cerrado), este pasa a ser su
// Renovación en trámite; si referencia a algo ya cerrado, pasa a ser el
// nuevo Vigente de esa cadena.
function resolverCadena(antecedenteExp, expedientes) {
  let cadenaId = "c" + Date.now();
  let rolNuevo = "vigente";
  let idVigenteAActualizar = null;
  let mensaje = "Expediente creado";

  if (antecedenteExp && antecedenteExp.trim()) {
    const match = expedientes.find(
      e => e.exp.trim().toLowerCase() === antecedenteExp.trim().toLowerCase()
    );
    if (match) {
      cadenaId = match.cadenaId;
      if (match.rol === "vigente" || match.rol === "parche") {
        rolNuevo = "renovacion";
        idVigenteAActualizar = match.id;
        mensaje = "Renovación creada y vinculada a " + match.exp + " (que continúa en ejecución)";
      } else {
        rolNuevo = "vigente";
        mensaje = "Expediente creado y concatenado como Vigente de la cadena de " + match.exp;
      }
    }
  }
  return { cadenaId, rolNuevo, idVigenteAActualizar, mensaje };
}

import Login from "./Login";
import TopBar from "./TopBar";
import Resumen from "./Resumen";
import FiltroBar from "./FiltroBar";
import TarjetaExpediente from "./TarjetaExpediente";
import TarjetaGrupoServicios from "./TarjetaGrupoServicios";
import PaginaExpediente from "./PaginaExpediente";
import FormularioExpediente from "./FormularioExpediente";
import CaratularExpediente from "./CaratularExpediente";
import ConfirmarRenovacion from "./ConfirmarRenovacion";
import ActivarProrroga from "./ActivarProrroga";
import GenerarParche from "./GenerarParche";
import DividirExpediente from "./DividirExpediente";
import CotizadorTaquigrafico from "./CotizadorTaquigrafico";
import CotizadorPolicia from "./CotizadorPolicia";
import CotizadorAvisos from "./CotizadorAvisos";
import ListadoTelefonos from "./ListadoTelefonos";
import PlanillaCotizacion from "./PlanillaCotizacion";
import ValorModular from "./ValorModular";
import InformePoliciaAdicional from "./InformePoliciaAdicional";
import InformeOrganismos from "./InformeOrganismos";
import InformeServicios from "./InformeServicios";

const VISTAS_EXCLUSIVAS_INFORMATICA_Y_VARIOS = [
  "cotizadorTaquigrafico", "cotizadorPolicia", "cotizadorAvisos",
  "informePoliciaAdicional", "informeOrganismos",
];

export default function App() {
  const { data: session, status } = useSession();
  const sesion = session?.user
    ? {
        nombre: session.user.name,
        rol: session.user.rol,
        rolLabel: ROL_USUARIO_LABEL[session.user.rol] || session.user.rol,
        departamentoId: session.user.departamentoId,
        departamentoSlug: session.user.departamentoSlug,
        departamentoNombre: session.user.departamentoNombre,
      }
    : null;
  const [vista, setVista] = useState("expedientes"); // 'expedientes' | 'valorModular'
  const [moduloValor, setModuloValor] = useState(200000);
  const [expedientes, setExpedientes] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [areaFiltro, setAreaFiltro] = useState("Todas");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [organismoFiltro, setOrganismoFiltro] = useState("Todos");
  const [vencimientoFiltro, setVencimientoFiltro] = useState("Todos");
  const [nombreCortoFiltro, setNombreCortoFiltro] = useState("");
  const [zonaFiltro, setZonaFiltro] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [visibles, setVisibles] = useState(6);
  const [seleccionado, setSeleccionado] = useState(null);
  const [formAbierto, setFormAbierto] = useState(null); // 'nuevo' | 'editar' | 'renovacion'
  const [toast, setToast] = useState("");

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  // Carga inicial desde la base real una vez que hay sesión.
  useEffect(() => {
    if (status !== "authenticated") return;
    let activo = true;
    (async () => {
      setCargando(true);
      try {
        const [resExp, resVM, resTel] = await Promise.all([
          fetch("/api/expedientes"),
          fetch("/api/valor-modular"),
          fetch("/api/telefonos"),
        ]);
        const data = await resExp.json();
        if (activo) setExpedientes((data.expedientes || []).map(normalizarExpediente));
        if (resVM.ok) {
          const dataVM = await resVM.json();
          if (activo && dataVM.valorModular?.valor) setModuloValor(dataVM.valorModular.valor);
        }
        if (resTel.ok) {
          const dataTel = await resTel.json();
          if (activo && dataTel.secciones?.length) setSecciones(dataTel.secciones);
        }
      } catch {
        if (activo) mostrarToast("No se pudieron cargar los expedientes");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [status]);

  // Vuelve a pedir el listado completo tras una mutación. Si se pasa un id,
  // re-sincroniza el expediente abierto en el detalle con la copia fresca.
  async function refrescar(idSeleccion) {
    const res = await fetch("/api/expedientes");
    const data = await res.json();
    const lista = (data.expedientes || []).map(normalizarExpediente);
    setExpedientes(lista);
    if (idSeleccion != null) {
      setSeleccionado(lista.find((e) => e.id === idSeleccion) || null);
    }
    return lista;
  }

  const filtrados = useMemo(() => {
    return expedientes.filter((e) => {
      if (areaFiltro !== "Todas" && e.area !== areaFiltro) return false;
      if (tipoFiltro !== "Todos" && e.tipo !== tipoFiltro) return false;
      if (estadoFiltro !== "Todos" && e.estadoGeneral !== estadoFiltro) return false;
      if (organismoFiltro !== "Todos" && !(e.organismos || []).includes(organismoFiltro)) return false;
      if (zonaFiltro !== "Todas" && e.zona !== zonaFiltro) return false;
      if (nombreCortoFiltro.trim() && !(e.nombreCorto || "").toLowerCase().includes(nombreCortoFiltro.trim().toLowerCase())) return false;
      if (vencimientoFiltro !== "Todos") {
        const dias = diasRestantes(e.fechaVencimiento);
        const niv = alerta(dias);
        if (vencimientoFiltro === "proximos" && !(dias >= 0 && dias < 90)) return false;
        if (vencimientoFiltro === "criticos" && niv !== "rojo") return false;
        if (vencimientoFiltro === "vencidos" && niv !== "vencido") return false;
        if (vencimientoFiltro === "enPlazo" && niv !== "verde") return false;
      }
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const campos = [e.exp, e.nombreCorto, e.objeto, e.adjudicatario, ...(e.organismos || [])];
        if (!campos.some(c => String(c || "").toLowerCase().includes(q))) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento));
  }, [expedientes, areaFiltro, tipoFiltro, estadoFiltro, organismoFiltro, zonaFiltro, vencimientoFiltro, nombreCortoFiltro, busqueda]);

  // En Servicios, varios expedientes con el mismo tipo de servicio, fuero y
  // zona son la misma prestación repetida con distinto N° de expediente —
  // se agrupan en una sola card en vez de repetir tarjetas casi idénticas.
  const itemsListado = useMemo(() => {
    if (sesion?.departamentoSlug !== "servicios") {
      return filtrados.map(e => ({ tipo: "individual", exp: e }));
    }
    const grupos = new Map();
    const orden = [];
    for (const e of filtrados) {
      const clave = e.tipo + "||" + (e.zona || "") + "||" + [...(e.fuero || [])].sort().join(",");
      if (!grupos.has(clave)) { grupos.set(clave, []); orden.push(clave); }
      grupos.get(clave).push(e);
    }
    return orden.map(clave => {
      const items = grupos.get(clave);
      // Aunque sea un único expediente, en Servicios se muestra con la misma
      // card "de grupo" (organismo, direcciones, sector/convocatoria,
      // prórroga, días frenado) en vez de la card genérica simplificada.
      const organismos = Array.from(new Set(items.flatMap(i => i.organismos || [])));
      return { tipo: "grupo", clave, grupo: { tipo: items[0].tipo, zona: items[0].zona, fuero: items[0].fuero || [], organismos, items } };
    });
  }, [filtrados, sesion?.departamentoSlug]);

  const resumen = useMemo(() => {
    const anioActual = HOY.getFullYear();
    const activos = expedientes.filter(e => e.estadoGeneral !== "Archivado" && e.estadoGeneral !== "Finalizado");
    const vigentes = activos.filter(e => e.estadoGeneral === "Vigente").length;
    const proximosVencer = activos.filter(e => { const d = diasRestantes(e.fechaVencimiento); return d >= 0 && d < 90; }).length;
    const enRenovacion = activos.filter(e => e.estadoGeneral === "En trámite de renovación").length;
    const montoComprometidoAnioActual = activos
      .filter(e => e.fechaInicio && new Date(e.fechaInicio + "T00:00:00").getFullYear() === anioActual)
      .reduce((s, e) => s + (e.montoARS || 0), 0);
    const porArea = {
      Informatica: activos.filter(e => e.area === "Informatica").length,
      Varios: activos.filter(e => e.area === "Varios").length,
    };

    // Desglose de presupuesto comprometido por ejercicio financiero (año de inicio) y área,
    // considerando TODOS los expedientes (incluye archivados/finalizados) para fines de informe histórico.
    const porEjercicio = {};
    expedientes.forEach(e => {
      const ejercicio = e.fechaInicio ? new Date(e.fechaInicio + "T00:00:00").getFullYear() : "Sin fecha";
      if (!porEjercicio[ejercicio]) {
        porEjercicio[ejercicio] = { ejercicio, Informatica: 0, Varios: 0, total: 0, cantidad: 0 };
      }
      porEjercicio[ejercicio][e.area] = (porEjercicio[ejercicio][e.area] || 0) + (e.montoARS || 0);
      porEjercicio[ejercicio].total += (e.montoARS || 0);
      porEjercicio[ejercicio].cantidad += 1;
    });
    const desgloseEjercicios = Object.values(porEjercicio).sort((a, b) => String(b.ejercicio).localeCompare(String(a.ejercicio)));
    const totalGeneralTodosLosEjercicios = desgloseEjercicios.reduce((s, f) => s + f.total, 0);

    return {
      vigentes, proximosVencer, enRenovacion, porArea, desgloseEjercicios,
      anioActual, montoComprometidoAnioActual, totalGeneralTodosLosEjercicios,
    };
  }, [expedientes]);

  async function guardarValorModular(nuevoValor) {
    const anterior = moduloValor;
    setModuloValor(nuevoValor); // optimista
    try {
      const res = await fetch("/api/valor-modular", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: nuevoValor }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setModuloValor(data.valorModular?.valor ?? nuevoValor);
      mostrarToast("Valor modular actualizado");
    } catch {
      setModuloValor(anterior); // revierte si falló
      mostrarToast("No se pudo guardar el valor modular");
    }
  }

  function verExpediente(id) {
    const exp = expedientes.find(e => e.id === id);
    setSeleccionado(exp);
    setVista("expedienteDetalle");
  }

  async function guardarObservacion(id, entrada) {
    // entrada: { tipo: "general" | "movimiento", texto, sectorNuevo? }
    const esMovimiento = entrada.tipo === "movimiento";
    const actual = expedientes.find((e) => e.id === id);
    const res = await fetch(`/api/expedientes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nuevaObservacion: entrada.texto,
        tipo: entrada.tipo,
        sectorAnterior: esMovimiento ? (actual?.sector ?? null) : null,
        sectorNuevo: esMovimiento ? entrada.sectorNuevo : null,
      }),
    });
    if (!res.ok) { mostrarToast("No se pudo guardar la observación"); return; }
    await refrescar(id);
    mostrarToast(esMovimiento ? "Movimiento cargado, sector actualizado" : "Observación agregada");
  }

  async function editarObservacion(expId, obsId, cambios) {
    // cambios: { texto, sectorNuevo? }  — solo jefe de departamento
    const res = await fetch(`/api/expedientes/${expId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editarObservacion: { obsId, ...cambios } }),
    });
    if (!res.ok) { mostrarToast("No se pudo editar la observación"); return; }
    await refrescar(expId);
    mostrarToast("Observación actualizada");
  }

  async function eliminarObservacion(expId, obsId) {
    const res = await fetch(`/api/expedientes/${expId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eliminarObservacion: { obsId } }),
    });
    if (!res.ok) { mostrarToast("No se pudo eliminar la observación"); return; }
    await refrescar(expId);
    mostrarToast("Observación eliminada");
  }

  async function eliminarExpediente(id) {
    const res = await fetch(`/api/expedientes/${id}`, { method: "DELETE" });
    if (!res.ok) { mostrarToast("No se pudo eliminar el expediente"); return; }
    setSeleccionado(null);
    setVista("expedientes");
    await refrescar();
    mostrarToast("Expediente eliminado");
  }

  async function toggleDocumentacion(id, indice) {
    const exp = expedientes.find((e) => e.id === id);
    if (!exp) return;
    const docs = documentacionDeExpediente(exp);
    const target = docs[indice];
    if (!target) return;
    const res = await fetch(`/api/expedientes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        toggleDoc: { indice, cargado: !target.cargado, items: docs.map((d) => d.item) },
      }),
    });
    if (!res.ok) { mostrarToast("No se pudo actualizar la documentación"); return; }
    await refrescar(seleccionado && seleccionado.id === id ? id : undefined);
  }

  // Vincula el resultado de un cotizador (taquigráfico, policía adicional, avisos)
  // al expediente correspondiente, agregándolo como observación con el monto aprobado.
  function vincularCotizacionAExpediente(expNumero, texto) {
    const numeroBuscado = (expNumero || "").trim().toLowerCase();
    const match = expedientes.find(e => e.exp.trim().toLowerCase() === numeroBuscado);
    if (!match) {
      mostrarToast("No se encontró el expediente " + expNumero + " para vincular");
      return false;
    }
    fetch(`/api/expedientes/${match.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nuevaObservacion: texto, tipo: "general" }),
    })
      .then((res) => {
        if (!res.ok) { mostrarToast("No se pudo vincular al expediente " + match.exp); return; }
        return refrescar(seleccionado && seleccionado.id === match.id ? match.id : undefined)
          .then(() => mostrarToast("Vinculado al expediente " + match.exp));
      })
      .catch(() => mostrarToast("No se pudo vincular al expediente " + match.exp));
    return true;
  }

  // "Aprobar y vincular" del cotizador de policía adicional: marca el expediente
  // como policía adicional, guarda el snapshot de la cotización y tilda el paso
  // del cotizador en el circuito de legalidad.
  async function vincularCotizacionPolicia(datos) {
    const numeroBuscado = (datos.expNro || "").trim().toLowerCase();
    const match = expedientes.find(e => e.exp.trim().toLowerCase() === numeroBuscado);
    if (!match) {
      mostrarToast("No se encontró el expediente " + datos.expNro + " para vincular");
      return false;
    }
    const res = await fetch(`/api/expedientes/${match.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vincularCotizacionPolicia: {
          fuerza: datos.fuerza,
          periodicidad: datos.periodicidad,
          periodo: datos.periodo,
          dias: datos.dias,
          modulosPorDia: datos.modulosPorDia,
          cantidadOficiales: datos.cantidadOficiales,
          totalModulos: datos.totalModulos,
          costoTotal: datos.costoTotal,
          objeto: datos.objeto,
          desglose: datos.desglose,
          texto: datos.texto,
          aprobadoEn: new Date().toISOString().slice(0, 10),
        },
      }),
    });
    if (!res.ok) { mostrarToast("No se pudo vincular la cotización al expediente " + match.exp); return false; }
    await refrescar(seleccionado && seleccionado.id === match.id ? match.id : undefined);
    mostrarToast("Cotización aprobada y vinculada a " + match.exp);
    return true;
  }

  async function crearRenovacion(vigente, datos) {
    const res = await fetch("/api/expedientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renovarDeId: vigente.id, ...datos }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      mostrarToast(data.error || "No se pudo crear la renovación");
      return;
    }
    const data = await res.json();
    await refrescar(data.expediente?.id);
    setFormAbierto(null);
    mostrarToast("Renovación creada y vinculada a " + vigente.exp);
  }

  // El contrato anterior vence y la renovación pasa a ser el nuevo Vigente.
  async function activarRenovacion(renovacion) {
    const vigenteAnterior = expedientes.find(e => e.cadenaId === renovacion.cadenaId && e.rol === "vigente");
    const res = await fetch(`/api/expedientes/${renovacion.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activarRenovacion: true }),
    });
    if (!res.ok) { mostrarToast("No se pudo activar la renovación"); return; }
    await refrescar(renovacion.id);
    mostrarToast(
      vigenteAnterior
        ? "Activado como Vigente. " + vigenteAnterior.exp + " pasó a ser el Antecedente."
        : "Activado como Vigente."
    );
  }

  async function activarProrroga(exp, datos) {
    const res = await fetch(`/api/expedientes/${exp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activarProrroga: datos }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      mostrarToast(data.error || "No se pudo activar la prórroga");
      return;
    }
    await refrescar(exp.id);
    setFormAbierto(null);
    mostrarToast("Prórroga activada, vencimiento extendido");
  }

  async function crearParche(origen, datos) {
    const res = await fetch("/api/expedientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcheDeId: origen.id, ...datos }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      mostrarToast(data.error || "No se pudo generar el parche");
      return;
    }
    const data = await res.json();
    await refrescar(data.expediente?.id);
    setFormAbierto(null);
    mostrarToast("Parche generado y vinculado a " + origen.exp);
  }

  async function crearDivision(origen, datos) {
    const res = await fetch("/api/expedientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ divisionDeId: origen.id, ...datos }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      mostrarToast(data.error || "No se pudo dividir el expediente");
      return;
    }
    const data = await res.json();
    await refrescar(data.expediente?.id);
    setFormAbierto(null);
    mostrarToast("Expediente dividido — el resto queda vinculado a " + origen.exp);
  }

  async function reunificar(exp, unificado) {
    const res = await fetch(`/api/expedientes/${exp.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reunificar: unificado }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      mostrarToast(data.error || "No se pudo actualizar la unificación");
      return;
    }
    await refrescar(exp.id);
    mostrarToast(unificado ? "Expedientes reunificados" : "Expedientes separados de nuevo");
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Cargando...</div>;
  }
  if (!sesion) {
    return <Login />;
  }
  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Cargando...</div>;
  }

  const puedeEditar = sesion.rol === "admin" || sesion.rol === "operador";
  const esJefe = sesion.rol === "admin"; // jefe de departamento
  const puedeEliminar = esJefe;
  const esInformaticaYVarios = sesion.departamentoSlug === "informatica-y-varios";
  // Defensivo: si se llega a una vista exclusiva de Informática y Varios sin pasar
  // por el botón del navbar (ej. estado previo de sesión), se vuelve al listado.
  const vistaEfectiva = (!esInformaticaYVarios && VISTAS_EXCLUSIVAS_INFORMATICA_Y_VARIOS.includes(vista))
    ? "expedientes"
    : vista;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-md shadow-lg flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <TopBar sesion={sesion} onLogout={() => signOut()} busqueda={busqueda} setBusqueda={setBusqueda} vista={vista} setVista={setVista} mostrarToast={mostrarToast} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {vistaEfectiva === "valorModular" ? (
          <ValorModular
            moduloValor={moduloValor}
            setModuloValor={guardarValorModular}
            sesion={sesion}
          />
        ) : vistaEfectiva === "cotizadorTaquigrafico" ? (
          <CotizadorTaquigrafico sesion={sesion} mostrarToast={mostrarToast} expedientes={expedientes} onVincular={vincularCotizacionAExpediente} />
        ) : vistaEfectiva === "cotizadorPolicia" ? (
          <CotizadorPolicia mostrarToast={mostrarToast} expedientes={expedientes} onAprobarYVincular={vincularCotizacionPolicia} />
        ) : vistaEfectiva === "informePoliciaAdicional" ? (
          <InformePoliciaAdicional expedientes={expedientes} moduloValor={moduloValor} />
        ) : vistaEfectiva === "informeOrganismos" ? (
          <InformeOrganismos expedientes={expedientes} />
        ) : vistaEfectiva === "informeServicios" ? (
          <InformeServicios expedientes={expedientes} />
        ) : vistaEfectiva === "cotizadorAvisos" ? (
          <CotizadorAvisos mostrarToast={mostrarToast} expedientes={expedientes} onVincular={vincularCotizacionAExpediente} />
        ) : vistaEfectiva === "listadoTelefonos" ? (
          <ListadoTelefonos sesion={sesion} mostrarToast={mostrarToast} seccionesIniciales={secciones} />
        ) : vistaEfectiva === "planillaCotizacion" ? (
          <PlanillaCotizacion mostrarToast={mostrarToast} />
        ) : vistaEfectiva === "expedienteDetalle" && seleccionado ? (
          <PaginaExpediente
            exp={seleccionado}
            expedientes={expedientes}
            onVolver={() => { setVista("expedientes"); setSeleccionado(null); }}
            onNavegar={(id) => verExpediente(id)}
            onObservacion={guardarObservacion}
            onEditarObservacion={editarObservacion}
            onEliminarObservacion={eliminarObservacion}
            onDocumentacion={toggleDocumentacion}
            onEliminar={eliminarExpediente}
            onEditar={() => setFormAbierto("editar")}
            onRenovar={() => setFormAbierto("renovacion")}
            onActivar={() => activarRenovacion(seleccionado)}
            onActivarProrroga={() => setFormAbierto("activarProrroga")}
            onGenerarParche={() => setFormAbierto("generarParche")}
            onDividir={() => setFormAbierto("dividir")}
            onReunificar={(unificado) => reunificar(seleccionado, unificado)}
            puedeEditar={puedeEditar}
            puedeEliminar={puedeEliminar}
            esJefe={esJefe}
            moduloValor={moduloValor}
          />
        ) : (
          <>
            <Resumen resumen={resumen} mostrarDesgloseArea={esInformaticaYVarios} />

            <FiltroBar
              areaFiltro={areaFiltro} setAreaFiltro={setAreaFiltro}
              tipoFiltro={tipoFiltro} setTipoFiltro={setTipoFiltro}
              estadoFiltro={estadoFiltro} setEstadoFiltro={setEstadoFiltro}
              organismoFiltro={organismoFiltro} setOrganismoFiltro={setOrganismoFiltro}
              vencimientoFiltro={vencimientoFiltro} setVencimientoFiltro={setVencimientoFiltro}
              nombreCortoFiltro={nombreCortoFiltro} setNombreCortoFiltro={setNombreCortoFiltro}
              zonaFiltro={zonaFiltro} setZonaFiltro={setZonaFiltro}
              total={filtrados.length}
              puedeEditar={puedeEditar}
              onNuevo={() => setFormAbierto("nuevo")}
              onCaratular={() => setFormAbierto("caratular")}
              departamentoSlug={sesion.departamentoSlug}
            />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {itemsListado.slice(0, visibles).map(item =>
                item.tipo === "grupo"
                  ? <TarjetaGrupoServicios key={item.clave} grupo={item.grupo} onVer={verExpediente} />
                  : <TarjetaExpediente key={item.exp.id} exp={item.exp} onVer={() => verExpediente(item.exp.id)} />
              )}
            </div>

            {filtrados.length === 0 && (
              <div className="text-center py-16 text-slate-500 text-sm">
                No se encontraron expedientes con los filtros aplicados.
              </div>
            )}

            {visibles < itemsListado.length && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setVisibles(v => v + 6)}
                  className="px-5 py-2.5 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-slate-500 transition-colors"
                >
                  Ver más expedientes ({itemsListado.length - visibles} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {formAbierto === "nuevo" && (
        <FormularioExpediente
          titulo="Nuevo expediente"
          esNuevo
          expedientes={expedientes}
          departamentoSlug={sesion.departamentoSlug}
          onCerrar={() => setFormAbierto(null)}
          onGuardar={async (datos) => {
            const { antecedenteExp, ...resto } = datos;
            const { cadenaId, rolNuevo, idVigenteAActualizar, mensaje } = resolverCadena(antecedenteExp, expedientes);

            const res = await fetch("/api/expedientes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...resto,
                montoARS: Number(resto.montoARS) || 0,
                montoUSD: Number(resto.montoUSD) || 0,
                cadenaId,
                rol: rolNuevo,
                estadoGeneral: rolNuevo === "renovacion" ? "En trámite de renovación" : resto.estadoGeneral,
                idVigenteAActualizar,
              }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              mostrarToast(data.error || "No se pudo crear el expediente");
              return;
            }
            await refrescar();
            setFormAbierto(null);
            mostrarToast(mensaje);
          }}
        />
      )}

      {formAbierto === "caratular" && (
        <CaratularExpediente
          departamentoSlug={sesion.departamentoSlug}
          expedientes={expedientes}
          onCerrar={() => setFormAbierto(null)}
          onGuardar={async (datos) => {
            const { antecedenteExp, ...resto } = datos;
            const { cadenaId, rolNuevo, idVigenteAActualizar, mensaje } = resolverCadena(antecedenteExp, expedientes);

            const res = await fetch("/api/expedientes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...resto,
                cadenaId,
                rol: rolNuevo,
                estadoGeneral: rolNuevo === "renovacion" ? "En trámite de renovación" : resto.estadoGeneral,
                idVigenteAActualizar,
              }),
            });
            if (!res.ok) {
              const dataErr = await res.json().catch(() => ({}));
              mostrarToast(dataErr.error || "No se pudo caratular el expediente");
              return;
            }
            const data = await res.json();
            await refrescar(data.expediente?.id);
            setFormAbierto(null);
            setVista("expedienteDetalle");
            mostrarToast(rolNuevo === "renovacion" ? mensaje : "Expediente caratulado. Completá el resto desde \"Editar expediente\" en su ficha.");
          }}
        />
      )}

      {formAbierto === "editar" && seleccionado && (
        <FormularioExpediente
          titulo={"Editar " + seleccionado.exp}
          inicial={seleccionado}
          expedientes={expedientes}
          departamentoSlug={sesion.departamentoSlug}
          onCerrar={() => setFormAbierto(null)}
          onGuardar={async (datos) => {
            const res = await fetch(`/api/expedientes/${seleccionado.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(datos),
            });
            if (!res.ok) { mostrarToast("No se pudo actualizar el expediente"); return; }
            await refrescar(seleccionado.id);
            setFormAbierto(null);
            mostrarToast("Expediente actualizado");
          }}
        />
      )}

      {formAbierto === "renovacion" && seleccionado && (
        <ConfirmarRenovacion
          exp={seleccionado}
          expedientes={expedientes}
          onCerrar={() => setFormAbierto(null)}
          onConfirmar={(datos) => crearRenovacion(seleccionado, datos)}
        />
      )}

      {formAbierto === "activarProrroga" && seleccionado && (
        <ActivarProrroga
          exp={seleccionado}
          onCerrar={() => setFormAbierto(null)}
          onConfirmar={(datos) => activarProrroga(seleccionado, datos)}
        />
      )}

      {formAbierto === "generarParche" && seleccionado && (
        <GenerarParche
          exp={seleccionado}
          onCerrar={() => setFormAbierto(null)}
          onConfirmar={(datos) => crearParche(seleccionado, datos)}
        />
      )}

      {formAbierto === "dividir" && seleccionado && (
        <DividirExpediente
          exp={seleccionado}
          onCerrar={() => setFormAbierto(null)}
          onConfirmar={(datos) => crearDivision(seleccionado, datos)}
        />
      )}
    </div>
  );
}


