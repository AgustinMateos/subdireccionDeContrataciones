import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_JEFA_SUBDIRECCION } from "@/lib/resoluciones";
import { aplicarRenovaciones, sesionResoluciones } from "@/lib/resolucionesServidor";

// Los avisos son para Resoluciones: lo que hace la jefa de la Subdirección
// (que no los recibe) y las renovaciones automáticas.
async function sesionDestinatario() {
  const session = await sesionResoluciones();
  return session && session.user.email !== EMAIL_JEFA_SUBDIRECCION ? session : null;
}

// Últimos avisos y cuántos sin leer. La campana consulta cada minuto: de
// paso se aplican las renovaciones automáticas (y su aviso llega solo).
export async function GET() {
  if (!(await sesionDestinatario())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await aplicarRenovaciones(prisma);
  const [notificaciones, noLeidas] = await Promise.all([
    prisma.notificacionResolucion.findMany({ orderBy: { creadoEn: "desc" }, take: 50 }),
    prisma.notificacionResolucion.count({ where: { leida: false } }),
  ]);
  return NextResponse.json({ notificaciones, noLeidas });
}

// Marcar como leídos: `{ ids: [...] }` o `{ todas: true }`.
export async function POST(request) {
  if (!(await sesionDestinatario())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const where = body.todas ? { leida: false } : { id: { in: Array.isArray(body.ids) ? body.ids.map(String) : [] } };
  const { count } = await prisma.notificacionResolucion.updateMany({ where, data: { leida: true } });
  return NextResponse.json({ marcadas: count });
}
