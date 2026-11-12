import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizarExp } from "@/lib/numeroExpediente";
import { puedeEditar, puedeEliminar, sesionCuadroIyV } from "@/lib/cuadroIyVServidor";

// Nueva observación en el historial de un N° de expediente (`clave`: el N°
// del bloque, o la clave de la fila si el bloque todavía no tiene N°).
export async function POST(request) {
  const session = await sesionCuadroIyV();
  if (!session || !puedeEditar(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { clave, texto } = await request.json();
  const t = String(texto || "").replace(/\r\n/g, "\n").trim();
  const c = String(clave || "").trim();
  if (!c || !t) return NextResponse.json({ error: "Escribí la observación" }, { status: 400 });
  const observacion = await prisma.observacionIyV.create({
    data: { clave: c.startsWith("fila:") ? c : normalizarExp(c), texto: t, usuario: session.user.name },
  });
  return NextResponse.json({ observacion });
}

// Borrar una observación: el jefe de departamento o Soporte.
export async function DELETE(request) {
  const session = await sesionCuadroIyV();
  if (!session || !puedeEliminar(session)) return NextResponse.json({ error: "Solo el jefe de departamento o Soporte pueden borrar observaciones" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id");
  await prisma.observacionIyV.delete({ where: { id: String(id) } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
