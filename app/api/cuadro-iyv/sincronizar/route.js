import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionCuadroIyV, sincronizarConResoluciones } from "@/lib/cuadroIyVServidor";

// Completa los últimos movimientos (y sectores) del cuadro con los de
// Resoluciones. Lo pide el panel al abrirse; devuelve las filas que cambiaron.
export async function POST() {
  if (!(await sesionCuadroIyV())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const filas = await sincronizarConResoluciones(prisma);
  return NextResponse.json({ filas });
}
