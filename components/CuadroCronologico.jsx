"use client";

// Cuadro cronológico estimativo por procedimiento (referencia del sector
// de Resoluciones).

const ETAPAS = [
  "Difusión / Invitación", "Consultas Pliego", "Apertura", "Dictamen / Preselección", "Impugnaciones",
  "Adjudicación", "Orden de Compra", "Firma Contrato (en caso de corresponder)", "Garantía", "Recepción", "Pago",
];

// Después de la apertura, todos los procedimientos tienen los mismos plazos
// salvo la etapa múltiple.
const POSTERIORES = ["10 días", "5 días", "3 días", "10 días", "10 días (+3 días)", "5 días", "10 días", "30 días"];

const PROCEDIMIENTOS = [
  { nombre: "Público (> $10M)", plazos: ["Publicación 2 días, 20 días antes de apertura", "Hasta 10 días", "Fecha apertura", ...POSTERIORES] },
  { nombre: "Público (≤ $10M)", plazos: ["Publicación 5 días, 20 días antes de apertura", "Hasta 10 días", "Fecha apertura", ...POSTERIORES] },
  { nombre: "Privado", plazos: ["Invitación: al menos 7 días antes de apertura, a 6 proveedores", "DOS (2) días antes de apertura", "Fecha apertura", ...POSTERIORES] },
  { nombre: "Internacional", plazos: ["40 días", "DOS (2) días antes de apertura", "Fecha apertura", ...POSTERIORES] },
  { nombre: "Directa (monto / desierta)", plazos: ["Invitaciones a por lo menos TRES (3) proveedores inscriptos — 3 días", "DOS (2) días antes de apertura", "Fecha apertura", ...POSTERIORES] },
  { nombre: "Etapa múltiple", plazos: ["Según convocatoria", "2+2 días", "Apertura técnica", "5 días", "2 días", "3 días", "10 días", "10 días (+3 días)", "5 días", "10 días", "30 días"] },
];

export default function CuadroCronologico() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-sm font-semibold text-slate-900">Cuadro cronológico estimativo por procedimiento</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[1250px]">
          <thead>
            <tr className="text-left border-b border-slate-200 bg-slate-50/40 text-[11px] font-semibold text-slate-600">
              <th className="py-2 px-3 sticky left-0 bg-slate-50">Procedimiento</th>
              {ETAPAS.map(e => <th key={e} className="py-2 px-3 align-bottom">{e}</th>)}
            </tr>
          </thead>
          <tbody>
            {PROCEDIMIENTOS.map(p => (
              <tr key={p.nombre} className="border-b border-slate-100 last:border-0 align-top">
                <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap sticky left-0 bg-white">{p.nombre}</td>
                {p.plazos.map((plazo, i) => <td key={i} className="py-2.5 px-3 text-slate-700 max-w-[200px]">{plazo}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
