// Solo servidor: deja constancia en RegistroAuditoria de lo que se hace en
// los paneles (lo consulta Soporte en "Registro de cambios"). Si falla, no
// frena la acción: se anota en el log y sigue.

export const ACCIONES_AUDITORIA = {
  alta: "Alta",
  edicion: "Edición",
  "cambio-rapido": "Cambio desde la tabla",
  borrado: "Expediente borrado",
  "observacion-editada": "Observación corregida",
  "historial-borrado": "Registro del historial borrado",
};

export async function registrarAuditoria(prisma, session, { panel, accion, exp = null, registroId = null, detalle = null }) {
  try {
    await prisma.registroAuditoria.create({
      data: {
        usuario: session?.user?.name || "Desconocido",
        email: session?.user?.email || null,
        panel,
        accion,
        exp,
        registroId,
        detalle: detalle == null ? undefined : JSON.parse(JSON.stringify(detalle)),
      },
    });
  } catch (err) {
    console.error("No se pudo registrar la auditoría (" + panel + " · " + accion + "):", err.message);
  }
}
