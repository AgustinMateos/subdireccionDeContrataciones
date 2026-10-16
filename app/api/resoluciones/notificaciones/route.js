import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ACCIONES_PARA_JEFA, EMAIL_JEFA_SUBDIRECCION } from "@/lib/resoluciones";
import { aplicarRenovaciones, sesionResoluciones } from "@/lib/resolucionesServidor";

// Cada uno ve sus avisos: la jefa de la Subdirección, los expedientes
// nuevos de Resoluciones para asignar; Resoluciones, lo que hace la jefa y
// las renovaciones automáticas.
function deQuien(session) {
  return session.user.email === EMAIL_JEFA_SUBDIRECCION
    ? { accion: { in: ACCIONES_PARA_JEFA } }
    : { accion: { notIn: ACCIONES_PARA_JEFA } };
}

// Últimos avisos y cuántos sin leer. La campana consulta cada minuto: de
// paso se aplican las renovaciones automáticas (y su aviso llega solo).
export async function GET() {
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await aplicarRenovaciones(prisma);
  const suyos = deQuien(session);
  const [notificaciones, noLeidas] = await Promise.all([
    prisma.notificacionResolucion.findMany({ where: suyos, orderBy: { creadoEn: "desc" }, take: 50 }),
    prisma.notificacionResolucion.count({ where: { ...suyos, leida: false } }),
  ]);
  return NextResponse.json({ notificaciones, noLeidas });
}

// Marcar como leídos (solo los propios): `{ ids: [...] }` o `{ todas: true }`.
export async function POST(request) {
  const session = await sesionResoluciones();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const cuales = body.todas ? { leida: false } : { id: { in: Array.isArray(body.ids) ? body.ids.map(String) : [] } };
  const { count } = await prisma.notificacionResolucion.updateMany({ where: { ...deQuien(session), ...cuales }, data: { leida: true } });
  return NextResponse.json({ marcadas: count });
}
