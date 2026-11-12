// Cuadro de Informática y Varios: la planilla "EXPEDIENTES INFORMATICA Y
// VARIOS" como panel. Se puede importar desde el cliente y el servidor.
//
// Cada fila es un renglón de una de cuatro solapas (`hoja`). Sus campos van
// en `datos` (JSON), con las claves de HOJAS_IYV. En Servicios y
// Antecedentes los campos se agrupan en bloques: los datos del servicio, la
// contratación vigente, la continuidad (prórroga / contratación puente) y
// la renovación (la contratación nueva).

import { normalizarExp } from "./numeroExpediente.js";
import { PARTIDAS_INCISO_4, NO_ES_BIEN_DE_USO, sinTildesMayus, esEncuadreAnticipo } from "./inciso4.js";

// Listas de la hoja "base de datos" de la planilla.
export const TIPOS_IYV = ["Informatica", "Varios"];
export const AGENTES_IYV = ["CB", "AM", "VG"];
export const ESTADOS_CONVOCATORIA_IYV = [
  "Inicio / Confeccion de pliego", "Estimacion de Costo", "Proyecto de Llamado", "Proyecto de Autorizacion",
  "proyecto de anticipo de fondos", "Proyecto de Descentralizada", "Proyecto de Adjudicación", "proyecto de prorroga",
  "informes liquidaciones", "Preadjudicacion", "adjudicación", "a la dependencia", "Publicacion", "pago de facturas",
  "autorización A.F", "perfeccionamiento del contrato", "otros",
];
export const SECTORES_IYV = [
  "AG", "Aperturas", "Archivo", "CAF", "Cámara", "CIJ", "Contabilidad", "dependencia requirente", "DGAF", "DGIJ", "DGP",
  "DGT", "Div. Técnica", "Dir. Auditoría Informática", "Dpto Liquidación de Gastos", "DSI", "Informatica",
  "Intendencia/Hab", "OC", "Preadjudicaciones", "Resoluciones", "RRHH", "SAJ", "Subdireccion",
  "Subdirección de Seguridad de Corte", "UAI", "UEPI", "Varios",
];
export const ENCUADRES_IYV = [
  "L. Publica", "L.Privada", "C.Directa", "T.S", "Exclusividad", "Interadministrativo", "Partida", "Ant. de Fondos.",
  "Legitimo abono", "Aprobación de Gastos", "descentralizada", "orden de compra abierta",
];
export const SITUACIONES_IYV = ["Tramitando", "Finalizado"];

// Un campo: clave en `datos`, etiqueta, y opcionalmente lista de opciones
// (se puede cargar otro valor), si es largo (textarea) o si es un N° de
// expediente (se normaliza).
const c = (k, label, extra = {}) => ({ k, label, ...extra });
const EXP = { exp: true, mono: true };
const LARGO = { largo: true };
// Observaciones: no es un campo sino un historial, atado al N° de
// expediente del bloque (`historial`: la clave de ese N°).
const OBS = exp => ({ historial: exp });
// Partida del Inciso 4 elegida a mano (vacía: según el objeto).
const PARTIDA = c("partida", "Partida (Inciso 4)", { partida: true });

