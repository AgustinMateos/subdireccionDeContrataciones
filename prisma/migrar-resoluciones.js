// Para los expedientes de Resoluciones ya cargados (correrlo antes de
// publicar cambios que necesiten columnas nuevas):
//  0. Agrega las columnas de la renovación automática del vencimiento de
//     ofertas si no están (sin `db push`, para no tocar columnas de otras
//     ramas que la base pueda tener).
//  1. Pasa al historial la observación que cada uno tenía antes de que las
//     observaciones se registraran (saltea los que ya tienen alguna).
//  2. Los de situación FINALIZADO quedan con estado "Completado" (la
//     situación ya no se usa), con el cambio en el historial.
// Se puede volver a correr sin duplicar nada.
//   node prisma/migrar-resoluciones.js

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const USUARIO = "Registro anterior";

async function main() {
  await prisma.$executeRawUnsafe(`ALTER TABLE "ExpedienteResolucion"
    ADD COLUMN IF NOT EXISTS "renovacionAutomatica" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "renovacionDias" INTEGER,
    ADD COLUMN IF NOT EXISTS "renovacionHabiles" BOOLEAN NOT NULL DEFAULT true`);
  console.log("Columnas de renovación automática: listas");

  const conObservaciones = await prisma.expedienteResolucion.findMany({
    where: { observaciones: { not: null }, movimientos: { none: { campo: "Observaciones" } } },
  });
  const observaciones = conObservaciones
    .filter(e => e.observaciones.trim())
    .map(e => ({
      expedienteId: e.id,
      // El día en que se cargó no se sabe: el último movimiento o, si no hay, el ingreso.
      fecha: e.fechaUltimoMov || e.fechaIngreso || e.creadoEn,
      campo: "Observaciones",
      sector: e.observaciones.trim(),
      usuario: USUARIO,
    }));
  const { count } = await prisma.movimientoResolucion.createMany({ data: observaciones });
  console.log("Observaciones pasadas al historial: " + count);

  const finalizados = await prisma.expedienteResolucion.findMany({
    where: { situacion: "FINALIZADO" },
  });
  for (const e of finalizados) {
    await prisma.expedienteResolucion.update({
      where: { id: e.id },
      data: {
        estado: "Completado",
        situacion: "TRAMITANDO",
        movimientos: { create: { fecha: e.fechaUltimoMov || e.fechaIngreso || e.creadoEn, campo: "Estado", sectorAnterior: e.estado, sector: "Completado", usuario: USUARIO } },
      },
    });
  }
  console.log("Finalizados pasados a estado Completado: " + finalizados.length);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
