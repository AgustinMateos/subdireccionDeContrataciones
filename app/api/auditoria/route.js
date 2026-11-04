import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Registro de cambios de los paneles (ver lib/auditoria.js): solo Soporte.
// Los más recientes primero; ?panel=resoluciones para filtrar.
export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol !== "soporte") {
    return NextResponse.json({ error: "Solo Soporte puede ver el registro de cambios" }, { status: 403 });
  }
  const panel = new URL(request.url).searchParams.get("panel");
  try {
    const registros = await prisma.registroAuditoria.findMany({
      where: panel ? { panel } : undefined,
      orderBy: { creadoEn: "desc" },
      take: 1000,
    });
    return NextResponse.json({ registros });
  } catch (err) {
    console.error("Registro de cambios:", err.message);
    return NextResponse.json({ error: "No se pudo leer el registro de cambios" }, { status: 500 });
  }
}
