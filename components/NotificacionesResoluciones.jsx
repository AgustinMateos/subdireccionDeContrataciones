"use client";

import { useEffect, useState } from "react";
import { Bell, ArrowRight } from "lucide-react";
import { fmtFechaHora } from "@/lib/utils";

const CADA_MS = 60000; // se consulta cada minuto

// "2026-10-09T14:05:00.000Z" → "9/10/2026 11:05" en la hora del navegador.
function cuando(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, "0");
  return fmtFechaHora(d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes()));
}

// Campana de avisos de Resoluciones: lo que la jefa de la Subdirección
// cargó, modificó, reasignó o marcó como prioritario.
export default function NotificacionesResoluciones() {
  const [datos, setDatos] = useState({ notificaciones: [], noLeidas: 0 });
  const [abierto, setAbierto] = useState(false);

  async function cargar() {
    try {
      const res = await fetch("/api/resoluciones/notificaciones");
      if (res.ok) setDatos(await res.json());
    } catch {
      // Sin conexión: se reintenta en la próxima vuelta.
    }
  }

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, CADA_MS);
    return () => clearInterval(t);
  }, []);

  async function marcar(body) {
    await fetch("/api/resoluciones/notificaciones", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    cargar();
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setAbierto(v => !v); if (!abierto) cargar(); }}
        title="Avisos de la jefa de la Subdirección"
        className="relative p-2 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-600"
      >
        <Bell size={16} />
        {datos.noLeidas > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
            {datos.noLeidas > 99 ? "99+" : datos.noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-full mt-2 w-[420px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-30">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
              <span className="text-sm font-semibold text-slate-900">Avisos de la Subdirección</span>
              {datos.noLeidas > 0 && (
                <button onClick={() => marcar({ todas: true })} className="text-[11px] font-medium text-slate-500 hover:text-slate-900">
                  Marcar todos como leídos
                </button>
              )}
            </div>
            {datos.notificaciones.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No hay avisos.</p>
            ) : (
              <ul>
                {datos.notificaciones.map(n => (
                  <li
                    key={n.id}
                    onClick={() => !n.leida && marcar({ ids: [n.id] })}
                    className={"px-4 py-3 border-b border-slate-50 last:border-0 " + (n.leida ? "" : "bg-blue-50/50 cursor-pointer hover:bg-blue-50")}
                  >
                    <div className="flex items-center gap-2">
                      {!n.leida && <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Sin leer" />}
                      <span className="font-mono text-xs font-semibold text-slate-900">{n.exp}</span>
                      {n.prioritario && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-800">Prioritario</span>
                      )}
                      <span className="ml-auto text-[11px] text-slate-400 whitespace-nowrap">{cuando(n.creadoEn)}</span>
                    </div>
                    {n.objeto && <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">{n.objeto}</p>}
                    <p className="text-[11px] text-slate-500 mt-1">
                      {n.creadoPor} {n.accion === "alta" ? "cargó este expediente" : "modificó:"}
                    </p>
                    {(n.cambios || []).length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {n.cambios.map((c, i) => (
                          <li key={i} className="text-xs text-slate-700 flex flex-wrap items-center gap-1">
                            <span className="text-slate-500">{c.campo}:</span>
                            {n.accion !== "alta" && <><span className="line-through text-slate-400">{c.anterior || "vacío"}</span><ArrowRight size={11} className="text-slate-400" /></>}
                            <span className="font-medium">{c.nuevo || "vacío"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
