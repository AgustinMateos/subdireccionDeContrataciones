import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { registrarAuditoria } from "@/lib/auditoria";
import { normalizarSiglaAgente } from "@/lib/resoluciones";

// Agentes de Resoluciones: los ve cualquiera que haya entrado (Resoluciones
// y la jefa los usan para asignar, Soporte para administrarlos); solo
// Soporte los agrega y los activa o desactiva.
const ORDEN = [{ activo: "desc" }, { sigla: "asc" }];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const agentes = await prisma.agenteResolucion.findMany({ orderBy: ORDEN });
  return NextResponse.json({ agentes });
}

function soloSoporte(session) {
  return session?.user.rol === "soporte"
    ? null
    : NextResponse.json({ error: "Solo Soporte puede administrar los agentes de Resoluciones" }, { status: 403 });
}

// Alta: `{ sigla, nombre? }`. Entra activo.
export async function POST(request) {
  const session = await getServerSession(authOptions);
  const prohibido = soloSoporte(session);
  if (prohibido) return prohibido;
  const body = await request.json();
  const sigla = normalizarSiglaAgente(body.sigla);
  if (!sigla) return NextResponse.json({ error: "Escribí la sigla del agente" }, { status: 400 });
  if (sigla === "S/A") return NextResponse.json({ error: "S/A significa sin asignar: no es un agente" }, { status: 400 });
  if (await prisma.agenteResolucion.findUnique({ where: { sigla } })) {
    return NextResponse.json({ error: sigla + " ya está en la lista" }, { status: 409 });
  }
  const nombre = String(body.nombre ?? "").trim() || null;
  const agente = await prisma.agenteResolucion.create({ data: { sigla, nombre, activo: true } });
  await registrarAuditoria(prisma, session, {
    panel: "resoluciones", accion: "agente-alta", exp: sigla, registroId: agente.id,
    detalle: { objeto: "Agente de Resoluciones", cambios: [{ campo: "Nombre", nuevo: nombre }, { campo: "Activo", nuevo: "Sí" }] },
  });
  return NextResponse.json({ agente });
}

// Cambio: `{ id, activo?, nombre? }`. La sigla no cambia: es lo que tienen
// guardado los expedientes.
export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  const prohibido = soloSoporte(session);
  if (prohibido) return prohibido;
  const body = await request.json();
  const existente = body.id && await prisma.agenteResolucion.findUnique({ where: { id: String(body.id) } });
  if (!existente) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const data = {};
  if ("activo" in body) data.activo = body.activo === true;
  if ("nombre" in body) data.nombre = String(body.nombre ?? "").trim() || null;
  const agente = await prisma.agenteResolucion.update({ where: { id: existente.id }, data });
  const siNo = v => (v ? "Sí" : "No");
  const cambios = [
    existente.activo !== agente.activo && { campo: "Activo", anterior: siNo(existente.activo), nuevo: siNo(agente.activo) },
    existente.nombre !== agente.nombre && { campo: "Nombre", anterior: existente.nombre, nuevo: agente.nombre },
  ].filter(Boolean);
  if (cambios.length) {
    await registrarAuditoria(prisma, session, {
      panel: "resoluciones", accion: "agente-cambio", exp: agente.sigla, registroId: agente.id,
      detalle: { objeto: "Agente de Resoluciones", cambios },
    });
  }
  return NextResponse.json({ agente });
}
