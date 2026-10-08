import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMAIL_CONTROL_SERVICIOS, llevaOrdenDeCompra } from "@/lib/constants";
import { EN_CURSO } from "@/lib/mesaEntradasServidor";
import { hoyArgentina, ordenesDeCompra } from "@/lib/utils";

// Margen de la alerta "por vencer sin OC en la renovación".
const DIAS_POR_VENCER = 30;

// Vigentes y parches de Servicios que vencen dentro de DIAS_POR_VENCER días
// y cuya renovación en trámite todavía no tiene orden de compra (o que no
// tienen renovación). Si otro vigente/parche de la misma cadena vence
// después, la cobertura sigue y no se alerta. Las renovaciones cuyo encuadre
// no lleva OC (descentralizada, legítimo abono) no cuentan como faltantes.
// El corte fino de días lo hace el cliente con diasRestantes, como el resto
// de la app; acá se trae con un día de margen para no perder bordes.
async function porVencerSinOrdenDeCompra() {
  const hoy = hoyArgentina();
  const dia = 86400000;
  const cobertura = { ...EN_CURSO, rol: { in: ["vigente", "parche"] }, departamento: { slug: "servicios" } };
  const candidatos = await prisma.expediente.findMany({
    where: {
      ...cobertura,
      fechaVencimiento: { gte: new Date(hoy.getTime() - dia), lte: new Date(hoy.getTime() + (DIAS_POR_VENCER + 1) * dia) },
    },
    select: {
      id: true, exp: true, nombreCorto: true, rol: true, cadenaId: true, unificadoEnId: true,
      tipo: true, zona: true, objeto: true, organismos: true, fuero: true, fechaVencimiento: true,
    },
  });
  if (candidatos.length === 0) return [];
  const cadenas = [...new Set(candidatos.map((e) => e.cadenaId))];
  const [coberturas, renovaciones] = await Promise.all([
    prisma.expediente.findMany({ where: { ...cobertura, cadenaId: { in: cadenas } }, select: { cadenaId: true, fechaVencimiento: true } }),
    prisma.expediente.findMany({
      where: {
        ...EN_CURSO,
        rol: "renovacion",
        OR: [{ cadenaId: { in: cadenas } }, { id: { in: candidatos.map((e) => e.unificadoEnId).filter(Boolean) } }],
      },
      select: { id: true, exp: true, cadenaId: true, encuadre: true, ocResolucion: true, estadoConvocatoria: true },
    }),
  ]);
  const tieneOC = (r) => ordenesDeCompra(r.ocResolucion).some((oc) => !/pendiente/i.test(oc));

  return candidatos
    .filter((e) => !coberturas.some((c) => c.cadenaId === e.cadenaId && c.fechaVencimiento > e.fechaVencimiento))
    .map((e) => {
      const suyas = renovaciones.filter((r) => r.cadenaId === e.cadenaId || r.id === e.unificadoEnId);
      return { e, suyas };
    })
    .filter(({ suyas }) => suyas.length === 0 || suyas.some((r) => llevaOrdenDeCompra(r) && !tieneOC(r)))
    .map(({ e, suyas }) => ({
      ...e,
      renovaciones: suyas
        .filter((r) => llevaOrdenDeCompra(r) && !tieneOC(r))
        .map(({ exp, encuadre, estadoConvocatoria }) => ({ exp, encuadre, estadoConvocatoria })),
    }));
}

// Panel de control de Servicios: los parches y las renovaciones en trámite
// del departamento de Servicios (sin vigentes ni antecedentes, igual que la
// tabla de Servicios), cada uno con el vencimiento de su vigente, más lo
// que está por vencer sin OC en la renovación (para la solapa de gráficos).
// Solo lectura y solo para EMAIL_CONTROL_SERVICIOS.
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
    porVencer: await porVencerSinOrdenDeCompra(),
    expedientes: expedientes.map((e) => ({
      ...e,
      vigentes: vigentes
        .filter((v) => v.cadenaId === e.cadenaId || v.unificadoEnId === e.id)
        .map(({ exp, fechaVencimiento }) => ({ exp, fechaVencimiento })),
    })),
  });
}
