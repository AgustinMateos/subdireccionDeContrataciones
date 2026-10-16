// N° de expediente con un solo formato en todo el sistema: NN-NNNNN/AAAA
// ("13-13222/2026"). Se puede importar desde el cliente y el servidor.
//
// En las planillas aparece de muchas formas ("13-13222/26", "13-0092/26",
// "13-13816-25", "13=08869/26", "13.11892/25", "REF. 14-10868/25",
// "13-06148/26-LA", "13-02631/26 y 13-02627/26"): cada N° que aparece en
// el texto pasa al formato; el resto del texto ("REF.", "EDA 448/25",
// "-LA") queda igual. Lo que no se reconoce como N° de expediente no se
// toca.

// NN, separador (- = . o .-), de 2 a 6 dígitos, / o -, y el año (2 o 4
// dígitos). Con "-" antes del año el número del medio tiene que tener al
// menos 4 dígitos, para no confundirlo con una fecha ("10-06-26").
const PATRON = /(^|[^\d])(\d{2})\s*(?:\.-|[-=.])\s*(\d{2,6})(?:\s*\/\s*(\d{4}|\d{2})|-(\d{4}|\d{2}))(?![\d/])/g;

function mitad(numero) {
  const sinCeros = numero.replace(/^0+(?=\d{5})/, "");
  return sinCeros.length >= 5 ? sinCeros : sinCeros.padStart(5, "0");
}

// Texto con los N° de expediente en NN-NNNNN/AAAA.
export function normalizarExp(texto) {
  if (texto == null) return texto;
  return String(texto).replace(PATRON, (todo, antes, nn, medio, anioBarra, anioGuion) => {
    const anio = anioBarra ?? anioGuion;
    if (anioGuion && medio.length < 4) return todo;
    return antes + nn + "-" + mitad(medio) + "/" + (anio.length === 2 ? "20" + anio : anio);
  }).trim();
}

// ¿Es el mismo expediente? (sin importar el formato con que se escribió)
export function mismoExp(a, b) {
  const n = x => normalizarExp(String(x || "")).replace(/\s+/g, " ").toUpperCase();
  return !!String(a || "").trim() && n(a) === n(b);
}

// Para buscar: si lo tipeado tiene un N° completo, se busca normalizado
// ("13-13222/26" encuentra "13-13222/2026"); si es parte de un N°, tal cual.
export function expParaBuscar(texto) {
  return normalizarExp(String(texto || ""));
}

export const EJEMPLO_EXP = "13-13222/2026";