const SERVICIO = [
  c("grupo", "Grupo (código)"),
  c("tipoServicio", "Tipo de servicio", { opciones: TIPOS_IYV }),
  c("agente", "Agente", { opciones: AGENTES_IYV }),
  c("fuero", "Fuero"),
  c("organismo", "Organismo"),
  c("domicilio", "Domicilio"),
  c("objeto", "Objeto", LARGO),
  PARTIDA,
];
const VIGENTE = [
  c("exp", "Exp.", EXP),
  c("contratacion", "Contratación"),
  c("montoPesos", "Monto $"),
  c("montoUsd", "Monto USD"),
  c("inicio", "Inicio"),
  c("vencimiento", "Vencimiento"),
  c("ocResol", "OC / Resol."),
  c("caratularRenovacion", "Caratular renovación"),
  c("caratularProrroga", "Caratular prórroga"),
  c("adjudicatario", "Adjudicatario"),
  c("prorrogaMeses", "Prórroga (meses)"),
  c("ultimoMov", "Último movimiento"),
  c("sector", "Sector", { opciones: SECTORES_IYV }),
  c("estadoConvocatoria", "Estado de convocatoria", { opciones: ESTADOS_CONVOCATORIA_IYV }),
  c("observaciones", "Observaciones", OBS("exp")),
];
const CONTINUIDAD = [
  c("cExp", "Exp.", EXP),
  c("cContratacion", "Contratación"),
  c("cMonto", "Monto"),
  c("cInicio", "Inicio"),
  c("cVencimiento", "Vencimiento"),
  c("cOcResol", "OC / Resol."),
  c("cUltimoMov", "Último movimiento"),
  c("cSector", "Sector", { opciones: SECTORES_IYV }),
  c("cEstadoConvocatoria", "Estado de convocatoria", { opciones: ESTADOS_CONVOCATORIA_IYV }),
  c("cObservaciones", "Observaciones", OBS("cExp")),
];
const RENOVACION = [
  c("rExp", "Exp.", EXP),
  c("rContratacion", "Contratación"),
  c("rMontoPesos", "Monto $"),
  c("rMontoUsd", "Monto USD"),
  c("rInicio", "Inicio"),
  c("rVencimiento", "Vencimiento"),
  c("rOcResol", "OC / Resol."),
  c("rAdjudicatario", "Adjudicatario"),
  c("rProrrogaMeses", "Prórroga (meses)"),
  c("rUltimoMov", "Último movimiento"),
  c("rSector", "Sector", { opciones: SECTORES_IYV }),
  c("rEstadoConvocatoria", "Estado de convocatoria", { opciones: ESTADOS_CONVOCATORIA_IYV }),
  c("rObservaciones", "Observaciones", OBS("rExp")),
];
const BLOQUES_SERVICIO = [
  { id: "servicio", titulo: "Servicio", campos: SERVICIO },
  { id: "vigente", titulo: "Vigente", campos: VIGENTE },
  { id: "continuidad", titulo: "Continuidad", campos: CONTINUIDAD },
  { id: "renovacion", titulo: "Renovación", campos: RENOVACION },
];

