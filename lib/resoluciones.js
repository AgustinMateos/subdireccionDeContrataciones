// Sector de Resoluciones: sistema aparte, sin conexión con Mesa de
// Entradas ni con los otros departamentos. Listas de la hoja "Base de
// datos" de su planilla; los campos son texto libre con estas sugerencias
// (la planilla trae valores fuera de lista, ej. un fuero "DIJ").

export const SLUG_RESOLUCIONES = "resoluciones";

// Únicos accesos: el jefe del departamento y la jefa de la Subdirección.
export const EMAIL_JEFA_SUBDIRECCION = "jefa.subdireccion@pj.gob.ar";

// Evento del navegador que dispara la campana cuando llega un aviso nuevo:
// el panel lo escucha para volver a cargar los expedientes.
export const EVENTO_CAMBIOS_RESOLUCIONES = "resoluciones:cambios";
// Pedido de abrir un expediente de Resoluciones (ej. al tocar un aviso de
// la campana): `detail.id`. Lo atiende el Dashboard.
export const EVENTO_ABRIR_RESOLUCION = "resoluciones:abrir";

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
  "L.PRIVADA", "L.PUBLICA", "DIRECTA", "DESCENTRALIZADA", "T.SIMPLIFICADO", "O.PUBLICA", "OTROS", "REDETERMINACION",
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

export const ESTADOS_RESOLUCION = [
  "Confeccion de Resol", "Interv. Contabilidad", "Consulta al area", "Fracasa/pliego",
  "A la espera de Inf. Tecnico", "Ctrol / Revision", "Completado", "Otros", "Acta de Recomendacion",
];

export const AGENTES_RESOLUCIONES = ["MLA", "JC", "MQR", "CG", "LT", "CAR", "LRB", "AM", "S/A", "AUG", "SR"];

function texto(valor) {
  const t = String(valor ?? "").trim();
  return t || null;
}

function fecha(valor) {
  if (!valor) return null;
  const f = new Date(valor);
  return Number.isNaN(f.getTime()) ? null : f;
}

