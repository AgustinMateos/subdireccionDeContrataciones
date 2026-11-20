import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EMAIL_JEFA_SUBDIRECCION } from "@/lib/resoluciones";
import { DATOS_EXPEDIENTE_OC, datosProveedorOC, numeroOCEntero } from "@/lib/ordenesCompra";
import { INCLUDE_ORDEN_COMPRA, conPlanObras, hoy, registrosDeCambiosOrdenCompra, sesionOrdenesCompra } from "@/lib/ordenesCompraServidor";

class ErrorPedido extends Error {}

// Agrega un proveedor al expediente de la OC `id`: una OC nueva con los
// datos del expediente y los del proveedor (`numeroOC`, `proveedor`,
// `codigoProveedor`, montos, `cbu`). Si el N° ya lo tiene otra OC y viene
// `correr: true`, esa y todas las de N° mayor se corren +1 (queda en el
// historial de cada una). Solo el departamento.
export async function POST(request, { params }) {
  const { id } = await params;
  const session = await sesionOrdenesCompra();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.email === EMAIL_JEFA_SUBDIRECCION) {
    return NextResponse.json({ error: "Los proveedores los carga Órdenes de Compra" }, { status: 403 });
  }
  const body = await request.json();
  const base = await prisma.ordenCompra.findUnique({ where: { id } });
  if (!base) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const proveedor = datosProveedorOC(body);
  if (!proveedor.proveedor) return NextResponse.json({ error: "Completá el proveedor" }, { status: 400 });
  const numero = proveedor.numeroOC ? proveedor.numeroOC.trim() : null;
  const entero = numeroOCEntero(numero);
  const usuario = session.user.name;

  try {
    const { creada, corridas } = await prisma.$transaction(async tx => {
      const ocupada = numero ? await tx.ordenCompra.findFirst({ where: { numeroOC: numero }, select: { exp: true } }) : null;
      let corridas = [];
      if (ocupada) {
        if (body.correr !== true || entero == null) {
          throw new ErrorPedido("El N° de OC " + numero + " ya lo tiene el expediente " + ocupada.exp);
        }
        // Esa y las siguientes, +1 (solo las de N° numérico).
        corridas = await tx.$queryRaw`
          SELECT id, "numeroOC" FROM "OrdenCompra"
          WHERE btrim("numeroOC") ~ '^[0-9]+$' AND btrim("numeroOC")::bigint >= ${entero}`;
        await tx.$executeRaw`
          UPDATE "OrdenCompra" SET "numeroOC" = (btrim("numeroOC")::bigint + 1)::text, "actualizadoEn" = now()
          WHERE btrim("numeroOC") ~ '^[0-9]+$' AND btrim("numeroOC")::bigint >= ${entero}`;
        const fecha = hoy();
        await tx.movimientoOrdenCompra.createMany({
          data: corridas.map(o => ({
            ordenId: o.id, fecha, campo: "N° de OC", anterior: o.numeroOC,
            valor: String(Number(String(o.numeroOC).trim()) + 1) + " (se corrió: el N° " + numero + " pasó a un proveedor agregado al exp. " + base.exp + ")",
            usuario,
          })),
        });
      }
      const datos = { ...Object.fromEntries(DATOS_EXPEDIENTE_OC.map(k => [k, base[k]])), ...proveedor, numeroOC: numero };
      const cambios = [
        { fecha: hoy(), campo: "Alta", anterior: null, valor: "Proveedor agregado al expediente (OC N° " + (numero || "sin N°") + ")", usuario },
        ...registrosDeCambiosOrdenCompra(null, datos, usuario),
      ];
      const creada = await tx.ordenCompra.create({ data: { ...datos, movimientos: { create: cambios } }, include: INCLUDE_ORDEN_COMPRA });
      const ids = corridas.map(o => o.id);
      const actualizadas = ids.length ? await tx.ordenCompra.findMany({ where: { id: { in: ids } }, include: INCLUDE_ORDEN_COMPRA }) : [];
      return { creada, corridas: actualizadas };
    }, { timeout: 30000 });
    return NextResponse.json({ expediente: await conPlanObras(prisma, creada), corridas: await conPlanObras(prisma, corridas) });
  } catch (err) {
    if (err instanceof ErrorPedido) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