// Columnas de la tabla: [bloque, clave]. Las fechas de inicio de
// continuidad y renovación muestran además los días que faltan.
export const HOJAS_IYV = {
  servicios: {
    etiqueta: "Servicios informática y varios",
    bloques: BLOQUES_SERVICIO,
    tabla: [
      ["servicio", ["grupo", "tipoServicio", "agente", "organismo", "objeto"]],
      ["vigente", ["exp", "vencimiento", "adjudicatario"]],
      ["continuidad", ["cExp", "cVencimiento"]],
      ["renovacion", ["rExp", "rInicio", "rSector", "rEstadoConvocatoria", "rUltimoMov"]],
    ],
  },
  provisiones: {
    etiqueta: "Provisiones",
    bloques: [
      { id: "provision", titulo: "Provisión", campos: [
        c("tipoServicio", "Tipo", { opciones: TIPOS_IYV }),
        c("agente", "Agente", { opciones: AGENTES_IYV }),
        c("exp", "Exp.", EXP),
        c("fuero", "Fuero"),
        c("objeto", "Objeto", LARGO),
        PARTIDA,
        c("destinatario", "Destinatario"),
        c("domicilio", "Domicilio"),
        c("montoPesos", "Monto $"),
        c("montoUsd", "Monto USD"),
        c("encuadre", "Encuadre", { opciones: ENCUADRES_IYV }),
        c("oc", "OC"),
      ] },
      // Lo que traen los servicios temporales (PFA, taquígrafos...).
      { id: "periodo", titulo: "Período y adjudicación", campos: [
        c("inicio", "Inicio"),
        c("vencimiento", "Vencimiento"),
        c("adjudicatario", "Adjudicatario"),
        c("prorroga", "Prórroga"),
      ] },
      { id: "tramite", titulo: "Trámite", campos: [
        c("entrada", "Entrada"),
        c("ultimoMov", "Último movimiento"),
        c("sector", "Sector", { opciones: SECTORES_IYV }),
        c("etapa", "Etapa", { opciones: ESTADOS_CONVOCATORIA_IYV }),
        c("estado", "Estado", { opciones: SITUACIONES_IYV }),
        c("salida", "Salida", LARGO),
        c("observaciones", "Observaciones", OBS("exp")),
      ] },
    ],
    tabla: [
      ["provision", ["tipoServicio", "agente", "exp", "fuero", "objeto", "encuadre", "montoPesos"]],
      ["tramite", ["ultimoMov", "sector", "etapa", "estado"]],
    ],
  },
  temporales: {
    etiqueta: "Servicios temporales",
    bloques: [
      { id: "servicio", titulo: "Servicio", campos: [
        c("tipoServicio", "Tipo de servicio", { opciones: TIPOS_IYV }),
        c("agente", "Agente", { opciones: AGENTES_IYV }),
        c("fuero", "Fuero"),
        c("organismo", "Organismo"),
        c("domicilio", "Domicilio"),
        c("objeto", "Objeto", LARGO),
        PARTIDA,
      ] },
      { id: "contratacion", titulo: "Contratación actual", campos: [
        c("exp", "Exp.", EXP),
        c("inicio", "Inicio"),
        c("vencimiento", "Vencimiento"),
        c("encuadre", "Encuadre", { opciones: ENCUADRES_IYV }),
        c("ocResol", "OC / Resol."),
        c("adjudicatario", "Adjudicatario"),
        c("monto", "Monto"),
        c("prorroga", "Prórroga"),
      ] },
      { id: "tramite", titulo: "Trámite", campos: [
        c("sector", "Sector", { opciones: SECTORES_IYV }),
        c("estadoConvocatoria", "Estado", { opciones: ESTADOS_CONVOCATORIA_IYV }),
        c("entrada", "Entrada"),
        c("salida", "Salida"),
        c("estado", "Situación", { opciones: SITUACIONES_IYV }),
        c("observaciones", "Observaciones", OBS("exp")),
      ] },
    ],
    tabla: [
      ["servicio", ["tipoServicio", "agente", "organismo", "objeto"]],
      ["contratacion", ["exp", "inicio", "vencimiento", "encuadre"]],
      ["tramite", ["sector", "estadoConvocatoria", "estado"]],
    ],
  },
  antecedentes: {
    etiqueta: "Antecedentes",
    bloques: BLOQUES_SERVICIO,
    tabla: [
      ["servicio", ["grupo", "tipoServicio", "agente", "organismo", "objeto"]],
      ["vigente", ["exp", "vencimiento", "adjudicatario"]],
      ["continuidad", ["cExp"]],
      ["renovacion", ["rExp", "rSector", "rEstadoConvocatoria"]],
    ],
  },
};
// "temporales" (Servicios temporales) ya no es una solapa: se sumó a
// Provisiones (ver datosTemporalAProvision); queda la definición para
// leer filas viejas.
export const ORDEN_HOJAS_IYV = ["servicios", "provisiones", "antecedentes"];

// Todos los campos de una hoja (sin bloques) y sus definiciones por clave.
export const camposDeHoja = hoja => HOJAS_IYV[hoja].bloques.flatMap(b => b.campos);
export function campoIyV(hoja, k) {
  for (const b of HOJAS_IYV[hoja].bloques) {
    const campo = b.campos.find(x => x.k === k);
    if (campo) return { ...campo, bloque: b };
  }
  return null;
}
// "Renovación · Exp." (con el bloque, salvo el primero de cada hoja).
export function etiquetaCampoIyV(hoja, k) {
  const campo = campoIyV(hoja, k);
  if (!campo) return k;
  return campo.bloque === HOJAS_IYV[hoja].bloques[0] ? campo.label : campo.bloque.titulo + " · " + campo.label;
}

// Los datos de una fila que llegan de un formulario o de la planilla: solo
// las claves de la hoja, como texto recortado, los N° de expediente
// normalizados; vacíos fuera.
export function datosFilaIyV(hoja, body) {
  const datos = {};
  for (const campo of camposDeHoja(hoja)) {
    if (campo.historial) continue;
    let v = body?.[campo.k];
    if (v == null) continue;
    v = String(v).replace(/\r\n/g, "\n").trim();
    if (!v) continue;
    datos[campo.k] = campo.exp ? normalizarExp(v) : v;
  }
  return datos;
}

// Fecha de texto ("1/10/2024", "1/10/26", "01/11/27", "31-12-25") como
// ISO aaaa-mm-dd, o null si no se entiende.
export function fechaDeTexto(t) {
  const m = String(t || "").trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const anio = a.length === 2 ? "20" + a : a;
  if (+mes < 1 || +mes > 12 || +d < 1 || +d > 31) return null;
  return anio + "-" + mes.padStart(2, "0") + "-" + d.padStart(2, "0");
}

