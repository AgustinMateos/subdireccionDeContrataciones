import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionCuadroIyV } from "@/lib/cuadroIyVServidor";
import { unirMotivos, resolucionConvDeTipo } from "@/lib/resolucionConv";

// Para el análisis del Cuadro de Informática y Varios, lo que dice
// Resoluciones de cada N° de expediente (NN-NNNNN/AAAA):
// `resoluciones`: { [numero]: { valor, enTramite } } cómo terminó la
// convocatoria según el tipo de resolución del último paso por el sector
// que lo dice (ADJUDICAR → Adjudicada, FRACASAR → Fracasada...);
// `enTramite`: ese paso todavía no está finalizado.
// `motivos`: { [numero]: "Sin ofertas; Otro" } los motivos de no
// adjudicación (de todos los pasos).
const numeros = t => String(t || "").match(/\d{2}-\d{4,6}\/\d{4}/g) || [];

export async function GET() {
  if (!(await sesionCuadroIyV())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const lista = await prisma.expedienteResolucion.findMany({
    where: { esEscrito: false },
    select: { exp: true, tipoResolucion: true, situacion: true, motivoNoAdjudicacion: true },
    orderBy: { fechaIngreso: "asc" },
  });
  const resoluciones = {}, porNumero = {};
  for (const r of lista) {
    const valor = resolucionConvDeTipo(r.tipoResolucion);
    for (const n of new Set(numeros(r.exp))) {
      // En orden de ingreso: queda el último paso que dice cómo terminó.
      if (valor) resoluciones[n] = { valor, enTramite: r.situacion !== "FINALIZADO" };
      if (r.motivoNoAdjudicacion) porNumero[n] = [...(porNumero[n] || []), ...r.motivoNoAdjudicacion.split(";")];
    }
  }
  const motivos = {};
  for (const [n, ms] of Object.entries(porNumero)) { const m = unirMotivos(ms); if (m) motivos[n] = m; }
  return NextResponse.json({ resoluciones, motivos });
}
