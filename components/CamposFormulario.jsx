"use client";

// Campos de formulario compartidos entre FormularioExpediente y CaratularExpediente.

export function Campo_Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
    </div>
  );
}

export function Campo_Select({ label, value, onChange, opciones, labels, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-slate-800 disabled:bg-slate-100 disabled:text-slate-500">
        {opciones.map(o => <option key={o} value={o}>{labels && labels[o] != null ? labels[o] : o}</option>)}
      </select>
    </div>
  );
}
