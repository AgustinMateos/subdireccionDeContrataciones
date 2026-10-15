// Una sola vez por base: deja listo el sistema de Licitaciones.
//  1. Crea sus tablas si no están (sin `db push`, para no tocar columnas
//     de otras ramas que la base pueda tener).
//  2. Crea el departamento "licitaciones" y su usuario
//     (admin.licitaciones@pj.gob.ar) si no están.
//  3. Si se le pasa la planilla (.xlsx o .csv) y todavía no hay
//     expedientes, los carga desde la fila de encabezados (EXP,
//     JURISDICCION, ORGANISMO...). La columna "Días en el sector" no se
//     carga: se calcula desde el último movimiento.
// Se puede volver a correr sin duplicar nada.
//   node prisma/cargar-licitaciones.js [ruta/a/la/planilla.xlsx]

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

const prisma = new PrismaClient();

const CREAR_TABLAS = [
  `CREATE TABLE IF NOT EXISTS "ExpedienteLicitacion" (
    "id" TEXT NOT NULL,
    "exp" TEXT NOT NULL,
    "jurisdiccion" TEXT,
    "organismo" TEXT,
    "domicilio" TEXT,
    "rubro" TEXT,
    "objeto" TEXT NOT NULL,
    "monto" TEXT,
    "plazoEjecucion" TEXT,
    "encuadre" TEXT,
    "fechaUltimoMov" TIMESTAMP(3),
    "sector" TEXT,
    "estadoInterno" TEXT,
    "estadoConvocatoria" TEXT,
    "observaciones" TEXT,
    "agente" TEXT,
    "paseFirma" TIMESTAMP(3),
    "prioritario" BOOLEAN NOT NULL DEFAULT false,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExpedienteLicitacion_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE INDEX IF NOT EXISTS "ExpedienteLicitacion_exp_idx" ON "ExpedienteLicitacion"("exp")`,
  `CREATE TABLE IF NOT EXISTS "MovimientoLicitacion" (
    "id" TEXT NOT NULL,
    "expedienteId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "campo" TEXT NOT NULL,
    "anterior" TEXT,
    "valor" TEXT NOT NULL,
    "usuario" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoLicitacion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MovimientoLicitacion_expedienteId_fkey" FOREIGN KEY ("expedienteId")
      REFERENCES "ExpedienteLicitacion"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "MovimientoLicitacion_expedienteId_idx" ON "MovimientoLicitacion"("expedienteId")`,
];

const USUARIO_CARGA = "Planilla anterior";

// Iniciales de la columna AGENTE de la planilla → nombre del agente.
const AGENTE_POR_INICIALES = {
  NK: "NATALIA",
  VM: "VERONICA",
  LT: "LUCIO",
  MSF: "MAXIMA",
  MSR: "SILVINA",
  MS: "MARIELA",
  EM: "EMILIANO",
};
const agente = v => {
  const t = texto(v);
  return t ? AGENTE_POR_INICIALES[t.toUpperCase()] || t : null;
};

const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
const texto = v => (String(v ?? "").trim() || null);

// Fecha de la planilla como fecha pura (medianoche UTC): número de serie
// de Excel o texto d/m/aa(aa). Lo que no se entiende, o tiene un año
// mal tipeado (205, 20260...), queda sin fecha.
function fecha(v) {
  const razonable = f => (f && !Number.isNaN(f.getTime()) && f.getUTCFullYear() >= 2000 && f.getUTCFullYear() <= 2100 ? f : null);
  if (typeof v === "number" && v > 0) return razonable(new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 86400000));
  const m = String(v ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3].length === 2 ? "20" + m[3] : m[3])];
  const f = new Date(Date.UTC(a, mes - 1, d));
  return f.getUTCDate() === d && f.getUTCMonth() === mes - 1 ? razonable(f) : null;
}

// Un monto que Excel guarda como número vuelve al formato de la planilla.
function monto(v) {
  if (typeof v === "number") return "$ " + v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return texto(v);
}

// Columna de cada campo según el encabezado de la planilla.
const COLUMNAS = {
  exp: c => c === "EXP",
  jurisdiccion: c => c === "JURISDICCION",
  organismo: c => c === "ORGANISMO",
  domicilio: c => c === "DOMICILIO",
  rubro: c => c === "RUBRO",
  objeto: c => c === "OBJETO",
  monto: c => c === "MONTO",
  plazoEjecucion: c => c.startsWith("PLAZO"),
  encuadre: c => c === "ENCUADRE",
  fechaUltimoMov: c => c.startsWith("ULTIMO MOV"),
  sector: c => c === "SECTOR",
  estadoInterno: c => c === "ESTADO INTERNO",
  estadoConvocatoria: c => c === "ESTADO CONVOCATORIA",
  observaciones: c => c === "OBSERVACIONES",
  agente: c => c === "AGENTE",
  paseFirma: c => c.startsWith("PASE A LA FIRMA"),
};

