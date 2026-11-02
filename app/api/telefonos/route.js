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

// Reemplaza el listado completo por el que manda Soporte desde la pantalla.
// Se borra y se vuelve a crear todo en una transacción (grupos y personas caen en cascada).
export async function PUT(request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.rol !== "soporte") {
    return NextResponse.json({ error: "Solo Soporte puede modificar el listado de teléfonos" }, { status: 403 });
  }

  const body = await request.json();
  if (!Array.isArray(body.secciones)) {
    return NextResponse.json({ error: "Listado inválido" }, { status: 400 });
  }

  const texto = v => String(v ?? "").trim();
  const nuevas = body.secciones.map((s, si) => ({
    titulo: texto(s.titulo) || null,
    orden: si,
    grupos: (s.grupos ?? []).map((g, gi) => ({
      rotulo: texto(g.rotulo),
      orden: gi,
      personas: (g.personas ?? [])
        .filter(p => texto(p.nombre))
        .map((p, pi) => ({ nombre: texto(p.nombre), interno: texto(p.interno), orden: pi })),
    })),
  }));

  await prisma.$transaction(async tx => {
    await tx.seccionTelefonica.deleteMany({});
    for (const s of nuevas) {
      await tx.seccionTelefonica.create({
        data: {
          titulo: s.titulo,
          orden: s.orden,
          grupos: { create: s.grupos.map(g => ({ rotulo: g.rotulo, orden: g.orden, personas: { create: g.personas } })) },
        },
      });
    }
  }, { timeout: 30000 });

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
