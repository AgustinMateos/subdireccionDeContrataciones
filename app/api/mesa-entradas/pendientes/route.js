import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INCLUDE_MESA, SECTOR_TRAMITA_POR_DEPARTAMENTO } from "@/lib/mesaEntradas";

// Lo que Mesa de Entradas caratuló para el sector que tramita el
// departamento del usuario (ej. SERVICIOS → Servicios) y todavía nadie
// confirmó. Al confirmarlo se crea el expediente propio (ver POST
// /api/expedientes con mesaEntradaId).
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sector = SECTOR_TRAMITA_POR_DEPARTAMENTO[session.user.departamentoSlug];
  if (!sector) return NextResponse.json({ pendientes: [] });

  const pendientes = await prisma.expedienteMesa.findMany({
    where: { sectorTramita: sector, confirmadoEn: null },
    include: INCLUDE_MESA,
    orderBy: { creadoEn: "asc" },
  });
  return NextResponse.json({ pendientes });
}