// Días desde hoy hasta una fecha de texto (negativo: ya pasó).
export function diasHasta(t, hoyISO) {
  const f = fechaDeTexto(t);
  if (!f) return null;
  return Math.round((Date.parse(f) - Date.parse(hoyISO)) / 86400000);
}

// Año de una fecha de texto ("14/10/2026" → "2026").
export const anioDeTexto = t => fechaDeTexto(t)?.slice(0, 4) || "";

// El último movimiento más reciente de la fila (de cualquier bloque).
export function ultimoMovIyV(datos) {
  const fechas = ["ultimoMov", "cUltimoMov", "rUltimoMov"].map(k => fechaDeTexto(datos?.[k])).filter(Boolean).sort();
  return fechas.at(-1) || "";
}

// Sectores y estados de la fila, de todos sus bloques (para filtrar).
export const sectoresIyV = d => [d.sector, d.cSector, d.rSector].filter(Boolean);
export const estadosIyV = d => [d.estadoConvocatoria, d.cEstadoConvocatoria, d.rEstadoConvocatoria, d.etapa].filter(Boolean);
// Los N° de expediente de la fila (vigente, continuidad y renovación).
export const expsIyV = d => [d.exp, d.cExp, d.rExp].filter(Boolean);

// Quién puede qué: el departamento edita (salvo Solo lectura); borrar,
// el jefe y Soporte.
export const SLUG_IYV = "informatica-y-varios";
export const puedeEditarIyV = s => s?.departamentoSlug === SLUG_IYV && s.rol !== "lector";
export const puedeEliminarIyV = s => s?.departamentoSlug === SLUG_IYV && (s.rol === "admin" || s.rol === "soporte");

// ---------- Archivar el vigente y subir los bloques ----------
// Cada bloque de Servicios con sus claves por concepto, para pasar los
// datos de uno a otro (la continuidad no tiene adjudicatario, monto USD ni
// prórroga: lo que no tiene lugar va a las observaciones del destino).
export const ORDEN_BLOQUES_IYV = ["vigente", "continuidad", "renovacion"];
const CLAVES_BLOQUE = {
  vigente: {
    exp: "exp", contratacion: "contratacion", montoPesos: "montoPesos", montoUsd: "montoUsd", inicio: "inicio",
    vencimiento: "vencimiento", ocResol: "ocResol", caratularRenovacion: "caratularRenovacion", caratularProrroga: "caratularProrroga",
    adjudicatario: "adjudicatario", prorrogaMeses: "prorrogaMeses", ultimoMov: "ultimoMov", sector: "sector",
    estadoConvocatoria: "estadoConvocatoria", observaciones: "observaciones",
  },
  continuidad: {
    exp: "cExp", contratacion: "cContratacion", montoPesos: "cMonto", inicio: "cInicio", vencimiento: "cVencimiento",
    ocResol: "cOcResol", ultimoMov: "cUltimoMov", sector: "cSector", estadoConvocatoria: "cEstadoConvocatoria", observaciones: "cObservaciones",
  },
  renovacion: {
    exp: "rExp", contratacion: "rContratacion", montoPesos: "rMontoPesos", montoUsd: "rMontoUsd", inicio: "rInicio",
    vencimiento: "rVencimiento", ocResol: "rOcResol", adjudicatario: "rAdjudicatario", prorrogaMeses: "rProrrogaMeses",
    ultimoMov: "rUltimoMov", sector: "rSector", estadoConvocatoria: "rEstadoConvocatoria", observaciones: "rObservaciones",
  },
};
export const TITULO_BLOQUE_IYV = { vigente: "vigente", continuidad: "continuidad", renovacion: "renovación" };
export const clavesBloqueIyV = b => Object.values(CLAVES_BLOQUE[b]);
export const bloqueVacioIyV = (d, b) => !clavesBloqueIyV(b).some(k => String(d?.[k] || "").trim());
export const expDeBloqueIyV = (d, b) => d?.[CLAVES_BLOQUE[b].exp] || "";

