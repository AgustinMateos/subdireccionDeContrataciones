import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMAIL_CONTROL_SERVICIOS } from "@/lib/constants";
import { EN_CURSO } from "@/lib/mesaEntradasServidor";

// Panel de control de Servicios: los parches y las renovaciones en trámite
// del departamento de Servicios (sin vigentes ni antecedentes, igual que la
// tabla de Servicios), cada uno con el vencimiento de su vigente. Solo
// lectura y solo para EMAIL_CONTROL_SERVICIOS.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.email !== EMAIL_CONTROL_SERVICIOS) {
    return NextResponse.json({ error: "No tenés acceso al panel de control de Servicios" }, { status: 403 });
  }

  const expedientes = await prisma.expediente.findMany({
    where: {
      ...EN_CURSO,
      rol: { in: ["parche", "renovacion"] },
      departamento: { slug: "servicios" },
    },
    select: {
      id: true,
      cadenaId: true,
      exp: true,
      nombreCorto: true,
      tipo: true,
      zona: true,
      agente: true,
      organismos: true,
      fuero: true,
      domicilio: true,
      domiciliosRenglones: true,
      objeto: true,
      encuadre: true,
      nroContratacion: true,
      fechaInicio: true,
      creadoEn: true,
      sector: true,
      estadoConvocatoria: true,
      observaciones: {
        where: { tipo: { in: ["movimiento", "mesa"] } },
        select: { tipo: true, fecha: true, pendienteMesa: true },
      },
    },
    orderBy: { creadoEn: "desc" },
  });

  // Vigentes relacionados: el de la misma cadena o, en una renovación
  // unificada, los que se unificaron en ella (unificadoEnId).
  const vigentes = await prisma.expediente.findMany({
    where: {
      rol: "vigente",
      OR: [
        { cadenaId: { in: expedientes.map((e) => e.cadenaId) } },
        { unificadoEnId: { in: expedientes.map((e) => e.id) } },
      ],
    },
    select: { exp: true, cadenaId: true, unificadoEnId: true, fechaVencimiento: true },
    orderBy: { fechaVencimiento: "asc" },
  });
  return NextResponse.json({
    expedientes: expedientes.map((e) => ({
      ...e,
      vigentes: vigentes
        .filter((v) => v.cadenaId === e.cadenaId || v.unificadoEnId === e.id)
        .map(({ exp, fechaVencimiento }) => ({ exp, fechaVencimiento })),
    })),
  });
}
