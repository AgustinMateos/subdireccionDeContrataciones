// Sector de Resoluciones: sistema aparte, sin conexión con Mesa de
// Entradas ni con los otros departamentos. Listas de la hoja "Base de
// datos" de su planilla; los campos son texto libre con estas sugerencias
// (la planilla trae valores fuera de lista, ej. un fuero "DIJ").

export const SLUG_RESOLUCIONES = "resoluciones";

// Únicos accesos: el jefe del departamento y la jefa de la Subdirección.
export const EMAIL_JEFA_SUBDIRECCION = "jefa.subdireccion@pj.gob.ar";

export const USUARIOS_RESOLUCIONES = {
  "admin.resoluciones@pj.gob.ar": "Jefe de Departamento",
  "jefa.subdireccion@pj.gob.ar": "Jefa de la Subdirección",
};

export const FUEROS_RESOLUCIONES = [
  "Cámara Nacional de Apelaciones en lo Criminal y Correccional",
  "Cámara Federal de Apelaciones de Bahia Blanca",
  "Cámara Federal de Apelaciones de Comodoro Rivadavia",
  "Cámara Federal de Apelaciones de Córdoba",
  "Cámara Federal de Apelaciones de General Roca",
  "Cámara Federal de Apelaciones de La Plata",
  "Cámara Federal de Apelaciones de Mar del Plata",
  "Cámara Federal de Apelaciones de Mendoza",
  "Cámara Federal de Apelaciones de Corrientes",
  "Cámara Federal de Apelaciones de Paraná",
  "Cámara Federal de Apelaciones de Posadas",
  "Cámara Federal de Apelaciones de Resistencia",
  "Cámara Federal de Apelaciones de Rosario",
  "Cámara Federal de Apelaciones de Salta",
  "Cámara Federal de Apelaciones de San Martín",
  "Cámara Federal de Apelaciones de Tucumán",
  "Cámara Federal de Casación Penal",
  "Cámara Federal de la Seguridad Social",
  "Camara Nacional de Apelaciones en lo Comercial",
  "Cámara Nacional de Apelaciones del Trabajo",
  "Cámara Nacional de Apelaciones en lo Civil",
  "Cámara Nacional de Apelaciones en lo Civil y Comercial Federal",
  "Cámara Nacional de Apelaciones en lo Contencioso Administrativo",
  "Cámara Nacional de Apelaciones en lo Criminal y Correccional Federal",
  "Cámara Nacional de Apelaciones en lo Penal Económico",
  "Cámara Nacional Electoral",
  "Centro de Computos",
  "Consejo de la Magistratura",
  "Corte",
  "DGAF",
  "DGSI",
  "Dirección General de Infraestructura Judicial",
  "Diversos Organismos",
  "Intendencia de Marcelo T. de Alvear 1839",
  "DGT",
  "OTROS",
  "ESCUELA JUDICIAL",
];

export const TIPOS_CONTRATACION_RESOLUCIONES = [
  "L.PRIVADA", "L.PUBLICA", "DIRECTA", "T.SIMPLIFICADO", "O.PUBLICA", "OTROS", "REDETERMINACION",
];

export const TIPOS_RESOLUCION = [
  "FRACASAR", "ADJUDICAR", "AUTORIZAR", "FRACASA / AUTORIZA", "OTROS", "DESIERTA", "SIN EFECTO", "DICTAMINAR",
];

export const SECTORES_RESOLUCIONES = [
  "SUBDIRECCION", "CONTABILIDAD", "TECNICA", "GESTION INTERNA", "CORRESPONDENCIA", "ARCHIVO",
  "PATRIMONIO", "OTROS GTOS.", "DIJ", "DAF", "CIJ", "DGT", "DESPACHO", "PREADJUDICACIONES", "SAJ",
  "DGP", "MESA DE ENTRADA", "TESORERIA", "UAI", "RENDICION DE CTA", "DGSI", "AG", "UEPI", "SERVICIOS",
  "ORDENES DE COMPRA", "LICITACIONES", "SERV.ESPECIALES", "RESOLUCIONES", "APERTURAS", "LOCACIONES",
  "SERV.VARIOS", "SUB. COORDINACION DE DELEGACIONES", "COMPRAS LP", "DIV. CONTROL DE RECURSOS",
  "OTROS", "CIRC. DE FIRMAS",
];

export const SITUACIONES_RESOLUCIONES = ["TRAMITANDO", "FINALIZADO", "CIRC. DE FIRMAS"];

export const ESTADOS_RESOLUCION = [
  "Confeccion de Resol", "Interv. Contabilidad", "Consulta al area", "Fracasa/pliego",
  "A la espera de Inf. Tecnico", "Ctrol / Revision", "Completado", "Otros", "Acta de Recomendacion",
];

export const AGENTES_RESOLUCIONES = ["MLA", "JC", "MQR", "CG", "LT", "CAR", "LRB", "AM", "S/N", "AUG", "SR"];

function texto(valor) {
  const t = String(valor ?? "").trim();
  return t || null;
}

function fecha(valor) {
  if (!valor) return null;
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? null : f;
}

// Datos editables de un expediente, tal como llegan del formulario.
export function datosResolucion(body) {
  return {
    exp: String(body.exp || "").trim(),
    fechaIngreso: fecha(body.fechaIngreso),
    objeto: String(body.objeto || "").trim(),
    fuero: texto(body.fuero),
    organismo: texto(body.organismo),
    tipoContratacion: texto(body.tipoContratacion),
    numero: texto(body.numero),
    tipoResolucion: texto(body.tipoResolucion),
    estado: texto(body.estado),
    sectorActual: texto(body.sectorActual),
    fechaUltimoMov: fecha(body.fechaUltimoMov),
    agente: texto(body.agente),
    prioritario: body.prioritario === true,
    vencOfertas: fecha(body.vencOfertas),
    inicioServicio: texto(body.inicioServicio),
    montos: texto(body.montos),
    observaciones: texto(body.observaciones),
    situacion: texto(body.situacion) || "TRAMITANDO",
  };
}

// Asignación (agente) y prioridad solo las decide la jefa de la
// Subdirección: para cualquier otro usuario se descartan del pedido.
export function soloCamposDeJefa(datos, email) {
  if (email === EMAIL_JEFA_SUBDIRECCION) return datos;
  const { agente, prioritario, ...resto } = datos;
  return resto;
}

// Orden de la planilla: primero los prioritarios; después por vencimiento
// de ofertas, el más próximo primero (sin fecha, al final).
export function compararResoluciones(a, b) {
  if (!!a.prioritario !== !!b.prioritario) return a.prioritario ? -1 : 1;
  const va = a.vencOfertas ? new Date(a.vencOfertas).getTime() : Infinity;
  const vb = b.vencOfertas ? new Date(b.vencOfertas).getTime() : Infinity;
  if (va !== vb) return va - vb;
  return String(a.fechaIngreso || "").localeCompare(String(b.fechaIngreso || ""));
}

// "2026-10-08T00:00:00.000Z" → "2026-10-08" (fechas puras, medianoche UTC).
export function fechaISO(f) {
  return f ? String(f).slice(0, 10) : "";
}