// Lo que se archiva del vigente: los datos del servicio y los del vigente
// (sin continuidad ni renovación), como fila de Antecedentes.
export function datosVigenteParaArchivo(d) {
  const claves = [...SERVICIO.map(c => c.k), ...clavesBloqueIyV("vigente")];
  return Object.fromEntries(claves.filter(k => d[k]).map(k => [k, d[k]]));
}
// La fila sin el vigente.
export function sinVigente(d) {
  const fuera = new Set(clavesBloqueIyV("vigente"));
  return Object.fromEntries(Object.entries(d).filter(([k]) => !fuera.has(k)));
}

// Pasa los datos del bloque `desde` al bloque `hacia` (que tiene que
// estar vacío) y vacía `desde`. Las observaciones no se tocan: van con el
// N° de expediente. Lo que no tiene lugar en `hacia` vuelve en `notas`
// (para sumarlo como observación).
export function subirBloqueIyV(d, desde, hacia) {
  const origen = CLAVES_BLOQUE[desde], destino = CLAVES_BLOQUE[hacia];
  const nuevos = { ...d };
  const sinLugar = [];
  for (const [concepto, k] of Object.entries(origen)) {
    const v = d[k];
    delete nuevos[k];
    if (!v) continue;
    if (concepto === "observaciones") continue;
    if (destino[concepto]) nuevos[destino[concepto]] = v;
    else sinLugar.push(campoIyV("servicios", k).label + ": " + v);
  }
  return { datos: nuevos, notas: sinLugar };
}

// El próximo paso correlativo: el primer bloque vacío que tiene el
// siguiente con datos (renovación → continuidad, continuidad → vigente).
export function siguienteSubidaIyV(d) {
  for (let i = 0; i < ORDEN_BLOQUES_IYV.length - 1; i++) {
    const hacia = ORDEN_BLOQUES_IYV[i], desde = ORDEN_BLOQUES_IYV[i + 1];
    if (bloqueVacioIyV(d, hacia) && !bloqueVacioIyV(d, desde)) return { desde, hacia };
  }
  return null;
}

// ---------- Observaciones por N° de expediente ----------
// Cada observación lleva una `clave`: el N° de expediente del bloque
// (normalizado), así el historial sigue al expediente aunque pase de
// continuidad a vigente o se archive. Si el bloque todavía no tiene N°, la
// clave es de la fila y el campo ("fila:<id>:cObservaciones"); al cargar el
// N° pasan a él.
export const claveFilaObsIyV = (filaId, k) => "fila:" + filaId + ":" + k;
export function claveObsIyV(datos, filaId, campo) {
  const exp = String(datos?.[campo.historial] || "").trim();
  return exp ? normalizarExp(exp) : claveFilaObsIyV(filaId, campo.k);
}
export const camposObsIyV = hoja => camposDeHoja(hoja).filter(x => x.historial);
// Campo de observaciones de cada bloque de Servicios.
export const OBS_DE_BLOQUE_IYV = { vigente: "observaciones", continuidad: "cObservaciones", renovacion: "rObservaciones" };

// ---------- Bienes de uso (Inciso 4) ----------
// Mismo criterio que Licitaciones: cada fila puede tener su partida
// (`partida`); si no, sale del objeto (la planilla no tiene rubro):
// instalaciones y cableado estructurado → 4.2 Construcciones (como
// Adecuación / Instalación en Licitaciones); equipamiento (computadoras,
// servidores, impresoras, audio y video, cámaras...) → 4.3 Maquinaria y
// equipo; licencias de software compradas → 4.8 Activos intangibles.
// Servicios, mantenimiento, suscripciones, seguros, insumos y demás bienes
// de consumo no son bienes de uso; los anticipos de fondos nunca cuentan.
const NO_BIEN_DE_USO = /SERVICIO|SERV\b|MANTENIM|SOPORTE|SUSCRIP|SEGURO|PUBLICACI|AVISO|TAQUIGRAF|DESGRABAC|POLICIA|PFA\b|PREFECTURA|GENDARMERIA|BOMBERO|INSUMO|TONER|CARTUCHO|FOTOCONDUCTOR|DRUM|COMBUSTIBLE|BIDON|PASAJE|NEUMATICO|REPARACI|PAGO DE FACT|FACTURA|CONFORMIDAD|CONSULTA|INFORME|RECOMPOSICI|CONVENIO|COMODATO|TRASLADO|MUDANZA|ENLACE|MPLS|INTERNET|LOCACION|ALQUILER|MONITOREO DE MEDIOS|CERTIFICADO|HIGIENE|MIGRACION DE LINEAS|ESTUDIO|MODELO DE CLAUSULA|REVISTA|ENVIO|MEDIOS MAGNETICOS|BATERIA|PATCH|ELEMENTOS DE CABLEADO|MATERIALES DE CABLEADO|ELEMENTOS PARA|VERIFICACION/;
const CONSTRUCCIONES = /CABLEADO ESTRUCTURADO|TENDIDO|INSTALAC|FIBRA OPTICA|DOBLE VIDRIO/;
const INTANGIBLES = /LICENCIA/;
const EQUIPAMIENTO = /COMPUTADORA|ALL IN ONE|NOTEBOOK|SERVIDOR|SWITCH|EQUIPO|EQUIPAMIENTO|IMPRESORA|ESCANER|PROYECTOR|MONITOR|FOTOCOPIADORA|MULTIFUNCION|\bUPS\b|ESTABILIZADOR|ACCESS POINT|INALAMBRICO|WIFI|GATEWAY|ELECTRONICA DE COMUNICACION|AUDIO Y VIDEO|\bTV\b|CAMARA|RELOJ BIOMETRICO|LECTOR|PORTERO|ALARMA|DETECTOR|INTERCOMUNICADOR|HANDY|HEADSET|AURICULAR|DISCO|SSD|MOUSE|TECLADO|COOLER|HIPERCONVERGEN|INFRAESTRUCTURA|FIREWALL|CENTRAL TELEF|DISPOSITIVO|MICROINFORMATICA|PUESTOS DE TRABAJO|TECNOLOGICO/;

