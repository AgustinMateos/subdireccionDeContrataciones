// Departamento de Licitaciones: sistema aparte, igual que Resoluciones
// (sin conexión con Mesa de Entradas ni con los otros departamentos). Lo
// usan el departamento y la jefa de la Subdirección. Listas tomadas de su
// planilla "Seguimiento y control de licitaciones"; los campos son texto
// libre con estas sugerencias.

import { HOY } from "./constants";
import { EMAIL_JEFA_SUBDIRECCION, FUEROS_RESOLUCIONES, fechaISO } from "./resoluciones";

export const SLUG_LICITACIONES = "licitaciones";

export const JURISDICCIONES_LICITACIONES = FUEROS_RESOLUCIONES;

export const RUBROS_LICITACIONES = [
  "AA", "ADECUACION", "BIENES DE CONSUMO", "ELECTRODOMESTICO", "INDUMENTARIA", "MATERIALES/FERRETERIA",
  "MOBILIARIO", "PINTURA", "REP. VEHICULO", "RESMAS", "VARIOS",
];

// Bienes de uso: partidas del Inciso 4. Cada expediente tiene la suya
// (`partida`); si no se eligió, sale del rubro: Adecuación → 4.2
// Construcciones; AA, Mobiliario y Electrodoméstico → 4.3 Maquinaria y
// equipo; el resto, no es bien de uso. Los anticipos de fondos nunca
// cuentan.
export const PARTIDAS_INCISO_4 = {
  "4.1": "Bienes preexistentes",
  "4.2": "Construcciones",
  "4.3": "Maquinaria y equipo",
  "4.4": "Equipo militar y de seguridad",
  "4.5": "Libros, revistas y otros elementos coleccionables",
  "4.6": "Obras de arte",
  "4.7": "Semovientes",
  "4.8": "Activos intangibles",
};
export const NO_ES_BIEN_DE_USO = "NO";
export const FILTRO_BIENES_DE_USO = "Bienes de uso (Inciso 4)";
export const etiquetaPartida = p => (PARTIDAS_INCISO_4[p] ? p + " " + PARTIDAS_INCISO_4[p] : "No es bien de uso");

export function partidaSegunRubro(rubro) {
  const r = sinTildes(rubro).trim();
  if (r.startsWith("ADECUAC") || r.includes("INSTALAC")) return "4.2";
  if (["AA", "MOBILIARIO", "ELECTRODOMESTICO"].includes(r)) return "4.3";
  return NO_ES_BIEN_DE_USO;
}

export const esAnticipo = e => /^ANT/.test(sinTildes(e.encuadre).replace(/[^A-Z]/g, ""));

// La partida que vale: la elegida o, si no, la del rubro.
export function partidaDe(e) {
  if (esAnticipo(e)) return NO_ES_BIEN_DE_USO;
  return PARTIDAS_INCISO_4[e.partida] || e.partida === NO_ES_BIEN_DE_USO ? e.partida : partidaSegunRubro(e.rubro);
}

export function esBienDeUso(e) {
  return !!PARTIDAS_INCISO_4[partidaDe(e)];
}

// Año del expediente: el del (primer) N° NN-NNNNN/AAAA; si no hay, vacío.
export function anioExpediente(e) {
  return String(e.exp || "").match(/\d{2}-\d{4,6}\/(\d{4})/)?.[1] || "";
}

export const ENCUADRES_LICITACIONES = [
  "L.PUBLICA", "L.PRIVADA", "C.DIRECTA", "C.DESCENT.", "O.PUBLICA", "TS", "COMP. ABREV. X URG.",
  "EXCLUSIVIDAD", "AMPLIACION O.C", "ANT. DE FONDOS", "A DEFINIR",
];

// Sector donde está hoy el expediente. "Licitaciones" es el propio.
export const SECTOR_PROPIO_LICITACIONES = "Licitaciones";

export const SECTORES_LICITACIONES = [
  "Licitaciones", "Aperturas", "AG", "DGIJ", "DGP", "Intendencia/Hab", "OC", "SAJ", "Tecnica", "Otros",
];

export const ESTADOS_INTERNOS_LICITACIONES = ["Tramitando", "Reservado", "Verificación", "Otros"];

export const ESTADOS_CONVOCATORIA_LICITACIONES = [
  "Inicial", "Inicio / Confeccion de pliego", "Confección de Pliego/ Autorización", "Proyecto de Llamado",
  "Publicacion", "Proyecto de Adj", "Adjudicado", "Unificar", "Concluido", "Archivado",
];

// Agentes del departamento y qué jurisdicciones atiende cada uno (cuadro
// de la planilla). Las claves son parte del nombre de la cámara, sin
// tildes y en mayúsculas.
export const AGENTES_LICITACIONES = ["LUCIO", "SILVINA", "NATALIA", "MARIELA", "MAXIMA", "EMILIANO", "VERONICA", "VANESA"];

