"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setCargando(true);

    const res = await signIn("credentials", {
      email: email.trim(),
      password: password.trim(),
      redirect: false,
    });

    setCargando(false);

    if (res?.error) {
      setError("Email o contraseña incorrectos.");
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-slate-50">
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 text-slate-50 p-14">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 border-2 border-blue-400 rounded flex items-center justify-center font-semibold text-sm">SC</div>
          <span className="text-xs tracking-[0.2em] uppercase text-slate-400">Poder Judicial · Consejo de la Magistratura</span>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400 mb-5">
            Expediente 01 Antecedente — 02 Vigente — 03 Renovación
          </p>
          <h1 className="text-4xl font-semibold leading-tight mb-6">
            Subdirección de Contrataciones
          </h1>
          <p className="text-slate-300 text-base leading-relaxed max-w-md">
            Autogestión de expedientes de contrataciones de los departamentos de Informática y Varios,
            y de Servicios, con trazabilidad completa desde el antecedente hasta la renovación en trámite.
          </p>
        </div>
        {/* <div className="flex gap-10 pt-8 border-t border-slate-700 text-sm">
          <div><div className="text-2xl font-semibold">Informática</div><div className="text-slate-400">Área técnica</div></div>
          <div><div className="text-2xl font-semibold">Varios</div><div className="text-slate-400">Área administrativa</div></div>
        </div> */}
      </div>

      <div className="flex items-center justify-center p-6 sm:p-14">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold text-slate-900 mb-1">Ingresar al sistema</h2>
          <p className="text-sm text-slate-600 mb-8">Accedé con tu email institucional y contraseña.</p>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-600 mb-1.5">Email</label>
              <input type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="usuario@pj.gob.ar"
                autoComplete="off" autoCapitalize="off" spellCheck="false"
                className="w-full rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-600 mb-1.5">Contraseña</label>
              {/* El ojo muestra u oculta lo escrito. */}
              <div className="relative">
                <input type={verPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  autoComplete="off" autoCapitalize="off" spellCheck="false"
                  className="w-full rounded-md border border-slate-300 bg-white pl-3.5 pr-11 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-800" />
                <button type="button" onClick={() => setVerPassword(v => !v)}
                  aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"} title={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-900 rounded-r-md focus:outline-none focus:ring-2 focus:ring-slate-800">
                  {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>}
            <button type="submit" disabled={cargando} className="w-full rounded-md bg-slate-900 text-white text-sm font-medium py-2.5 hover:bg-slate-800 transition-colors disabled:opacity-60">
              {cargando ? "Ingresando..." : "Ingresar"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

