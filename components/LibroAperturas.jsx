"use client";

import { useState, useMemo } from "react";
import { Plus, X, BookOpen } from "lucide-react";
import { TIPOS_CONTRATACION_LIBRO, TIPOS_SIN_APERTURA, HORARIOS_APERTURA, TOTAL_ANUAL_LIBRO, CONTRATACIONES_INICIALES, FERIADOS_2026, HOY } from "@/lib/constants";
import { esDiaHabilLibro, horariosOcupadosEnFecha, proximaAperturaLibreLibro, proximosSlotsLibro, requiereApertura, fmtFecha } from "@/lib/utils";

const HOY_ISO = HOY.getFullYear() + "-" + String(HOY.getMonth() + 1).padStart(2, "0") + "-" + String(HOY.getDate()).padStart(2, "0");

export default function LibroAperturas({ sesion, mostrarToast }) {
  const [contrataciones, setContrataciones] = useState(CONTRATACIONES_INICIALES);
  const [busqueda, setBusqueda] = useState("");
  const [organismoFiltro, setOrganismoFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [formAbierto, setFormAbierto] = useState(false);
  const [aEliminar, setAEliminar] = useState(null);
  const [feriadosTexto] = useState(FERIADOS_2026.join(", "));

  const puedeEditar = sesion.rol === "admin" || sesion.rol === "operador";
  const feriadosSet = useMemo(() => new Set(feriadosTexto.split(",").map(f => f.trim())), [feriadosTexto]);

  const filtradas = useMemo(() => {
    return contrataciones.filter(c => {
      if (organismoFiltro && !c.organismo.toLowerCase().includes(organismoFiltro.toLowerCase())) return false;
      if (tipoFiltro !== "Todos" && c.tipo !== tipoFiltro) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        if (!c.expte.toLowerCase().includes(q) && !c.objeto.toLowerCase().includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.anio - a.anio) || (b.numeroOrden - a.numeroOrden));
  }, [contrataciones, organismoFiltro, tipoFiltro, busqueda]);

  const proximosSlots = useMemo(
    () => proximosSlotsLibro(6, HOY_ISO, contrataciones, feriadosSet),
    [contrataciones, feriadosSet]
  );

  function eliminar(id) {
    setContrataciones(prev => prev.filter(c => c.id !== id));
    setAEliminar(null);
    mostrarToast("Contratación eliminada. Su número y su fecha/hora quedan libres.");
  }

  return (
    <div className="grid lg:grid-cols-[1fr_280px] gap-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen size={18} className="text-slate-500" /> Libro de Aperturas
            </h2>
            <p className="text-xs text-slate-500">Registro secuencial de aperturas de contrataciones públicas</p>
          </div>
          {puedeEditar && (
            <button onClick={() => setFormAbierto(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-slate-900 text-white text-xs font-medium hover:bg-slate-800">
              <Plus size={14} /> Nueva contratación
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-3">
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por expediente u objeto..."
            className="flex-1 min-w-[200px] text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          <input value={organismoFiltro} onChange={e => setOrganismoFiltro(e.target.value)} placeholder="Filtrar por organismo..."
            className="flex-1 min-w-[180px] text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          <select value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}
            className="text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800">
            <option value="Todos">Todos los tipos</option>
            {TIPOS_CONTRATACION_LIBRO.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {filtradas.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm bg-white border border-slate-200 rounded-xl">
            No hay contrataciones cargadas con los filtros aplicados.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-100">
                    <th className="py-2.5 px-4">N°</th>
                    <th className="py-2.5 px-4">Expte</th>
                    <th className="py-2.5 px-4">Organismo</th>
                    <th className="py-2.5 px-4">Objeto</th>
                    <th className="py-2.5 px-4">Tipo</th>
                    <th className="py-2.5 px-4">Fecha apertura</th>
                    <th className="py-2.5 px-4">Hora</th>
                    {puedeEditar && <th className="py-2.5 px-4 w-16"></th>}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map(c => (
                    <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{c.numeroOrden}/{c.totalAnual}</td>
                      <td className="py-2.5 px-4 font-mono text-xs">{c.expte}</td>
                      <td className="py-2.5 px-4">{c.organismo}</td>
                      <td className="py-2.5 px-4 max-w-xs truncate" title={c.objeto}>{c.objeto}</td>
                      <td className="py-2.5 px-4">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600">{c.tipo}</span>
                      </td>
                      <td className="py-2.5 px-4">{c.fechaApertura ? fmtFecha(c.fechaApertura) : <span className="text-slate-400">Sin apertura</span>}</td>
                      <td className="py-2.5 px-4 font-mono">{c.hora ? c.hora + ":00" : "-"}</td>
                      {puedeEditar && (
                        <td className="py-2.5 px-4">
                          <button onClick={() => setAEliminar(c)} className="text-xs text-red-600 hover:text-red-800 underline">Eliminar</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Próximas aperturas disponibles</h3>
          <div className="space-y-1.5">
            {proximosSlots.map(s => (
              <div key={s.fecha + "-" + s.hora} className="flex items-center justify-between text-xs bg-slate-50 rounded-md px-3 py-2">
                <span className="text-slate-700">{fmtFecha(s.fecha)}</span>
                <span className="font-mono font-semibold text-slate-900">{s.hora}:00</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {formAbierto && (
        <FormularioLibroAperturas
          contrataciones={contrataciones}
          feriadosSet={feriadosSet}
          onCerrar={() => setFormAbierto(false)}
          onGuardar={(nueva) => {
            setContrataciones(prev => [...prev, { ...nueva, id: "ap" + Date.now() }]);
            setFormAbierto(false);
            mostrarToast("Contratación " + nueva.numeroOrden + "/" + nueva.totalAnual + " registrada");
          }}
        />
      )}

      {aEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setAEliminar(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-2">Eliminar contratación</h2>
            <p className="text-sm text-slate-600 mb-4">
              Se eliminará la contratación <span className="font-mono font-medium text-slate-900">{aEliminar.numeroOrden}/{aEliminar.totalAnual}</span> ({aEliminar.expte}).
              Su número y su fecha/hora quedan libres para otra contratación. No se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAEliminar(null)} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Cancelar</button>
              <button onClick={() => eliminar(aEliminar.id)} className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormularioLibroAperturas({ contrataciones, feriadosSet, onCerrar, onGuardar }) {
  const sugerencia = useMemo(() => {
    const anioActual = HOY.getFullYear();
    const ultimo = contrataciones.filter(c => c.anio === anioActual).sort((a, b) => b.numeroOrden - a.numeroOrden)[0];
    const numeroOrden = (ultimo?.numeroOrden || 0) + 1;
    const totalAnual = ultimo?.totalAnual || TOTAL_ANUAL_LIBRO;
    const slot = proximaAperturaLibreLibro(HOY_ISO, contrataciones, feriadosSet);
    return { numeroOrden, totalAnual, fecha: slot?.fecha || "", hora: slot?.hora || null };
  }, [contrataciones, feriadosSet]);

  const [expte, setExpte] = useState("");
  const [organismo, setOrganismo] = useState("");
  const [objeto, setObjeto] = useState("");
  const [tipo, setTipo] = useState(TIPOS_CONTRATACION_LIBRO[0]);
  const [numeroOrden, setNumeroOrden] = useState(sugerencia.numeroOrden);
  const [fecha, setFecha] = useState(sugerencia.fecha);
  const [hora, setHora] = useState(sugerencia.hora);
  const [error, setError] = useState("");

  const necesitaApertura = requiereApertura(tipo);
  const habil = necesitaApertura && fecha ? esDiaHabilLibro(fecha, feriadosSet) : null;
  const ocupadas = necesitaApertura && fecha ? horariosOcupadosEnFecha(fecha, contrataciones) : new Set();
  const numeroYaUsado = contrataciones.some(c => c.anio === 2026 && c.numeroOrden === Number(numeroOrden));

  function cambiarTipo(nuevoTipo) {
    setTipo(nuevoTipo);
    if (!requiereApertura(nuevoTipo)) {
      setFecha("");
      setHora(null);
    } else if (!fecha) {
      setFecha(sugerencia.fecha);
      setHora(sugerencia.hora);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!expte.trim() || !organismo.trim() || !objeto.trim()) {
      setError("Completá expediente, organismo y objeto.");
      return;
    }
    if (necesitaApertura) {
      if (!fecha || !habil) {
        setError("Elegí una fecha de apertura que sea día hábil.");
        return;
      }
      if (!hora || ocupadas.has(hora)) {
        setError("Elegí un horario libre para esa fecha.");
        return;
      }
    }
    if (numeroYaUsado) {
      setError("Ese número de contratación ya está usado este año.");
      return;
    }
    onGuardar({
      anio: 2026,
      numeroOrden: Number(numeroOrden),
      totalAnual: sugerencia.totalAnual,
      expte: expte.trim(),
      organismo: organismo.trim(),
      objeto: objeto.trim(),
      tipo,
      fechaApertura: necesitaApertura ? fecha : null,
      hora: necesitaApertura ? hora : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl my-8">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-base font-semibold text-slate-900">Nueva contratación</h2>
          <button onClick={onCerrar} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Número de contratación</div>
              <div className="text-lg font-mono font-semibold text-slate-900">{numeroOrden}/{sugerencia.totalAnual}</div>
            </div>
            <span className="text-[11px] text-slate-400">Sugerido automáticamente, editable</span>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Campo_Input label="Expediente (EXPTE)" value={expte} onChange={setExpte} placeholder="13-10004/26" />
            <Campo_Input label="Organismo solicitante" value={organismo} onChange={setOrganismo} />
          </div>
          <Campo_Input label="Objeto" value={objeto} onChange={setObjeto} />
          <Campo_Select label="Tipo de contratación" value={tipo} onChange={cambiarTipo} opciones={TIPOS_CONTRATACION_LIBRO} />

          {necesitaApertura ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha de apertura</label>
                <input type="date" value={fecha} onChange={e => { setFecha(e.target.value); setHora(null); }}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
                {fecha && !habil && <p className="text-[11px] text-red-600 mt-1">No es un día hábil (fin de semana o feriado).</p>}
                {fecha && habil && <p className="text-[11px] text-emerald-600 mt-1">Día hábil.</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Horario</label>
                <div className="flex gap-1.5">
                  {HORARIOS_APERTURA.map(h => {
                    const ocupado = habil && ocupadas.has(h);
                    return (
                      <button key={h} type="button" disabled={ocupado} onClick={() => setHora(h)}
                        className={"flex-1 text-sm font-medium rounded-md border px-3 py-2 transition-colors " +
                          (hora === h ? "bg-slate-900 text-white border-slate-900" :
                            ocupado ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed line-through" :
                            "border-slate-300 text-slate-700 hover:border-slate-500")}>
                        {h}:00
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-xs text-slate-500">
              "{tipo}" no tiene acto de apertura formal: no requiere fecha ni horario. Igualmente recibe número
              de contratación dentro de la misma numeración secuencial.
            </div>
          )}

          <div className="w-40">
            <label className="block text-xs font-medium text-slate-600 mb-1">N° de contratación</label>
            <input type="number" value={numeroOrden} onChange={e => setNumeroOrden(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
            {numeroYaUsado && <p className="text-[11px] text-red-600 mt-1">Ese número ya está usado.</p>}
          </div>

          {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button type="button" onClick={onCerrar} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Registrar contratación</button>
          </div>
        </form>
      </div>
    </div>
  );
}

