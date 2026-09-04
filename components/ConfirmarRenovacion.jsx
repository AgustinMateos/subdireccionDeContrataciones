"use client";

export default function ConfirmarRenovacion({ exp, onCerrar, onConfirmar }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onCerrar} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-2">Crear renovación vinculada</h2>
        <p className="text-sm text-slate-600 mb-4">
          Se generará un nuevo expediente de renovación vinculado al vigente
          <span className="font-mono font-medium text-slate-900"> {exp.exp}</span>, y ese expediente pasará a estado
          <span className="font-medium"> "En trámite de renovación"</span>.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCerrar} className="px-4 py-2 rounded-md border border-slate-300 text-sm font-medium hover:bg-slate-50">Cancelar</button>
          <button onClick={onConfirmar} className="px-4 py-2 rounded-md bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            Crear renovación
          </button>
        </div>
      </div>
    </div>
  );
}
