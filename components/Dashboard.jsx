"use client";

import { useState, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { CheckCircle2 } from "lucide-react";

import { EXPEDIENTES, HOY } from "@/lib/constants";
import { diasRestantes, alerta, documentacionDeExpediente } from "@/lib/utils";

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
  const [expedientes, setExpedientes] = useState(EXPEDIENTES);
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

  function guardarObservacion(id, entrada) {
    // entrada: { tipo: "general" | "movimiento", texto, sectorNuevo? }
    setExpedientes(prev => prev.map(e => {
      if (e.id !== id) return e;
      const esMovimiento = entrada.tipo === "movimiento";
      const nuevaEntrada = {
        fecha: "2026-08-19",
        usuario: sesion.nombre,
        tipo: entrada.tipo,
        texto: entrada.texto,
        ...(esMovimiento ? { sectorAnterior: e.sector, sectorNuevo: entrada.sectorNuevo } : {}),
      };
      return {
        ...e,
        sector: esMovimiento ? entrada.sectorNuevo : e.sector,
        etapa: esMovimiento ? ("En " + entrada.sectorNuevo) : e.etapa,
        observaciones: [...e.observaciones, nuevaEntrada],
      };
    }));
    setSeleccionado(prev => {
      if (!prev || prev.id !== id) return prev;
      const esMovimiento = entrada.tipo === "movimiento";
      const nuevaEntrada = {
        fecha: "2026-08-19",
        usuario: sesion.nombre,
        tipo: entrada.tipo,
        texto: entrada.texto,
        ...(esMovimiento ? { sectorAnterior: prev.sector, sectorNuevo: entrada.sectorNuevo } : {}),
      };
      return {
        ...prev,
        sector: esMovimiento ? entrada.sectorNuevo : prev.sector,
        etapa: esMovimiento ? ("En " + entrada.sectorNuevo) : prev.etapa,
        observaciones: [...prev.observaciones, nuevaEntrada],
      };
    });
    mostrarToast(entrada.tipo === "movimiento" ? "Movimiento cargado, sector actualizado" : "Observación agregada");
  }

  function eliminarExpediente(id) {
    setExpedientes(prev => prev.filter(e => e.id !== id));
    setSeleccionado(null);
    setVista("expedientes");
    mostrarToast("Expediente eliminado");
  }

  function toggleDocumentacion(id, indice) {
    function actualizar(e) {
      const doc = documentacionDeExpediente(e);
      const nuevoDoc = doc.map((d, i) => i === indice ? { ...d, cargado: !d.cargado } : d);
      return { ...e, documentacion: nuevoDoc };
    }
    setExpedientes(prev => prev.map(e => e.id === id ? actualizar(e) : e));
    setSeleccionado(prev => prev && prev.id === id ? actualizar(prev) : prev);
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
    const nuevaEntrada = {
      fecha: "2026-08-19",
      usuario: sesion.nombre,
      tipo: "general",
      texto,
    };
    setExpedientes(prev => prev.map(e => e.id === match.id
      ? { ...e, observaciones: [...e.observaciones, nuevaEntrada] }
      : e));
    setSeleccionado(prev => prev && prev.id === match.id
      ? { ...prev, observaciones: [...prev.observaciones, nuevaEntrada] }
      : prev);
    mostrarToast("Vinculado al expediente " + match.exp);
    return true;
  }

  function crearRenovacion(vigente) {
    const nuevoId = "e" + Date.now();
    const nuevo = {
      ...vigente,
      id: nuevoId,
      rol: "renovacion",
      exp: "13-0" + String(Math.floor(Math.random() * 9000) + 1000) + "/26",
      estadoGeneral: "En trámite de renovación",
      etapa: "En trámite - carátula inicial",
      observaciones: [],
    };
    setExpedientes(prev => [...prev.map(e => e.id === vigente.id ? { ...e, estadoGeneral: "En trámite de renovación" } : e), nuevo]);
    setSeleccionado(nuevo);
    setFormAbierto(null);
    mostrarToast("Renovación creada y vinculada a " + vigente.exp);
  }

  // El contrato anterior vence y la renovación pasa a ser el nuevo Vigente.
  function activarRenovacion(renovacion) {
    const vigenteAnterior = expedientes.find(e => e.cadenaId === renovacion.cadenaId && e.rol === "vigente");
    setExpedientes(prev => prev.map(e => {
      if (vigenteAnterior && e.id === vigenteAnterior.id) {
        return { ...e, rol: "antecedente", estadoGeneral: "Finalizado", etapa: "Finalizado" };
      }
      if (e.id === renovacion.id) {
        return { ...e, rol: "vigente", estadoGeneral: "Vigente", etapa: "En ejecución" };
      }
      return e;
    }));
    setSeleccionado(prev => prev && prev.id === renovacion.id
      ? { ...prev, rol: "vigente", estadoGeneral: "Vigente", etapa: "En ejecución" }
      : prev);
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
          onGuardar={(datos) => {
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

            const nuevo = {
              ...resto,
              antecedenteRef: antecedenteExp || "",
              id: "e" + Date.now(),
              cadenaId,
              rol: rolNuevo,
              estadoGeneral: rolNuevo === "renovacion" ? "En trámite de renovación" : resto.estadoGeneral,
              observaciones: [],
            };

            setExpedientes(prev => {
              const actualizados = idVigenteAActualizar
                ? prev.map(e => e.id === idVigenteAActualizar ? { ...e, estadoGeneral: "En trámite de renovación" } : e)
                : prev;
              return [...actualizados, nuevo];
            });
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
          onGuardar={(datos) => {
            setExpedientes(prev => prev.map(e => e.id === seleccionado.id ? { ...e, ...datos } : e));
            setSeleccionado(prev => ({ ...prev, ...datos }));
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