export const AGENTE_POR_JURISDICCION = [
  ["CORRIENTES", "LUCIO"],
  ["GENERAL ROCA", "LUCIO"],
  ["ROSARIO", "SILVINA"],
  ["RESISTENCIA", "SILVINA"],
  ["SALTA", "SILVINA"],
  ["POSADAS", "MARIELA"],
  ["COMODORO RIVADAVIA", "MARIELA"],
  ["MAR DEL PLATA", "MARIELA"],
  ["CORDOBA", "NATALIA"],
  ["SAN MARTIN", "NATALIA"],
  ["MENDOZA", "NATALIA"],
  ["TUCUMAN", "MAXIMA"],
  ["PARANA", "MAXIMA"],
  ["BAHIA BLANCA", "VERONICA"],
  ["LA PLATA", "VERONICA"],
];

const sinTildes = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

// Agente que le toca a una jurisdicción según el cuadro, o null.
export function agentePorJurisdiccion(jurisdiccion) {
  const j = sinTildes(jurisdiccion);
  if (!j) return null;
  return AGENTE_POR_JURISDICCION.find(([clave]) => j.includes(clave))?.[1] || null;
}

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
export function datosLicitacion(body) {
  return {
    exp: String(body.exp || "").trim(),
    jurisdiccion: texto(body.jurisdiccion),
    organismo: texto(body.organismo),
    domicilio: texto(body.domicilio),
    rubro: texto(body.rubro),
    objeto: String(body.objeto || "").trim(),
    monto: texto(body.monto),
    plazoEjecucion: texto(body.plazoEjecucion),
    encuadre: texto(body.encuadre),
    partida: PARTIDAS_INCISO_4[body.partida] || body.partida === NO_ES_BIEN_DE_USO ? body.partida : null,
    fechaUltimoMov: fecha(body.fechaUltimoMov),
    sector: texto(body.sector),
    estadoInterno: texto(body.estadoInterno),
    estadoConvocatoria: texto(body.estadoConvocatoria),
    observaciones: texto(body.observaciones),
    agente: texto(body.agente),
    paseFirma: fecha(body.paseFirma),
    prioritario: body.prioritario === true,
  };
}

// Agente y prioridad solo los decide la jefa de la Subdirección: para el
// departamento se descartan del pedido.
export function soloCamposDeJefaLicitaciones(datos, email) {
  if (email === EMAIL_JEFA_SUBDIRECCION) return datos;
  const { agente, prioritario, ...resto } = datos;
  return resto;
}

// Sector y estados son del trabajo del departamento; la jefa tampoco
// cambia los datos del expediente al editar (sí los carga en un alta).
export const CAMPOS_DE_LICITACIONES = ["sector", "estadoInterno", "estadoConvocatoria"];

export const DATOS_FIJOS_LICITACIONES = [
  "exp", "jurisdiccion", "organismo", "domicilio", "rubro", "objeto", "monto", "plazoEjecucion", "encuadre", "partida", "paseFirma",
];

export function sinCamposDeLicitaciones(datos, email) {
  if (email !== EMAIL_JEFA_SUBDIRECCION) return datos;
  const resto = { ...datos };
  for (const k of [...CAMPOS_DE_LICITACIONES, ...DATOS_FIJOS_LICITACIONES]) delete resto[k];
  return resto;
}

// Terminado: estado de la convocatoria Concluido o Archivado (solapa
// "Concluidos y archivados"; fuera del Escritorio).
export function esTerminada(e) {
  return ["CONCLUIDO", "ARCHIVADO", "ARCHIVO"].includes(String(e.estadoConvocatoria || "").trim().toUpperCase());
}

// Si hoy está en el departamento (sector "Licitaciones").
export function estaEnLicitaciones(e) {
  return String(e.sector || "").trim().toUpperCase() === SECTOR_PROPIO_LICITACIONES.toUpperCase();
}

// Prioritario: lo marca la jefa, o está en su Plan de Obras (`enPlanObras`,
// lo agrega el servidor).
export function esPrioritarioLicitacion(e) {
  return !!e.prioritario || !!e.enPlanObras;
}

// Días desde el último movimiento. Uno terminado no cuenta (null).
export function diasEnSectorLicitacion(e) {
  if (esTerminada(e)) return null;
  const f = fechaISO(e.fechaUltimoMov);
  if (!f) return null;
  return Math.round((HOY - new Date(f + "T00:00:00")) / 86400000);
}

// Orden de la planilla: los terminados al final; primero los
// prioritarios; después los que llevan más días sin movimiento.
export function compararLicitaciones(a, b) {
  if (esTerminada(a) !== esTerminada(b)) return esTerminada(a) ? 1 : -1;
  if (esPrioritarioLicitacion(a) !== esPrioritarioLicitacion(b)) return esPrioritarioLicitacion(a) ? -1 : 1;
  const fa = a.fechaUltimoMov ? new Date(a.fechaUltimoMov).getTime() : Infinity;
  const fb = b.fechaUltimoMov ? new Date(b.fechaUltimoMov).getTime() : Infinity;
  if (fa !== fb) return fa - fb;
  return String(a.exp).localeCompare(String(b.exp));
}
