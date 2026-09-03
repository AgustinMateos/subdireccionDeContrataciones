import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Listado de teléfonos: dato genérico, igual para todos los departamentos.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const secciones = await prisma.seccionTelefonica.findMany({
    orderBy: { orden: "asc" },
    include: {
      grupos: {
        orderBy: { orden: "asc" },
        include: { personas: { orderBy: { orden: "asc" } } },
      },
    },
  });

  return NextResponse.json({ secciones });
}
