import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOJAS_IYV, datosFilaIyV } from "@/lib/cuadroIyV";
import { INCLUDE_FILA_IYV, puedeEditar, puedeEliminar, registrosDeCambiosIyV, sesionCuadroIyV } from "@/lib/cuadroIyVServidor";

// Cambios de una fila. `datos`: los campos que cambian (los que vienen
// vacíos se borran). `hoja`: pasarla a otra solapa (ej. a Antecedentes);
// los campos que la nueva solapa no tiene se pierden, así que solo se
// permite entre solapas con los mismos campos o hacia Antecedentes desde
// Servicios.
export async function PATCH(request, { params }) {
  const session = await sesionCuadroIyV();
  if (!session || !puedeEditar(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const actual = await prisma.filaCuadroIyV.findUnique({ where: { id } });
  if (!actual) return NextResponse.json({ error: "La fila ya no existe" }, { status: 404 });
  const body = await request.json();

  const hoja = body.hoja && body.hoja !== actual.hoja ? body.hoja : actual.hoja;
  if (!HOJAS_IYV[hoja]) return NextResponse.json({ error: "Solapa desconocida" }, { status: 400 });
  if (hoja !== actual.hoja && HOJAS_IYV[hoja].bloques !== HOJAS_IYV[actual.hoja].bloques) {
    return NextResponse.json({ error: "Esa fila no se puede pasar a " + HOJAS_IYV[hoja].etiqueta }, { status: 400 });
  }
  const anteriores = actual.datos || {};
  // Lo que viene en `datos` reemplaza; un campo vacío se borra.
  const cambios = body.datos || {};
  const mezcla = { ...anteriores };
  for (const [k, v] of Object.entries(cambios)) {
    if (String(v ?? "").trim()) mezcla[k] = v; else delete mezcla[k];
  }
  const datos = datosFilaIyV(hoja, mezcla);
  const registros = registrosDeCambiosIyV(hoja, anteriores, datos, session.user.name);
  if (hoja !== actual.hoja) registros.push({ campo: "Solapa", anterior: HOJAS_IYV[actual.hoja].etiqueta, valor: HOJAS_IYV[hoja].etiqueta, usuario: session.user.name });
  if (!registros.length) {
    return NextResponse.json({ fila: await prisma.filaCuadroIyV.findUnique({ where: { id }, include: INCLUDE_FILA_IYV }) });
  }
  let orden = actual.orden;
  if (hoja !== actual.hoja) {
    const ultima = await prisma.filaCuadroIyV.findFirst({ where: { hoja }, orderBy: { orden: "desc" }, select: { orden: true } });
    orden = (ultima?.orden ?? -1) + 1;
  }
  const fila = await prisma.filaCuadroIyV.update({
    where: { id },
    data: { hoja, orden, datos, movimientos: { create: registros } },
    include: INCLUDE_FILA_IYV,
  });
  return NextResponse.json({ fila });
}

export async function DELETE(request, { params }) {
  const session = await sesionCuadroIyV();
  if (!session || !puedeEliminar(session)) return NextResponse.json({ error: "Solo el jefe de departamento o Soporte pueden eliminar" }, { status: 403 });
  const { id } = await params;
  await prisma.filaCuadroIyV.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
