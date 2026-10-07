import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { INCLUDE_MESA, SECTORES_TRAMITA, datosExpedienteMesa } from "@/lib/mesaEntradas";
import { conDatosDelSector, sincronizarConDepartamentos } from "@/lib/mesaEntradasServidor";

// Expedientes de Mesa de Entradas (solo los del departamento del usuario):
// los que existen hoy en los departamentos (se sincronizan antes de
// listar) y lo que Mesa caratuló. Lo vinculado a un expediente que ya se
// cerró o se borró no se muestra.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.departamentoSlug === "mesa-de-entradas") {
    await sincronizarConDepartamentos(session.user.departamentoId);
  }

  const expedientes = await prisma.expedienteMesa.findMany({
    where: { departamentoId: session.user.departamentoId },
    include: INCLUDE_MESA,
    orderBy: { creadoEn: "desc" },
  });
  const conSector = await conDatosDelSector(expedientes);
  return NextResponse.json({ expedientes: conSector.filter((e) => e.enCurso) });
}

// Caratular: alta del expediente. El ingreso a la Subdirección (la primera
// vez que entra) queda como primer movimiento, de ahí corren los días
// frenado; inicio y vencimiento son del período del contrato. Tipo de
// contratación, WD y R se cargan después, al editar.
export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.rol !== "admin" && session.user.rol !== "operador")) {
    return NextResponse.json({ error: "No tenés permiso para caratular" }, { status: 403 });
  }

  const body = await request.json();
  const datos = datosExpedienteMesa(body);
  if (!datos.exp || !datos.objeto) {
    return NextResponse.json({ error: "Completá N° de expediente y objeto" }, { status: 400 });
  }
  if (!SECTORES_TRAMITA.includes(datos.sectorTramita)) {
    return NextResponse.json({ error: "Elegí el sector que tramita" }, { status: 400 });
  }
  if (!datos.ingresoSubdireccion) {
    return NextResponse.json({ error: "Completá la fecha de ingreso a la Subdirección" }, { status: 400 });
  }

  try {
    const expediente = await prisma.expedienteMesa.create({
      data: {
        ...datos,
        tipoContratacion: null,
        wd: null,
        r: null,
        departamentoId: session.user.departamentoId,
        movimientos: {
          create: [{
            fecha: datos.ingresoSubdireccion,
            sector: "SUBDIRECCION",
            observacion: "Caratulado en Mesa de Entradas.",
            usuario: session.user.name,
          }],
        },
      },
      include: INCLUDE_MESA,
    });
    return NextResponse.json({ expediente: (await conDatosDelSector([expediente]))[0] });
  } catch (e) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Ya hay un expediente " + datos.exp + " registrado en Mesa de Entradas" }, { status: 400 });
    }
    throw e;
  }
}
