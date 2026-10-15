import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { feriadosDe } from "@/lib/feriados";

// Feriados nacionales de esos años (de ArgentinaDatos, con cache), para
// calcular días hábiles en el navegador: ?anios=2026,2027
export async function GET(request) {
  if (!(await getServerSession(authOptions))) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const anios = (new URL(request.url).searchParams.get("anios") || "").split(",").map(Number)
    .filter(a => Number.isInteger(a) && a >= 2000 && a <= 2100).slice(0, 5);
  if (!anios.length) return NextResponse.json({ error: "Indicá los años (?anios=2026,2027)" }, { status: 400 });
  try {
    return NextResponse.json({ feriados: [...(await feriadosDe(anios))].sort() });
  } catch (err) {
    return NextResponse.json({ error: err.message || "No se pudieron traer los feriados" }, { status: 503 });
  }
}
