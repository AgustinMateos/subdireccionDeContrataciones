import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionCuadroIyV } from "@/lib/cuadroIyVServidor";
import { unirMotivos } from "@/lib/resolucionConv";

// Para el análisis del Cuadro de Informática y Varios: los motivos de no
// adjudicación que cargó Resoluciones, por N° de expediente (NN-NNNNN/AAAA,
// de todos los pasos por el sector). → { motivos: { [numero]: "Sin ofertas; Otro" } }
const numeros = t => String(t || "").match(/\d{2}-\d{4,6}\/\d{4}/g) || [];

export async function GET() {
  if (!(await sesionCuadroIyV())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const resoluciones = await prisma.expedienteResolucion.findMany({
    where: { motivoNoAdjudicacion: { not: null } },
    select: { exp: true, motivoNoAdjudicacion: true },
  });
  const porNumero = {};
  for (const r of resoluciones) for (const n of new Set(numeros(r.exp))) {
    porNumero[n] = [...(porNumero[n] || []), ...String(r.motivoNoAdjudicacion || "").split(";")];
  }
  const motivos = {};
  for (const [n, lista] of Object.entries(porNumero)) { const m = unirMotivos(lista); if (m) motivos[n] = m; }
  return NextResponse.json({ motivos });
}
