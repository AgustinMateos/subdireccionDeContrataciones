import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_JEFA_SUBDIRECCION } from "@/lib/resoluciones";
import { SLUG_LICITACIONES } from "@/lib/licitaciones";
import { puedeEditar, sesionCuadroIyV } from "@/lib/cuadroIyVServidor";
import { sesionLicitaciones } from "@/lib/licitacionesServidor";

// Títulos del presupuesto asignados a mano (solapa Presupuesto). En IyV
// los cambia quien edita el cuadro; en Licitaciones, la jefa de la
// Subdirección y los admin del departamento (los que ven la solapa).
async function acceso(cuadro) {
  if (cuadro === "iyv") {
    const s = await sesionCuadroIyV();
    return s && { session: s, edita: puedeEditar(s) };
  }
  if (cuadro === "licitaciones") {
    const s = await sesionLicitaciones();
    return s && { session: s, edita: s.user.email === EMAIL_JEFA_SUBDIRECCION || (s.user.departamentoSlug === SLUG_LICITACIONES && s.user.rol === "admin") };
  }
  return null;
}

export async function GET(request) {
  const p = new URL(request.url).searchParams;
  const cuadro = p.get("cuadro");
  const anio = Number(p.get("anio"));
  const a = await acceso(cuadro);
  if (!a) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const titulos = await prisma.tituloPresupuesto.findMany({ where: { cuadro, anio } });
  return NextResponse.json({ titulos, edita: a.edita });
}

// { cuadro, anio, clave, renglonId }: renglonId null = ningún título;
// "auto" = vuelve al cruce por palabras (borra la asignación).
export async function PUT(request) {
  const { cuadro, anio, clave, renglonId } = await request.json();
  const a = await acceso(cuadro);
  if (!a?.edita) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  if (!Number.isInteger(anio) || !clave || (renglonId != null && typeof renglonId !== "string")) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }
  const where = { cuadro_anio_clave: { cuadro, anio, clave: String(clave) } };
  if (renglonId === "auto") {
    await prisma.tituloPresupuesto.deleteMany({ where: { cuadro, anio, clave: String(clave) } });
    return NextResponse.json({ titulo: null });
  }
  const datos = { renglonId: renglonId ?? null, usuario: a.session.user.name || a.session.user.email };
  const titulo = await prisma.tituloPresupuesto.upsert({ where, create: { cuadro, anio, clave: String(clave), ...datos }, update: datos });
  return NextResponse.json({ titulo });
}