// Bienes de consumo y servicios que nunca son bienes de uso, aunque digan
// "provisión".
const CONSUMO = /INSUMO|TONER|CARTUCHO|FOTOCONDUCTOR|DRUM|COMBUSTIBLE|BIDON|NEUMATICO|TRAMA/;

export function partidaSegunObjetoIyV(objeto) {
  const o = sinTildesMayus(objeto);
  if (!o.trim() || CONSUMO.test(o)) return NO_ES_BIEN_DE_USO;
  // "Provisión, instalación y mantenimiento" o "solución ... c/servicio":
  // si es equipamiento con instalación, cuenta el equipamiento.
  if (NO_BIEN_DE_USO.test(o) && !/^(PROVISION|SOLUCION|EQUIPAMIENTO)/.test(o)) return NO_ES_BIEN_DE_USO;
  if (INTANGIBLES.test(o)) return "4.8";
  if (CONSTRUCCIONES.test(o) && !/ELECTRONICA/.test(o)) return "4.2";
  if (EQUIPAMIENTO.test(o) || CONSTRUCCIONES.test(o)) return "4.3";
  return NO_ES_BIEN_DE_USO;
}
// Anticipo de fondos: en el encuadre (Provisiones, Temporales) o en la
// contratación (Servicios).
export const esAnticipoIyV = d => esEncuadreAnticipo(d?.encuadre) || /ANTICIPO|ANT\. DE FONDOS/.test(sinTildesMayus(d?.contratacion));
export function partidaIyV(d) {
  if (esAnticipoIyV(d)) return NO_ES_BIEN_DE_USO;
  return PARTIDAS_INCISO_4[d?.partida] || d?.partida === NO_ES_BIEN_DE_USO ? d.partida : partidaSegunObjetoIyV(d?.objeto);
}
export const esBienDeUsoIyV = d => !!PARTIDAS_INCISO_4[partidaIyV(d)];

// ---------- Servicios temporales → Provisiones ----------
// Una fila de Servicios temporales con las claves de Provisiones.
const DE_TEMPORAL = {
  tipoServicio: "tipoServicio", agente: "agente", fuero: "fuero", organismo: "destinatario", domicilio: "domicilio",
  objeto: "objeto", partida: "partida", exp: "exp", inicio: "inicio", vencimiento: "vencimiento", encuadre: "encuadre",
  ocResol: "oc", adjudicatario: "adjudicatario", monto: "montoPesos", prorroga: "prorroga", sector: "sector",
  estadoConvocatoria: "etapa", entrada: "entrada", salida: "salida", estado: "estado", observaciones: "observaciones",
};
export function datosTemporalAProvision(d) {
  const nuevos = {};
  for (const [k, v] of Object.entries(d || {})) if (v && DE_TEMPORAL[k]) nuevos[DE_TEMPORAL[k]] = v;
  return nuevos;
}
