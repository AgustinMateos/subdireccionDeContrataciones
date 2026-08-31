"use client";

import { useState, useMemo, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";

import { HOY } from "@/lib/constants";
import { diasRestantes, alerta, documentacionDeExpediente } from "@/lib/utils";

// Prisma serializa las fechas como ISO ("2026-09-10T00:00:00.000Z"), pero los
// componentes hijos y utils esperan strings "YYYY-MM-DD". Además `documentacion`
// vacío debe caer al checklist por defecto (mismo comportamiento que antes).
function normalizarExpediente(e) {
  return {
    ...e,
    fechaInicio: e.fechaInicio ? String(e.fechaInicio).slice(0, 10) : "",
    fechaVencimiento: e.fechaVencimiento ? String(e.fechaVencimiento).slice(0, 10) : "",
    observaciones: Array.isArray(e.observaciones)
      ? e.observaciones.map((o) => ({ ...o, fecha: o.fecha ? String(o.fecha).slice(0, 10) : "" }))
      : [],
    documentacion:
      Array.isArray(e.documentacion) && e.documentacion.length > 0 ? e.documentacion : undefined,
  };
}

import Login from "./Login";
import TopBar from "./TopBar";
import Resumen from "./Resumen";
import FiltroBar from "./FiltroBar";
import TarjetaExpediente from "./TarjetaExpediente";
import PaginaExpediente from "./PaginaExpediente";
import FormularioExpediente from "./FormularioExpediente";
import ConfirmarRenovacion from "./ConfirmarRenovacion";
import CotizadorTaquigrafico from "./CotizadorTaquigrafico";
import CotizadorPolicia from "./CotizadorPolicia";
import CotizadorAvisos from "./CotizadorAvisos";
import LibroAperturas from "./LibroAperturas";
import ListadoTelefonos from "./ListadoTelefonos";
import PlanillaCotizacion from "./PlanillaCotizacion";
import ValorModular from "./ValorModular";

export default function App() {
  const { data: session, status } = useSession();
  const sesion = session?.user ? { nombre: session.user.name, rol: session.user.rol } : null;
  const [vista, setVista] = useState("expedientes"); // 'expedientes' | 'valorModular'
  const [moduloValor, setModuloValor] = useState(200000);
  const [expedientes, setExpedientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [areaFiltro, setAreaFiltro] = useState("Todas");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [organismoFiltro, setOrganismoFiltro] = useState("Todos");
  const [vencimientoFiltro, setVencimientoFiltro] = useState("Todos");
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
        const res = await fetch("/api/expedientes");
        const data = await res.json();
        if (activo) setExpedientes((data.expedientes || []).map(normalizarExpediente));
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
      if (organismoFiltro !== "Todos" && e.organismo !== organismoFiltro) return false;
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
        if (
          !e.exp.toLowerCase().includes(q) &&
          !e.objeto.toLowerCase().includes(q) &&
          !e.adjudicatario.toLowerCase().includes(q) &&
          !e.organismo.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.fechaVencimiento) - new Date(a.fechaVencimiento));
  }, [expedientes, areaFiltro, tipoFiltro, estadoFiltro, organismoFiltro, vencimientoFiltro, busqueda]);

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

  async function crearRenovacion(vigente) {
    const res = await fetch("/api/expedientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renovarDeId: vigente.id }),
    });
    if (!res.ok) { mostrarToast("No se pudo crear la renovación"); return; }
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
  const puedeEliminar = sesion.rol === "admin";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white text-sm px-4 py-2.5 rounded-md shadow-lg flex items-center gap-2">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}

      <TopBar sesion={sesion} onLogout={() => signOut()} busqueda={busqueda} setBusqueda={setBusqueda} vista={vista} setVista={setVista} mostrarToast={mostrarToast} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {vista === "valorModular" ? (
          <ValorModular
            moduloValor={moduloValor}
            setModuloValor={(v) => { setModuloValor(v); mostrarToast("Valor modular actualizado"); }}
            sesion={sesion}
          />
        ) : vista === "cotizadorTaquigrafico" ? (
          <CotizadorTaquigrafico sesion={sesion} mostrarToast={mostrarToast} expedientes={expedientes} onVincular={vincularCotizacionAExpediente} />
        ) : vista === "cotizadorPolicia" ? (
          <CotizadorPolicia mostrarToast={mostrarToast} expedientes={expedientes} onVincular={vincularCotizacionAExpediente} />
        ) : vista === "cotizadorAvisos" ? (
          <CotizadorAvisos mostrarToast={mostrarToast} expedientes={expedientes} onVincular={vincularCotizacionAExpediente} />
        ) : vista === "libroAperturas" ? (
          <LibroAperturas sesion={sesion} mostrarToast={mostrarToast} />
        ) : vista === "listadoTelefonos" ? (
          <ListadoTelefonos sesion={sesion} mostrarToast={mostrarToast} />
        ) : vista === "planillaCotizacion" ? (
          <PlanillaCotizacion mostrarToast={mostrarToast} />
        ) : vista === "expedienteDetalle" && seleccionado ? (
          <PaginaExpediente
            exp={seleccionado}
            expedientes={expedientes}
            onVolver={() => { setVista("expedientes"); setSeleccionado(null); }}
            onNavegar={(id) => verExpediente(id)}
            onObservacion={guardarObservacion}
            onDocumentacion={toggleDocumentacion}
            onEliminar={eliminarExpediente}
            onEditar={() => setFormAbierto("editar")}
            onRenovar={() => setFormAbierto("renovacion")}
            onActivar={() => activarRenovacion(seleccionado)}
            puedeEditar={puedeEditar}
            puedeEliminar={puedeEliminar}
          />
        ) : (
          <>
            <Resumen resumen={resumen} />

            <FiltroBar
              areaFiltro={areaFiltro} setAreaFiltro={setAreaFiltro}
              tipoFiltro={tipoFiltro} setTipoFiltro={setTipoFiltro}
              estadoFiltro={estadoFiltro} setEstadoFiltro={setEstadoFiltro}
              organismoFiltro={organismoFiltro} setOrganismoFiltro={setOrganismoFiltro}
              vencimientoFiltro={vencimientoFiltro} setVencimientoFiltro={setVencimientoFiltro}
              total={filtrados.length}
              puedeEditar={puedeEditar}
              onNuevo={() => setFormAbierto("nuevo")}
            />

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtrados.slice(0, visibles).map(e => (
                <TarjetaExpediente key={e.id} exp={e} onVer={() => verExpediente(e.id)} />
              ))}
            </div>

            {filtrados.length === 0 && (
              <div className="text-center py-16 text-slate-500 text-sm">
                No se encontraron expedientes con los filtros aplicados.
              </div>
            )}

            {visibles < filtrados.length && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setVisibles(v => v + 6)}
                  className="px-5 py-2.5 rounded-md border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:border-slate-500 transition-colors"
                >
                  Ver más expedientes ({filtrados.length - visibles} restantes)
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
          onCerrar={() => setFormAbierto(null)}
          onGuardar={async (datos) => {
            const { antecedenteExp, ...resto } = datos;
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
                if (match.rol === "vigente") {
                  // El expediente referenciado sigue vigente y en ejecución: lo que se
                  // carga ahora es su renovación/prórroga en trámite, para tenerla lista
                  // antes de que venza el servicio contratado.
                  rolNuevo = "renovacion";
                  idVigenteAActualizar = match.id;
                  mensaje = "Renovación creada y vinculada al vigente " + match.exp + " (que continúa en ejecución)";
                } else {
                  // El expediente referenciado ya es antecedente/archivado/finalizado:
                  // no hay un vigente activo en esa cadena, así que este pasa a serlo.
                  rolNuevo = "vigente";
                  mensaje = "Expediente creado y concatenado como Vigente de la cadena de " + match.exp;
                }
              }
            }

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
            if (!res.ok) { mostrarToast("No se pudo crear el expediente"); return; }
            await refrescar();
            setFormAbierto(null);
            mostrarToast(mensaje);
          }}
        />
      )}

      {formAbierto === "editar" && seleccionado && (
        <FormularioExpediente
          titulo={"Editar " + seleccionado.exp}
          inicial={seleccionado}
          expedientes={expedientes}
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
          onCerrar={() => setFormAbierto(null)}
          onConfirmar={() => crearRenovacion(seleccionado)}
        />
      )}
    </div>
  );
}


