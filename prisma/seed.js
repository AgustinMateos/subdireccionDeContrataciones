// Carga en la base real los datos de ejemplo para los 2 departamentos
// (Informática y Varios, Servicios), usuarios de prueba y catálogos base.
//
// Se ejecuta con: node prisma/seed.js

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // ---------- Departamentos ----------
  const departamentos = [
    { nombre: "Informática y Varios", slug: "informatica-y-varios" },
    { nombre: "Servicios", slug: "servicios" },
  ];
  const deptoPorSlug = {};
  for (const d of departamentos) {
    const creado = await prisma.departamento.upsert({
      where: { slug: d.slug },
      update: {},
      create: d,
    });
    deptoPorSlug[d.slug] = creado;
  }
  console.log("Departamentos sembrados:", departamentos.length);

  // ---------- Usuarios ----------
  const usuarios = [
    { nombre: "Administrador del Sistema", email: "admin@pj.gob.ar", clave: "admin123", rol: "admin", departamentoSlug: "informatica-y-varios" },
    { nombre: "Operador de Contrataciones", email: "operador@pj.gob.ar", clave: "operador123", rol: "operador", departamentoSlug: "informatica-y-varios" },
    { nombre: "Usuario Solo Lectura", email: "lector@pj.gob.ar", clave: "lector123", rol: "lector", departamentoSlug: "informatica-y-varios" },
    { nombre: "Usuario de Soporte", email: "soporte@pj.gob.ar", clave: "soporte123", rol: "soporte", departamentoSlug: "informatica-y-varios" },
    { nombre: "Administradora de Servicios", email: "admin.servicios@pj.gob.ar", clave: "admin123", rol: "admin", departamentoSlug: "servicios" },
    { nombre: "Operador de Servicios", email: "operador.servicios@pj.gob.ar", clave: "operador123", rol: "operador", departamentoSlug: "servicios" },
    { nombre: "Usuario Solo Lectura de Servicios", email: "lector.servicios@pj.gob.ar", clave: "lector123", rol: "lector", departamentoSlug: "servicios" },
    { nombre: "Usuario de Soporte de Servicios", email: "soporte.servicios@pj.gob.ar", clave: "soporte123", rol: "soporte", departamentoSlug: "servicios" },
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
        departamentoId: deptoPorSlug[u.departamentoSlug].id,
      },
    });
  }
  console.log("Usuarios sembrados:", usuarios.length);

  // ---------- Valor Modular (genérico, compartido por ambos departamentos) ----------
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

  // ---------- Expedientes de ejemplo: Informática y Varios ----------
  const yaHayExpedientes = await prisma.expediente.count();
  if (yaHayExpedientes === 0) {
    const cadena1 = "c" + Date.now();
    await prisma.expediente.create({
      data: {
        cadenaId: cadena1,
        rol: "vigente",
        exp: "13-05340/23",
        departamentoId: deptoPorSlug["informatica-y-varios"].id,
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
    console.log("Expediente de ejemplo (Informática y Varios) creado.");
  }

  // ---------- Expedientes de ejemplo: Servicios ----------
  const yaHayServicios = await prisma.expediente.count({ where: { departamentoId: deptoPorSlug["servicios"].id } });
  if (yaHayServicios === 0) {
    const servicios = deptoPorSlug["servicios"].id;

    // Cadena completa (antecedente → vigente → parche → renovación) para poder
    // verificar los 4 nodos de trazabilidad: Ascensores CABA, Cámara Nacional de
    // Apelaciones en lo Comercial.
    const cadenaAscensores = "c" + (Date.now() + 1);
    await prisma.expediente.create({
      data: {
        cadenaId: cadenaAscensores,
        rol: "antecedente",
        exp: "13-04521/22",
        departamentoId: servicios,
        tipo: "Ascensores",
        zona: "CABA",
        codigoInterno: "02ID",
        agente: "MP",
        organismos: ["Cámara Nacional de Apelaciones en lo Comercial"],
        objeto: "Servicio de mantenimiento integral de ascensores",
        fuero: "Cámara Nacional de Apelaciones en lo Comercial",
        domicilio: "Montevideo 546, C.A.B.A.",
        montoARS: 4200000,
        fechaInicio: new Date("2022-06-01"),
        fechaVencimiento: new Date("2024-05-31"),
        sector: "Contable",
        estadoGeneral: "Finalizado",
      },
    });
    await prisma.expediente.create({
      data: {
        cadenaId: cadenaAscensores,
        rol: "vigente",
        exp: "13-08812/24",
        departamentoId: servicios,
        tipo: "Ascensores",
        zona: "CABA",
        codigoInterno: "02ID",
        agente: "MP",
        organismos: ["Cámara Nacional de Apelaciones en lo Comercial"],
        objeto: "Servicio de mantenimiento integral de ascensores",
        fuero: "Cámara Nacional de Apelaciones en lo Comercial",
        domicilio: "Montevideo 546, C.A.B.A.",
        montoARS: 5600000,
        fechaInicio: new Date("2024-06-01"),
        fechaVencimiento: new Date("2026-05-31"),
        sector: "Contrataciones",
        estadoConvocatoria: "Control",
        estadoGeneral: "En trámite de renovación",
        tieneProrroga: true,
        observaciones: {
          create: [
            { usuario: "seed", tipo: "movimiento", texto: "Pase a Contrataciones para control previo a vencimiento.", sectorAnterior: "Contable", sectorNuevo: "Contrataciones" },
          ],
        },
      },
    });
    await prisma.expediente.create({
      data: {
        cadenaId: cadenaAscensores,
        rol: "parche",
        exp: "13-01120/26",
        departamentoId: servicios,
        tipo: "Ascensores",
        zona: "CABA",
        codigoInterno: "02ID-P",
        agente: "MP",
        organismos: ["Cámara Nacional de Apelaciones en lo Comercial"],
        objeto: "Contratación puente de mantenimiento de ascensores mientras se tramita la renovación",
        fuero: "Cámara Nacional de Apelaciones en lo Comercial",
        domicilio: "Montevideo 546, C.A.B.A.",
        montoARS: 950000,
        fechaInicio: new Date("2026-06-01"),
        fechaVencimiento: new Date("2026-08-31"),
        sector: "Contrataciones",
        estadoConvocatoria: "Publicación",
        tipoParche: "Legítimo abono",
        detalleParche: "Jun y Jul/26 - Notificada el 15/5/26",
        estadoGeneral: "Vigente",
      },
    });
    await prisma.expediente.create({
      data: {
        cadenaId: cadenaAscensores,
        rol: "renovacion",
        exp: "13-05877/26",
        departamentoId: servicios,
        tipo: "Ascensores",
        zona: "CABA",
        codigoInterno: "02ID",
        agente: "MP",
        organismos: ["Cámara Nacional de Apelaciones en lo Comercial"],
        objeto: "Servicio de mantenimiento integral de ascensores",
        fuero: "Cámara Nacional de Apelaciones en lo Comercial",
        domicilio: "Montevideo 546, C.A.B.A.",
        montoARS: 6100000,
        fechaVencimiento: new Date("2028-05-31"),
        sector: "Asesoría Legal",
        estadoConvocatoria: "Proyecto de Llamado",
        estadoGeneral: "En trámite de renovación",
      },
    });

    // Dos expedientes sueltos adicionales, sin cadena de renovación, para tener
    // variedad de tipo/zona en el Informe de Servicios.
    await prisma.expediente.create({
      data: {
        cadenaId: "c" + (Date.now() + 2),
        rol: "vigente",
        exp: "13-03310/25",
        departamentoId: servicios,
        tipo: "Limpieza",
        zona: "CABA",
        codigoInterno: "01LA",
        agente: "RT",
        organismos: ["Juzgado Nacional en lo Civil N° 45"],
        objeto: "Servicio de limpieza integral",
        domicilio: "Talcahuano 550, C.A.B.A.",
        montoARS: 3100000,
        fechaInicio: new Date("2025-01-01"),
        fechaVencimiento: new Date("2026-12-31"),
        sector: "Contrataciones",
        estadoConvocatoria: "Estimación de Costos",
        estadoGeneral: "Vigente",
      },
    });
    await prisma.expediente.create({
      data: {
        cadenaId: "c" + (Date.now() + 3),
        rol: "vigente",
        exp: "13-07740/25",
        departamentoId: servicios,
        tipo: "Matafuegos",
        zona: "Interior",
        codigoInterno: "05exc",
        agente: "RT",
        organismos: ["Cámara Federal de Apelaciones de Córdoba"],
        objeto: "Provisión y recarga de matafuegos",
        fuero: "Cámara Federal de Apelaciones de Córdoba",
        domicilio: "Concepción Arenal 690, Córdoba",
        montoARS: 780000,
        fechaInicio: new Date("2025-03-01"),
        fechaVencimiento: new Date("2026-11-30"),
        sector: "Contable",
        estadoConvocatoria: "Inicio / Confección de Pliego",
        estadoGeneral: "Vigente",
      },
    });

    console.log("Expedientes de ejemplo (Servicios) creados: 6 (incluye cadena con antecedente/vigente/parche/renovación).");
  }

  // ---------- Listado de teléfonos (genérico, resumido; repetí el patrón para cada sección) ----------
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