function leerPlanilla(ruta) {
  const libro = XLSX.readFile(ruta);
  for (const nombre of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombre], { header: 1, raw: true, defval: "" });
    const iEnc = filas.findIndex(f => norm(f[0]) === "EXP" && f.some(c => norm(c) === "JURISDICCION"));
    if (iEnc < 0) continue;
    const enc = filas[iEnc].map(norm);
    const col = Object.fromEntries(Object.entries(COLUMNAS).map(([k, es]) => [k, enc.findIndex(es)]));
    const v = (fila, k) => (col[k] >= 0 ? fila[col[k]] : "");
    return filas.slice(iEnc + 1)
      .filter(f => texto(v(f, "exp")) || texto(v(f, "objeto")))
      .map(f => ({
        exp: texto(v(f, "exp"))?.replace(/\s+/g, " ") || "(sin N°)",
        jurisdiccion: texto(v(f, "jurisdiccion")),
        organismo: texto(v(f, "organismo")),
        domicilio: texto(v(f, "domicilio")),
        rubro: texto(v(f, "rubro")),
        objeto: texto(v(f, "objeto")) || "(sin objeto)",
        monto: monto(v(f, "monto")),
        plazoEjecucion: texto(v(f, "plazoEjecucion")),
        encuadre: texto(v(f, "encuadre")),
        fechaUltimoMov: fecha(v(f, "fechaUltimoMov")),
        sector: texto(v(f, "sector")),
        estadoInterno: texto(v(f, "estadoInterno")),
        estadoConvocatoria: texto(v(f, "estadoConvocatoria")),
        observaciones: texto(v(f, "observaciones")),
        agente: agente(v(f, "agente")),
        paseFirma: fecha(v(f, "paseFirma")),
        paseFirmaIlegible: !!texto(v(f, "paseFirma")) && !fecha(v(f, "paseFirma")),
      }));
  }
  throw new Error("No encontré la fila de encabezados (EXP, JURISDICCION, ...) en " + ruta);
}

async function main() {
  for (const sql of CREAR_TABLAS) await prisma.$executeRawUnsafe(sql);
  console.log("Tablas de Licitaciones: listas");

  const depto = await prisma.departamento.upsert({
    where: { slug: "licitaciones" },
    update: {},
    create: { nombre: "Licitaciones", slug: "licitaciones" },
  });
  await prisma.usuario.upsert({
    where: { email: "admin.licitaciones@pj.gob.ar" },
    update: {},
    create: {
      nombre: "Jefe de Departamento de Licitaciones",
      email: "admin.licitaciones@pj.gob.ar",
      passwordHash: await bcrypt.hash("admin123", 10),
      rol: "admin",
      departamentoId: depto.id,
    },
  });
  console.log("Departamento y usuario de Licitaciones: listos");

  const ruta = process.argv[2];
  if (!ruta) { console.log("Sin planilla: no se cargaron expedientes."); return; }
  if (await prisma.expedienteLicitacion.count()) {
    console.log("Ya había expedientes de Licitaciones: no se cargó la planilla.");
    return;
  }
  const expedientes = leerPlanilla(ruta);
  for (const { paseFirmaIlegible, ...e } of expedientes) {
    // Las observaciones de la planilla quedan como primer registro del historial.
    const fechaHist = e.fechaUltimoMov || new Date();
    await prisma.expedienteLicitacion.create({
      data: {
        ...e,
        movimientos: e.observaciones
          ? { create: { fecha: fechaHist, campo: "Observaciones", valor: e.observaciones, usuario: USUARIO_CARGA } }
          : undefined,
      },
    });
  }
  console.log("Expedientes de Licitaciones cargados: " + expedientes.length);
  const sinFecha = expedientes.filter(e => !e.fechaUltimoMov).map(e => e.exp);
  if (sinFecha.length) console.log("Sin fecha de último movimiento (" + sinFecha.length + "): " + sinFecha.join(", "));
  const sinPase = expedientes.filter(e => e.paseFirmaIlegible).map(e => e.exp);
  if (sinPase.length) console.log("Pase a la firma ilegible, quedó vacío (" + sinPase.length + "): " + sinPase.join(", "));
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
