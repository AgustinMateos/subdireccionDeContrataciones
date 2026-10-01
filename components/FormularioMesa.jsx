"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ZONAS, MODALIDADES_CONTRATACION } from "@/lib/constants";
import { direccionesDe } from "@/lib/organismosFueros";
import { fechaISO, hoyLocalISO, SECTORES_TRAMITA, TIPOS_POR_SECTOR_TRAMITA } from "@/lib/mesaEntradas";
import { Campo_Input, Campo_Select } from "./CamposFormulario";
import SelectorOrganismos from "./SelectorOrganismos";
import CampoFuero from "./CampoFuero";
import CampoDomiciliosRenglones from "./CampoDomiciliosRenglones";
import BotonAccion from "./BotonAccion";

// Input de texto libre con sugerencias (datalist).
export function CampoSugerido({ label, value, onChange, opciones, id, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input list={id} value={value ?? ""} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
      <datalist id={id}>
        {opciones.map(o => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}

function formDesde(inicial) {
  return {
    exp: inicial?.exp || "",
    objeto: inicial?.objeto || "",
    agente: inicial?.agente || "",
    sectorTramita: inicial?.sectorTramita || "",
    tipo: inicial?.tipo || "",
    tipoContratacion: inicial?.tipoContratacion || "",
    zona: inicial?.zona || "",
    fuero: inicial?.fuero || [],
    organismos: inicial?.organismos || [],
    domiciliosRenglones: inicial?.domiciliosRenglones || [],
    fechaInicio: fechaISO(inicial?.fechaInicio),
    fechaVencimiento: fechaISO(inicial?.fechaVencimiento),
    ingresoSubdireccion: fechaISO(inicial?.ingresoSubdireccion),
    wd: inicial?.wd || "",
    r: inicial?.r || "",
  };
}

// Caratular (alta, con el primer ingreso) o editar la carátula de un
// expediente de Mesa de Entradas. Los movimientos posteriores se registran
// desde el detalle del expediente.
export default function FormularioMesa({ inicial, sectores, onCerrar, onGuardar }) {
  const esNuevo = !inicial;
  const [f, setF] = useState(() => formDesde(inicial));
  const [ingreso, setIngreso] = useState({ fecha: hoyLocalISO(), vieneDe: "", sector: "", subsector: "", observacion: "" });
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  function set(campo, valor) { setF(prev => ({ ...prev, [campo]: valor })); setError(""); }

  // El tipo depende del sector que tramita: si el sector tiene su lista
  // (ej. SERVICIOS), se elige de ahí; si no, es texto libre.
  const tiposDelSector = TIPOS_POR_SECTOR_TRAMITA[f.sectorTramita] || null;
  function cambiarSectorTramita(valor) {
    const tipos = TIPOS_POR_SECTOR_TRAMITA[valor];
    setF(prev => ({ ...prev, sectorTramita: valor, tipo: tipos && !tipos.includes(prev.tipo) ? "" : prev.tipo }));
    setError("");
  }
  // Un valor viejo que no está en la lista (ej. importado de la planilla)
  // se sigue mostrando para no perderlo al editar.
  const opcionesSector = ["", ...SECTORES_TRAMITA, ...(f.sectorTramita && !SECTORES_TRAMITA.includes(f.sectorTramita) ? [f.sectorTramita] : [])];
  function setIng(campo, valor) { setIngreso(prev => ({ ...prev, [campo]: valor })); setError(""); }

  async function guardar() {
    if (!f.exp.trim() || !f.objeto.trim()) { setError("Completá N° de expediente y objeto."); return; }
    if (!f.sectorTramita) { setError("Elegí el sector que tramita."); return; }
    if (f.fechaInicio && f.fechaVencimiento && f.fechaVencimiento < f.fechaInicio) {
      setError("El vencimiento no puede ser anterior al inicio."); return;
    }
    if (esNuevo && (!ingreso.fecha || !ingreso.sector.trim())) {
      setError("Completá la fecha de ingreso y el sector."); return;
    }
    setGuardando(true);
    const res = await onGuardar(esNuevo ? { ...f, ingreso } : f);
    setGuardando(false);
    if (res?.error) setError(res.error);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={guardando ? undefined : onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-base font-semibold text-slate-900">{esNuevo ? "Caratular expediente" : "Editar expediente " + inicial.exp}</h2>
          <button onClick={onCerrar} disabled={guardando} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <Campo_Input label="Objeto (carátula)" value={f.objeto} onChange={v => set("objeto", v)} />
          <div className="grid grid-cols-3 gap-4">
            <Campo_Input label="N° de expediente" value={f.exp} onChange={v => set("exp", v)} placeholder="13-00000/26" />
            <Campo_Input label="Agente" value={f.agente} onChange={v => set("agente", v)} placeholder="CB" />
            <Campo_Select label="Sector que tramita" value={f.sectorTramita} onChange={cambiarSectorTramita}
              opciones={opcionesSector} labels={{ "": "— Seleccionar —" }} />

            {tiposDelSector ? (
              <Campo_Select label="Tipo" value={f.tipo} onChange={v => set("tipo", v)}
                opciones={["", ...tiposDelSector, ...(f.tipo && !tiposDelSector.includes(f.tipo) ? [f.tipo] : [])]} labels={{ "": "— Seleccionar —" }} />
            ) : (
              <Campo_Input label="Tipo" value={f.tipo} onChange={v => set("tipo", v)} />
            )}
            <CampoSugerido label="Tipo de contratación" id="mesa-tipo-contratacion" value={f.tipoContratacion} onChange={v => set("tipoContratacion", v)} opciones={MODALIDADES_CONTRATACION} />
            <Campo_Select label="Zona" value={f.zona} onChange={v => set("zona", v)} opciones={["", ...ZONAS]} labels={{ "": "— Sin definir —" }} />

            <Campo_Input label="Fecha de inicio" type="date" value={f.fechaInicio} onChange={v => set("fechaInicio", v)} />
            <Campo_Input label="Fecha de vencimiento" type="date" value={f.fechaVencimiento} onChange={v => set("fechaVencimiento", v)} />
            <Campo_Input label="Ingreso a la Subdirección" type="date" value={f.ingresoSubdireccion} onChange={v => set("ingresoSubdireccion", v)} />

            <div className="col-span-3">
              <CampoFuero id="mesa-lista-fueros" fueros={f.fuero} onChange={v => set("fuero", v)} />
            </div>
            <div className="col-span-3">
              <SelectorOrganismos id="mesa-lista-organismos" organismos={f.organismos} onChange={v => set("organismos", v)} />
            </div>
            <div className="col-span-3">
              <CampoDomiciliosRenglones
                id="mesa-domicilios"
                valores={f.domiciliosRenglones}
                onChange={v => set("domiciliosRenglones", v)}
                sugeridos={direccionesDe(f.fuero)}
              />
            </div>

            <Campo_Input label="WD" value={f.wd} onChange={v => set("wd", v)} />
            <Campo_Input label="R" value={f.r} onChange={v => set("r", v)} />
          </div>

          {esNuevo && (
            <div className="border border-slate-200 rounded-md p-4 bg-slate-50 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingreso</h3>
              <div className="grid grid-cols-4 gap-4">
                <Campo_Input label="Fecha de ingreso" type="date" value={ingreso.fecha} onChange={v => setIng("fecha", v)} />
                <CampoSugerido label="Viene del sector" id="mesa-ing-viene" value={ingreso.vieneDe} onChange={v => setIng("vieneDe", v)} opciones={sectores} />
                <CampoSugerido label="Sector" id="mesa-ing-sector" value={ingreso.sector} onChange={v => setIng("sector", v)} opciones={sectores} />
                <CampoSugerido label="Subsector" id="mesa-ing-subsector" value={ingreso.subsector} onChange={v => setIng("subsector", v)} opciones={sectores} />
              </div>
              <Campo_Input label="Observaciones" value={ingreso.observacion} onChange={v => setIng("observacion", v)} />
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <button onClick={onCerrar} disabled={guardando} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
            Cancelar
          </button>
          <BotonAccion onClick={guardar} cargando={guardando}
            className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
            {esNuevo ? "Caratular" : "Guardar cambios"}
          </BotonAccion>
        </div>
      </div>
    </div>
  );
}
