import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INCLUDE_MESA, SECTOR_TRAMITA_POR_DEPARTAMENTO, datosMovimientoMesa, ultimoMovimiento } from "@/lib/mesaEntradas";
import { EN_CURSO, conDatosDelSector, constanciaMesa, expedienteMesaDe } from "@/lib/mesaEntradasServidor";

const PENDIENTES = {
  pendienteMesa: true,
  tipo: "movimiento",
  expediente: { ...EN_CURSO, departamento: { slug: { in: Object.keys(SECTOR_TRAMITA_POR_DEPARTAMENTO) } } },
};

const esMesa = (session) => session?.user.departamentoSlug === "mesa-de-entradas";

// Pases de sector (y el estado de convocatoria al que quedaron) que
// registraron los departamentos y Mesa de Entradas todavía no confirmó.
// `sectorMesa` es dónde lo tiene Mesa hoy (para "Viene del sector").
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!esMesa(session)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const pases = await prisma.observacion.findMany({
    where: PENDIENTES,
    include: {
      expediente: {
        select: { id: true, exp: true, objeto: true, sector: true, estadoConvocatoria: true, departamento: { select: { nombre: true } } },
      },
    },
    orderBy: { fecha: "asc" },
  });
  const ids = [...new Set(pases.map((p) => p.expedienteId))];
  const registros = ids.length
    ? await prisma.expedienteMesa.findMany({
      where: { departamentoId: session.user.departamentoId, expedienteId: { in: ids } },
      include: INCLUDE_MESA,
    })
    : [];
  const sectorMesa = Object.fromEntries(registros.map((r) => [r.expedienteId, ultimoMovimiento(r)?.sector || null]));

  return NextResponse.json({
    pendientes: pases.map((p) => ({ ...p, sectorMesa: sectorMesa[p.expedienteId] || null })),
  });
}

// Confirmar un pase: `{ observacionId, movimiento }` con los datos del
// movimiento de Mesa (fecha de ingreso y sector obligatorios). Queda el
// movimiento en Mesa y la constancia con esa fecha en la ficha del
// departamento.
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!esMesa(session) || (session.user.rol !== "admin" && session.user.rol !== "operador")) {
    return NextResponse.json({ error: "No tenés permiso para confirmar movimientos" }, { status: 403 });
  }

  const body = await request.json();
  const pase = await prisma.observacion.findFirst({
    where: { ...PENDIENTES, id: String(body.observacionId || "") },
    include: { expediente: { select: { id: true, exp: true } } },
  });
  if (!pase) return NextResponse.json({ error: "Ese movimiento ya fue confirmado o no existe" }, { status: 404 });

  const mov = datosMovimientoMesa(body.movimiento || {}, session.user.name);
  if (!mov.sector || !mov.fecha) {
    return NextResponse.json({ error: "Completá la fecha y el sector" }, { status: 400 });
  }

  const registro = await expedienteMesaDe(session.user.departamentoId, pase.expediente);
  if (!registro) return NextResponse.json({ error: "El expediente " + pase.expediente.exp + " no está en Mesa de Entradas" }, { status: 400 });

  try {
    const expediente = await prisma.$transaction(async (tx) => {
      // Si otro usuario lo confirmó al mismo tiempo, no se duplica.
      const { count } = await tx.observacion.updateMany({ where: { id: pase.id, pendienteMesa: true }, data: { pendienteMesa: false } });
      if (count === 0) throw new Error("YA_CONFIRMADO");
      await tx.observacion.create({ data: { ...constanciaMesa(mov), expedienteId: pase.expedienteId } });
      return tx.expedienteMesa.update({
        where: { id: registro.id },
        data: { movimientos: { create: [mov] } },
        include: INCLUDE_MESA,
      });
    });
    return NextResponse.json({ expediente: (await conDatosDelSector([expediente]))[0] });
  } catch (e) {
    if (e.message === "YA_CONFIRMADO") {
      return NextResponse.json({ error: "Ese movimiento ya fue confirmado" }, { status: 409 });
    }
    throw e;
  }
}
