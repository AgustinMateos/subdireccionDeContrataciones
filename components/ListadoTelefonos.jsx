"use client";

import { useState, useMemo } from "react";
import { Plus, Lock, Trash2, Phone } from "lucide-react";
import { TELEFONOS_INICIALES } from "@/lib/constants";
export default function ListadoTelefonos({ sesion, mostrarToast, seccionesIniciales }) {
  const [secciones, setSecciones] = useState(
    seccionesIniciales && seccionesIniciales.length > 0 ? seccionesIniciales : TELEFONOS_INICIALES
  );
  const [busqueda, setBusqueda] = useState("");
  const puedeEditar = sesion.rol === "soporte";

  function actualizarPersona(seccionId, grupoIdx, personaIdx, campo, valor) {
    setSecciones(prev => prev.map(s => {
      if (s.id !== seccionId) return s;
      const grupos = s.grupos.map((g, gi) => {
        if (gi !== grupoIdx) return g;
        const personas = g.personas.map((p, pi) => pi === personaIdx ? { ...p, [campo]: valor } : p);
        return { ...g, personas };
      });
      return { ...s, grupos };
    }));
  }

  function agregarPersona(seccionId, grupoIdx) {
    setSecciones(prev => prev.map(s => {
      if (s.id !== seccionId) return s;
      const grupos = s.grupos.map((g, gi) => gi === grupoIdx ? { ...g, personas: [...g.personas, { nombre: "", interno: "" }] } : g);
      return { ...s, grupos };
    }));
  }

  function quitarPersona(seccionId, grupoIdx, personaIdx) {
    setSecciones(prev => prev.map(s => {
      if (s.id !== seccionId) return s;
      const grupos = s.grupos.map((g, gi) => gi === grupoIdx ? { ...g, personas: g.personas.filter((_, pi) => pi !== personaIdx) } : g);
      return { ...s, grupos };
    }));
    mostrarToast("Contacto eliminado");
  }

  const seccionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return secciones;
    const q = busqueda.trim().toLowerCase();
    return secciones
      .map(s => ({
        ...s,
        grupos: s.grupos
          .map(g => ({ ...g, personas: g.personas.filter(p => p.nombre.toLowerCase().includes(q) || p.interno.includes(q)) }))
          .filter(g => g.personas.length > 0),
      }))
      .filter(s => s.grupos.length > 0);
  }, [secciones, busqueda]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Phone size={18} className="text-slate-500" /> Listado de Teléfonos
          </h2>
          <p className="text-xs text-slate-500">Subdirección de Contrataciones · internos por sección</p>
        </div>
        {puedeEditar ? (
          <span className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-1.5">
            Edición habilitada (usuario Soporte)
          </span>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
            <Lock size={13} /> Solo el usuario de Soporte puede editar este listado
          </div>
        )}
      </div>

      <input
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o interno..."
        className="w-full sm:w-80 text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800"
      />

      <div className="space-y-4">
        {seccionesFiltradas.map(s => (
          <div key={s.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {s.titulo && (
              <div className="bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 border-b border-slate-200">
                {s.titulo}
              </div>
            )}
            <div className="divide-y divide-slate-50">
              {s.grupos.map((g, gi) => (
                <div key={g.rotulo} className="flex flex-col sm:flex-row">
                  <div className="sm:w-52 shrink-0 px-4 py-3 text-xs font-semibold text-slate-700 bg-slate-50/60 sm:border-r border-slate-100">
                    {g.rotulo}
                  </div>
                  <div className="flex-1 px-4 py-2">
                    {g.personas.map((p, pi) => (
                      <div key={pi} className="flex items-center gap-2 py-1">
                        <input
                          value={p.nombre}
                          disabled={!puedeEditar}
                          onChange={e => actualizarPersona(s.id, gi, pi, "nombre", e.target.value)}
                          placeholder="Nombre"
                          className={"flex-1 text-sm rounded px-2 py-1 " + (puedeEditar ? "border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-800" : "border-0 bg-transparent text-slate-700")}
                        />
                        <input
                          value={p.interno}
                          disabled={!puedeEditar}
                          onChange={e => actualizarPersona(s.id, gi, pi, "interno", e.target.value)}
                          placeholder="Interno"
                          className={"w-20 text-sm font-mono text-right rounded px-2 py-1 " + (puedeEditar ? "border border-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-800" : "border-0 bg-transparent text-slate-700")}
                        />
                        {puedeEditar && (
                          <button onClick={() => quitarPersona(s.id, gi, pi)} className="text-slate-300 hover:text-red-600">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    {puedeEditar && (
                      <button onClick={() => agregarPersona(s.id, gi)} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 mt-1">
                        <Plus size={11} /> Agregar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {seccionesFiltradas.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400 bg-white border border-slate-200 rounded-xl">
            No se encontraron contactos para "{busqueda}".
          </div>
        )}
      </div>
    </div>
  );
}

