import { NextResponse } from "next/server";
import { esFechaISO } from "@/lib/diasHabiles";
import { vencimientosDePublicacion } from "@/lib/feriados";
import { sesionOrdenesCompra } from "@/lib/ordenesCompraServidor";

// Vencimientos del art. 44 y de la OC en días hábiles:
// ?publicacion=aaaa-mm-dd[&notificacion44=aaaa-mm-dd]
export async function GET(request) {
  if (!(await sesionOrdenesCompra())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const publicacion = params.get("publicacion");
  const notificacion44 = params.get("notificacion44") || undefined;
  if (!esFechaISO(publicacion) || (notificacion44 && !esFechaISO(notificacion44))) {
    return NextResponse.json({ error: "Fechas inválidas (aaaa-mm-dd)" }, { status: 400 });
  }
  try {
    return NextResponse.json(await vencimientosDePublicacion(publicacion, { fechaNotificacion44: notificacion44 }));
  } catch (err) {
    return NextResponse.json({ error: err.message || "No se pudieron calcular los vencimientos" }, { status: 503 });
  }
}
