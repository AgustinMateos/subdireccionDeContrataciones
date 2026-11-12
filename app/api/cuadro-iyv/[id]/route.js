import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  HOJAS_IYV, ORDEN_BLOQUES_IYV, TITULO_BLOQUE_IYV, bloqueVacioIyV, datosFilaIyV, datosVigenteParaArchivo, expDeBloqueIyV,
  sinVigente, subirBloqueIyV,
} from "@/lib/cuadroIyV";
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

// Acciones sobre una fila de Servicios:
// - { accion: "archivarVigente" }: el vigente (con los datos del servicio)
//   pasa a Antecedentes como fila nueva; en Servicios el vigente queda vacío.
// - { accion: "subirBloque", desde, hacia }: los datos de un bloque pasan al
//   anterior, que tiene que estar vacío (continuidad → vigente, renovación →
//   continuidad).
export async function POST(request, { params }) {
  const session = await sesionCuadroIyV();
  if (!session || !puedeEditar(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const { id } = await params;
  const actual = await prisma.filaCuadroIyV.findUnique({ where: { id } });
  if (!actual) return NextResponse.json({ error: "La fila ya no existe" }, { status: 404 });
  if (actual.hoja !== "servicios") return NextResponse.json({ error: "Solo se puede en Servicios" }, { status: 400 });
  const d = actual.datos || {};
  const { accion, desde, hacia, adjudicatario } = await request.json();
  const usuario = session.user.name;

  if (accion === "archivarVigente") {
    if (bloqueVacioIyV(d, "vigente")) return NextResponse.json({ error: "El vigente está vacío" }, { status: 400 });
    const archivo = datosVigenteParaArchivo(d);
    const exp = expDeBloqueIyV(d, "vigente") || "sin N°";
    const ultima = await prisma.filaCuadroIyV.findFirst({ where: { hoja: "antecedentes" }, orderBy: { orden: "desc" }, select: { orden: true } });
    const [antecedente, fila] = await prisma.$transaction([
      prisma.filaCuadroIyV.create({
        data: {
          hoja: "antecedentes", orden: (ultima?.orden ?? -1) + 1, datos: archivo,
          movimientos: { create: [{ campo: "Alta", valor: "Vigente archivado desde Servicios", usuario }] },
        },
        include: INCLUDE_FILA_IYV,
      }),
      prisma.filaCuadroIyV.update({
        where: { id },
        data: { datos: sinVigente(d), movimientos: { create: [{ campo: "Vigente archivado", anterior: exp, valor: "Pasó a Antecedentes", usuario }] } },
        include: INCLUDE_FILA_IYV,
      }),
    ]);
    return NextResponse.json({ fila, antecedente });
  }

  if (accion === "subirBloque") {
    const i = ORDEN_BLOQUES_IYV.indexOf(hacia);
    if (i < 0 || ORDEN_BLOQUES_IYV[i + 1] !== desde) return NextResponse.json({ error: "Movimiento no válido" }, { status: 400 });
    if (!bloqueVacioIyV(d, hacia)) return NextResponse.json({ error: "El bloque " + TITULO_BLOQUE_IYV[hacia] + " no está vacío" }, { status: 400 });
    if (bloqueVacioIyV(d, desde)) return NextResponse.json({ error: "El bloque " + TITULO_BLOQUE_IYV[desde] + " está vacío" }, { status: 400 });
    const exp = expDeBloqueIyV(d, desde) || "sin N°";
    const nuevos = subirBloqueIyV(d, desde, hacia);
    // Una prórroga que pasa a vigente sigue con el mismo proveedor: el
    // adjudicatario del vigente que se acaba de archivar (lo manda la ficha).
    if (desde === "continuidad" && hacia === "vigente" && adjudicatario && !nuevos.adjudicatario && /pr[oó]rroga/i.test(d.cContratacion || "")) {
      nuevos.adjudicatario = String(adjudicatario);
    }
    const fila = await prisma.filaCuadroIyV.update({
      where: { id },
      data: {
        datos: datosFilaIyV("servicios", nuevos),
        movimientos: { create: [{ campo: "Pasó de " + TITULO_BLOQUE_IYV[desde] + " a " + TITULO_BLOQUE_IYV[hacia], anterior: null, valor: exp, usuario }] },
      },
      include: INCLUDE_FILA_IYV,
    });
    return NextResponse.json({ fila });
  }

  return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
}
