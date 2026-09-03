"use client";

import { useState } from "react";
import { Search, LogOut, ChevronDown, FileText, Landmark, Mic, Shield, Newspaper, BookOpen, Phone, Globe, ExternalLink, User, Contact, FileDown, BarChart3, Building2 } from "lucide-react";
import { descargarArchivoBase64 } from "@/lib/utils";
import { FORMULARIO_FALTAS_BASE64 } from "@/lib/constants";
export default function TopBar({ sesion, onLogout, busqueda, setBusqueda, vista, setVista, mostrarToast }) {
  const [variosAbierto, setVariosAbierto] = useState(false);
  const [informesAbierto, setInformesAbierto] = useState(false);
  const [publicacionesAbierto, setPublicacionesAbierto] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(false);
  const esInformaticaYVarios = sesion.departamentoSlug === "informatica-y-varios";
  const vistasVarios = ["cotizadorTaquigrafico", "cotizadorPolicia", "cotizadorAvisos"];
  const variosActivo = vistasVarios.includes(vista);
  const vistasInformes = esInformaticaYVarios ? ["informePoliciaAdicional", "informeOrganismos"] : ["informeServicios"];
  const informesActivo = vistasInformes.includes(vista);
  const inicialesDepto = (sesion.departamentoNombre || "Informática y Varios")
    .split(/\s+/).filter(p => !["y", "de"].includes(p.toLowerCase())).map(p => p[0]).join("").slice(0, 2).toUpperCase();

  function accederLegajo() {
    setPerfilAbierto(false);
    mostrarToast("Accediendo a tu legajo... (pendiente de conectar con el sistema de RR.HH.)");
  }

  function descargarFormularioFaltas() {
    setPerfilAbierto(false);
    descargarArchivoBase64(FORMULARIO_FALTAS_BASE64, "Formulario_Faltas_Personal.doc", "application/msword");
    mostrarToast("Formulario de faltas descargado");
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 bg-slate-900 text-white rounded flex items-center justify-center font-semibold text-xs">{inicialesDepto}</div>
          <div className="hidden sm:block leading-tight">
            <div className="text-sm font-semibold text-slate-900">{sesion.departamentoNombre || "Informática y Varios"}</div>
            <div className="text-[11px] text-slate-500">Autogestión de expedientes</div>
          </div>
        </div>

        {vista === "expedientes" && (
          <div className="flex-1 max-w-md relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por N° expediente, objeto, adjudicatario u organismo..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:bg-white"
            />
          </div>
        )}
        {vista !== "expedientes" && <div className="flex-1" />}

        <div className="ml-auto flex items-center gap-3 shrink-0">
          <div className="hidden sm:block text-right leading-tight">
            <div className="text-sm font-medium text-slate-900">{sesion.nombre}</div>
            <div className="text-[11px] text-slate-500 uppercase tracking-wide">{sesion.rolLabel}</div>
          </div>
          <button onClick={onLogout} title="Cerrar sesión" className="p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 h-11 border-t border-slate-100 relative">
        <button
          onClick={() => { setVista("expedientes"); setVariosAbierto(false); }}
          className={"h-full px-3 text-xs font-medium border-b-2 transition-colors " +
            (vista === "expedientes" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
        >
          Expedientes
        </button>
        <button
          onClick={() => { setVista("valorModular"); setVariosAbierto(false); }}
          className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 " +
            (vista === "valorModular" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
        >
          <Landmark size={13} /> Valor Modular
        </button>
        {esInformaticaYVarios && (
          <button
            onClick={() => { setVista("libroAperturas"); setVariosAbierto(false); }}
            className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 " +
              (vista === "libroAperturas" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            <BookOpen size={13} /> Libro de Aperturas
          </button>
        )}
        <button
          onClick={() => { setVista("listadoTelefonos"); setVariosAbierto(false); }}
          className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 " +
            (vista === "listadoTelefonos" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
        >
          <Phone size={13} /> Listado de Teléfonos
        </button>
        <button
          onClick={() => { setVista("planillaCotizacion"); setVariosAbierto(false); }}
          className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 " +
            (vista === "planillaCotizacion" ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
        >
          <FileText size={13} /> Planilla
        </button>

        {esInformaticaYVarios && (
          <div className="relative h-full">
            <button
              onClick={() => setVariosAbierto(v => !v)}
              className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 " +
                (variosActivo ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
            >
              Varios <ChevronDown size={13} className={"transition-transform " + (variosAbierto ? "rotate-180" : "")} />
            </button>

            {variosAbierto && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setVariosAbierto(false)} />
                <div className="absolute left-0 top-full mt-0.5 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1.5">
                  <button
                    onClick={() => { setVista("cotizadorTaquigrafico"); setVariosAbierto(false); }}
                    className={"w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 " +
                      (vista === "cotizadorTaquigrafico" ? "text-slate-900 font-medium bg-slate-50" : "text-slate-600")}
                  >
                    <Mic size={14} className="text-slate-400" /> Cotizador taquigráfico
                  </button>
                  <button
                    onClick={() => { setVista("cotizadorPolicia"); setVariosAbierto(false); }}
                    className={"w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 " +
                      (vista === "cotizadorPolicia" ? "text-slate-900 font-medium bg-slate-50" : "text-slate-600")}
                  >
                    <Shield size={14} className="text-slate-400" /> Cotizador policía adicional
                  </button>
                  <button
                    onClick={() => { setVista("cotizadorAvisos"); setVariosAbierto(false); }}
                    className={"w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 " +
                      (vista === "cotizadorAvisos" ? "text-slate-900 font-medium bg-slate-50" : "text-slate-600")}
                  >
                    <Newspaper size={14} className="text-slate-400" /> Cotizador de avisos
                  </button>
                  <div className="px-3 py-2 text-[11px] text-slate-400">Más herramientas del área, próximamente</div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative h-full">
          <button
            onClick={() => setInformesAbierto(v => !v)}
            className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 " +
              (informesActivo ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800")}
          >
            <BarChart3 size={13} /> Informes <ChevronDown size={13} className={"transition-transform " + (informesAbierto ? "rotate-180" : "")} />
          </button>

          {informesAbierto && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setInformesAbierto(false)} />
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1.5">
                {esInformaticaYVarios ? (
                  <>
                    <button
                      onClick={() => { setVista("informePoliciaAdicional"); setInformesAbierto(false); }}
                      className={"w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 " +
                        (vista === "informePoliciaAdicional" ? "text-slate-900 font-medium bg-slate-50" : "text-slate-600")}
                    >
                      <Shield size={14} className="text-slate-400" /> Policía Adicional
                    </button>
                    <button
                      onClick={() => { setVista("informeOrganismos"); setInformesAbierto(false); }}
                      className={"w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 " +
                        (vista === "informeOrganismos" ? "text-slate-900 font-medium bg-slate-50" : "text-slate-600")}
                    >
                      <Building2 size={14} className="text-slate-400" /> Organismos
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setVista("informeServicios"); setInformesAbierto(false); }}
                    className={"w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 " +
                      (vista === "informeServicios" ? "text-slate-900 font-medium bg-slate-50" : "text-slate-600")}
                  >
                    <Building2 size={14} className="text-slate-400" /> Informe de Servicios
                  </button>
                )}
                <div className="px-3 py-2 text-[11px] text-slate-400">Más informes, próximamente</div>
              </div>
            </>
          )}
        </div>

        {esInformaticaYVarios && (
          <div className="relative h-full">
            <button
              onClick={() => setPublicacionesAbierto(v => !v)}
              className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 border-transparent text-slate-500 hover:text-slate-800"}
            >
              <Globe size={13} /> Publicaciones <ChevronDown size={13} className={"transition-transform " + (publicacionesAbierto ? "rotate-180" : "")} />
            </button>

            {publicacionesAbierto && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setPublicacionesAbierto(false)} />
                <div className="absolute left-0 top-full mt-0.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1.5">
                  <a
                    href="https://proveedores-cm.pjn.gov.ar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setPublicacionesAbierto(false)}
                    className="w-full flex items-center justify-between gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600"
                  >
                    <span className="flex items-center gap-2.5"><ExternalLink size={14} className="text-slate-400" /> Proveedores CM (Interno)</span>
                  </a>
                  <a
                    href="https://srpcm.pjn.gov.ar/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setPublicacionesAbierto(false)}
                    className="w-full flex items-center justify-between gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600"
                  >
                    <span className="flex items-center gap-2.5"><ExternalLink size={14} className="text-slate-400" /> SRPCM (Externo)</span>
                  </a>
                </div>
              </>
            )}
          </div>
        )}

        <div className="relative h-full">
          <button
            onClick={() => setPerfilAbierto(v => !v)}
            className={"h-full px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 border-transparent text-slate-500 hover:text-slate-800"}
          >
            <User size={13} /> Mi Perfil <ChevronDown size={13} className={"transition-transform " + (perfilAbierto ? "rotate-180" : "")} />
          </button>

          {perfilAbierto && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setPerfilAbierto(false)} />
              <div className="absolute right-0 top-full mt-0.5 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1.5">
                <button
                  onClick={accederLegajo}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600"
                >
                  <Contact size={14} className="text-slate-400" /> Mi legajo
                </button>
                <button
                  onClick={descargarFormularioFaltas}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs hover:bg-slate-50 text-slate-600"
                >
                  <FileDown size={14} className="text-slate-400" /> Formulario de faltas (.doc)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

