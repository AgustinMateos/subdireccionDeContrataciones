// Carga en la base real los mismos datos de ejemplo que hoy están hardcodeados
// en lib/constants.js, para no perder el set de prueba al migrar.
//
// Se ejecuta con: node prisma/seed.js

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // ---------- Usuarios ----------
  const usuarios = [
    { nombre: "Administrador del Sistema", email: "admin@pj.gob.ar", clave: "admin123", rol: "admin" },
    { nombre: "Operador de Contrataciones", email: "operador@pj.gob.ar", clave: "operador123", rol: "operador" },
    { nombre: "Usuario Solo Lectura", email: "lector@pj.gob.ar", clave: "lector123", rol: "lector" },
    { nombre: "Usuario de Soporte", email: "soporte@pj.gob.ar", clave: "soporte123", rol: "soporte" },
  ];
  for (const u of usuarios) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        nombre: u.nombre,
        email: u.email,
        passwordHash: await bcrypt.hash(u.clave, 10),
        rol: u.rol,
      },
    });
  }
  console.log("Usuarios sembrados:", usuarios.length);

  // ---------- Valor Modular ----------
  const yaHayValor = await prisma.valorModular.count();
  if (yaHayValor === 0) {
    await prisma.valorModular.create({ data: { valor: 300000, actualizadoPor: "seed" } });
    console.log("Valor modular inicial: $300.000");
  }

  // ---------- Configuración del Libro de Aperturas ----------
  const anioActual = new Date().getFullYear();
  await prisma.configuracionAnio.upsert({
    where: { anio: anioActual },
    update: {},
    create: { anio: anioActual, totalAnual: 30 },
  });

  // ---------- Expedientes de ejemplo (resumido; sumá el resto de tu lib/constants.js EXPEDIENTES acá) ----------
  const yaHayExpedientes = await prisma.expediente.count();
  if (yaHayExpedientes === 0) {
    const cadena1 = "c" + Date.now();
    await prisma.expediente.create({
      data: {
        cadenaId: cadena1,
        rol: "vigente",
        exp: "13-05340/23",
        area: "Informatica",
        tipo: "Servicios",
        agente: "CB",
        organismos: ["Centro de Computos"],
        objeto: "Servicio de soporte técnico y mantenimiento de red de datos",
        encuadre: "Contratación Directa - Art. 15",
        montoARS: 9800000,
        fechaInicio: new Date("2023-09-01"),
        fechaVencimiento: new Date("2026-09-10"),
        ocResolucion: "OC 210/23",
        adjudicatario: "Redes del Sur S.A.",
        sector: "Informática",
        etapa: "En ejecución",
        estadoGeneral: "En trámite de renovación",
        documentacion: {
          create: [
            "Solicitud de compra o contratación del área",
            "Informes de las dependencias intervinientes",
            "Pliego de bases y condiciones particulares",
            "Circulares aclaratorias o modificatorias",
            "Comunicaciones, invitaciones y publicaciones",
            "Acta de apertura de ofertas",
            "Informe de antecedentes de los oferentes",
            "Dictamen de preadjudicación",
            "Dictamen de Asuntos Jurídicos",
            "Proyecto de acto administrativo",
            "Nota de reseña del expediente",
            "Otros antecedentes relevantes",
          ].map((item, i) => ({ item, orden: i, cargado: false })),
        },
      },
    });
    console.log("Expediente de ejemplo creado. Sumá el resto de tu lista real acá.");
  }

  // ---------- Listado de teléfonos (resumido; repetí el patrón para cada sección) ----------
  const yaHayTelefonos = await prisma.seccionTelefonica.count();
  if (yaHayTelefonos === 0) {
    await prisma.seccionTelefonica.create({
      data: {
        titulo: "DEPARTAMENTO DE INFORMÁTICA Y VARIOS",
        orden: 0,
        grupos: {
          create: [
            { rotulo: "JEFATURA", orden: 0, personas: { create: [{ nombre: "Blanco Carolina", interno: "2348", orden: 0 }] } },
            { rotulo: "INFORMÁTICA", orden: 1, personas: { create: [{ nombre: "Vanesa Golisano", interno: "2213", orden: 0 }] } },
          ],
        },
      },
    });
    console.log("Listado de teléfonos: sección de ejemplo creada.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
