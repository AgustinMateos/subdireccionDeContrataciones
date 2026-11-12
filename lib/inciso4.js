// Inciso 4 (bienes de uso) del clasificador presupuestario: sus partidas,
// compartidas por Licitaciones y el Cuadro de Informática y Varios. Sin
// dependencias, para poder usarlo también desde los scripts de carga.
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
export const sinTildesMayus = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
// Anticipo de fondos (en el encuadre): nunca cuenta como bien de uso.
export const esEncuadreAnticipo = t => /^ANT/.test(sinTildesMayus(t).replace(/[^A-Z]/g, "")) || /ANTICIPO/.test(sinTildesMayus(t));