// Cantidad (ofertas, renglones): entero de 0 en adelante, o null.
function cantidad(valor) {
  const n = Number.parseInt(valor, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// N° de dictamen como NNN/AAAA ("12/26" → "12/2026"); si no es un
// número/año, null.
export function numeroDictamen(valor) {
  const m = String(valor || "").match(/^\s*(\d+)\s*\/\s*(\d{4}|\d{2})\s*$/);
  return m ? Number(m[1]) + "/" + (m[2].length === 2 ? "20" + m[2] : m[2]) : null;
}

// Si está en préstamo, qué falta del dictamen (o "" si está completo).
export function faltaDelDictamen(datos) {
  if (!datos.enPrestamo) return "";
  if (!numeroDictamen(datos.dictamenNumero)) return "Está en préstamo: completá el N° de dictamen (número/año, ej. 123/2026).";
  if (!datos.dictamenVence) return "Está en préstamo: completá cuándo vence el dictamen.";
  return "";
}

// Un escrito tiene que decir por qué se generó o qué tramita ("" si está
// completo o no es un escrito).
export function faltaDelEscrito(datos) {
  return datos.esEscrito && !String(datos.escritoMotivo || "").trim()
    ? "Es un escrito: completá por qué se generó o qué tramita." : "";
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
    cantidadOfertas: cantidad(body.cantidadOfertas),
    cantidadRenglones: cantidad(body.cantidadRenglones),
    tipoResolucion: texto(body.tipoResolucion),
    autorizaTipo: texto(body.autorizaTipo),
    autorizaNumero: texto(body.autorizaNumero),
    esEscrito: body.esEscrito === true,
    escritoMotivo: body.esEscrito === true ? texto(body.escritoMotivo) : null,
    estado: texto(body.estado),
    situacion: estadoGeneral(body),
    sectorActual: texto(body.sectorActual),
    fechaUltimoMov: fecha(body.fechaUltimoMov),
    agente: texto(body.agente),
    prioritario: body.prioritario === true,
    renovacionAutomatica: body.renovacionAutomatica === true,
    renovacionDias: Number.parseInt(body.renovacionDias, 10) > 0 ? Number.parseInt(body.renovacionDias, 10) : null,
    renovacionHabiles: body.renovacionHabiles !== false,
    vencOfertas: fecha(body.vencOfertas),
    enPrestamo: body.enPrestamo === true,
    dictamenNumero: body.enPrestamo === true ? numeroDictamen(body.dictamenNumero) : null,
    dictamenVence: body.enPrestamo === true ? fecha(body.dictamenVence) : null,
    inicioServicio: texto(body.inicioServicio),
    montos: texto(body.montos),
    observaciones: texto(body.observaciones),
  };
}

// Asignación (agente), prioridad, cantidad de ofertas y de renglones y la
// renovación automática de las ofertas (activarla y sus días) solo los
// carga la jefa de la Subdirección: para cualquier otro usuario se
// descartan del pedido.
export const CAMPOS_SOLO_JEFA = [
  "agente", "prioritario", "cantidadOfertas", "cantidadRenglones", "renovacionAutomatica", "renovacionDias", "renovacionHabiles",
];

export function soloCamposDeJefa(datos, email) {
  if (email === EMAIL_JEFA_SUBDIRECCION) return datos;
  return Object.fromEntries(Object.entries(datos).filter(([k]) => !CAMPOS_SOLO_JEFA.includes(k)));
}

// Y al revés: tipo de resolución, estado y sector actual son del trabajo de
// Resoluciones; la jefa no los modifica (sí los puede cargar en un alta).
export const CAMPOS_DE_RESOLUCIONES = ["tipoResolucion", "autorizaTipo", "autorizaNumero", "estado", "sectorActual"];

// Datos del expediente que la jefa ve fijos al editar: de la solapa de
// datos solo cambia lo de CAMPOS_SOLO_JEFA (el resto sí lo carga en un
// alta).
export const DATOS_FIJOS_PARA_JEFA = [
  "exp", "esEscrito", "escritoMotivo", "numero", "fechaIngreso", "objeto", "fuero", "organismo", "tipoContratacion", "montos",
  "vencOfertas", "inicioServicio", "enPrestamo", "dictamenNumero", "dictamenVence",
];

export function sinCamposDeResoluciones(datos, email) {
  if (email !== EMAIL_JEFA_SUBDIRECCION) return datos;
  const resto = { ...datos };
  for (const k of [...CAMPOS_DE_RESOLUCIONES, ...DATOS_FIJOS_PARA_JEFA]) delete resto[k];
  return resto;
}

// Tipos de resolución de un fracaso o una convocatoria desierta (solapa
// "Fracasados y desiertas"; en la general van después del resto).
// FRACASA / AUTORIZA no: sigue en trámite como cualquier otro.
export const TIPOS_FRACASO_DESIERTA = ["FRACASAR", "DESIERTA"];

export function esFracasoODesierta(e) {
  return TIPOS_FRACASO_DESIERTA.includes(String(e.tipoResolucion || "").trim().toUpperCase());
}

// Avisos de la campana que son para la jefa de la Subdirección (un
// expediente nuevo de Resoluciones para asignar); el resto son para
// Resoluciones.
export const ACCIONES_PARA_JEFA = ["para-asignar"];

// Tipo de resolución ADJUDICAR o FRACASA / AUTORIZA (solapa "Para
// adjudicar").
export const TIPOS_PARA_ADJUDICAR = ["ADJUDICAR", "FRACASA / AUTORIZA"];

export function esParaAdjudicar(e) {
  return TIPOS_PARA_ADJUDICAR.includes(String(e.tipoResolucion || "").trim().toUpperCase());
}

// FRACASA / AUTORIZA: fracasa la contratación del expediente
// (tipoContratacion + numero) y se autoriza otra, que se carga aparte
// (autorizaTipo + autorizaNumero) y se ve en la misma fila.
export const FRACASA_AUTORIZA = "FRACASA / AUTORIZA";

export function esFracasaAutoriza(e) {
  return String(e.tipoResolucion || "").trim().toUpperCase() === FRACASA_AUTORIZA;
}

// "DESCENTRALIZADA N° 45" ("" si no es FRACASA / AUTORIZA o no se cargó).
export function textoAutoriza(e) {
  if (!esFracasaAutoriza(e)) return "";
  return [e.autorizaTipo, e.autorizaNumero && "N° " + e.autorizaNumero].filter(Boolean).join(" ");
}

// Estado general del expediente (columna "Estado gral.", en la base
// `situacion`): aparte del estado de la resolución ("Completado" es solo
// un estado más de la resolución). Cualquier otro valor guardado (el viejo
// "CIRCUITO") se lee como Tramitando. Uno en préstamo está siempre en
// trámite: no se puede finalizar mientras no vuelva a Aperturas.
export const ESTADOS_GENERALES = ["TRAMITANDO", "FINALIZADO"];
export const ETIQUETA_ESTADO_GENERAL = { TRAMITANDO: "Tramitando", FINALIZADO: "Finalizado" };

export function estadoGeneral(e) {
  if (e.enPrestamo) return "TRAMITANDO";
  const s = String(e.situacion || "").trim().toUpperCase();
  return ESTADOS_GENERALES.includes(s) ? s : "TRAMITANDO";
}

// Expediente terminado: estado general "Finalizado" (solapa "Finalizados";
// fuera del Escritorio, sin días en sector ni renovaciones, al fondo).
export function esFinalizado(e) {
  return estadoGeneral(e) === "FINALIZADO";
}

// Si el expediente está hoy en otro sector (solapa "Fuera de Resoluciones").
export function estaFueraDeResoluciones(e) {
  const sector = String(e.sectorActual || "").trim().toUpperCase();
  return !!sector && sector !== "RESOLUCIONES";
}

// Prioritario: lo marca la jefa, o el expediente está en su Plan de Obras
// (`enPlanObras`, lo agrega el servidor al cruzar con el plan).
export function esPrioritario(e) {
  return !!e.prioritario || !!e.enPlanObras;
}

// Orden de la planilla: los finalizados al final; primero los
// prioritarios; después los que no son fracaso ni desierta; dentro de cada grupo, por vencimiento de ofertas, el
// más próximo primero (sin fecha, al final).
export function compararResoluciones(a, b) {
  if (esFinalizado(a) !== esFinalizado(b)) return esFinalizado(a) ? 1 : -1;
  if (esPrioritario(a) !== esPrioritario(b)) return esPrioritario(a) ? -1 : 1;
  if (esFracasoODesierta(a) !== esFracasoODesierta(b)) return esFracasoODesierta(a) ? 1 : -1;
  const va = a.vencOfertas ? new Date(a.vencOfertas).getTime() : Infinity;
  const vb = b.vencOfertas ? new Date(b.vencOfertas).getTime() : Infinity;
  if (va !== vb) return va - vb;
  return String(a.fechaIngreso || "").localeCompare(String(b.fechaIngreso || ""));
}

// El campo montos es texto libre ("$17.161.017,81", "$128.300.000",
// "$ 61.096.888 P.O. DE NUEVO LLAMADO...", "SIN DEFINIR PARTIDA"): toma el
// primer importe y lo pasa a número. Acepta 1.234.567,89 y 1,234,567.89;
// el separador que va último con 1 o 2 dígitos detrás es el decimal. Sin
// importe: null.
export function montoNumero(texto) {
  const m = String(texto || "").match(/\d[\d.,]*/);
  if (!m) return null;
  let t = m[0].replace(/[.,]+$/, "");
  const ultimo = Math.max(t.lastIndexOf(","), t.lastIndexOf("."));
  const decimal = ultimo >= 0 && /^\d{1,2}$/.test(t.slice(ultimo + 1)) ? t[ultimo] : null;
  if (decimal) t = t.slice(0, ultimo).replace(/[.,]/g, "") + "." + t.slice(ultimo + 1);
  else t = t.replace(/[.,]/g, "");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// "2026-10-08T00:00:00.000Z" → "2026-10-08" (fechas puras, medianoche UTC).
export function fechaISO(f) {
  return f ? String(f).slice(0, 10) : "";
}
