// Pase a Contaduría del cotizador de Policía Adicional: el texto del pase
// (el mismo que se redacta a mano en el Departamento de Informática y
// Varios) armado con los datos de la cotización. Se puede importar desde
// el cliente.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE"];
const DIEZ_A_VEINTINUEVE = [
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
  "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE",
];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];

// 0 a 999 en letras. `apocopar`: "UN" en vez de "UNO" (antes de MIL,
// MILLONES o CENTAVOS: "VEINTIÚN MIL", "UN CENTAVO").
function hasta999(n, apocopar) {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100), resto = n % 100;
  let texto;
  if (resto === 0) texto = "";
  else if (resto < 10) texto = UNIDADES[resto];
  else if (resto < 30) texto = DIEZ_A_VEINTINUEVE[resto - 10];
  else texto = DECENAS[Math.floor(resto / 10)] + (resto % 10 ? " Y " + UNIDADES[resto % 10] : "");
  if (apocopar) texto = texto.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");
  return [CENTENAS[c], texto].filter(Boolean).join(" ");
}

// Entero en letras, en mayúsculas ("TRES MILLONES DOSCIENTOS DIECIOCHO MIL
// CIENTO CUARENTA Y SIETE"). Hasta 999.999.999.999.
export function enteroEnLetras(n) {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "CERO";
  const partes = [];
  const milesDeMillones = Math.floor(n / 1e9);
  const millones = Math.floor((n % 1e9) / 1e6);
  const miles = Math.floor((n % 1e6) / 1e3);
  const resto = n % 1e3;
  if (milesDeMillones) partes.push(milesDeMillones === 1 ? "MIL" : hasta999(milesDeMillones, true) + " MIL");
  if (millones || milesDeMillones) {
    if (millones === 1 && !milesDeMillones) partes.push("UN MILLÓN");
    else partes.push((millones ? hasta999(millones, true) + " " : "") + "MILLONES");
  }
  if (miles) partes.push(miles === 1 ? "MIL" : hasta999(miles, true) + " MIL");
  if (resto) partes.push(hasta999(resto, false));
  return partes.join(" ");
}

// Monto en letras como va en el pase, sin "PESOS" adelante: "TRES MILLONES
// ... CIENTO CUARENTA Y SIETE CON TREINTA CENTAVOS".
export function montoEnLetras(monto) {
  const centavosTotales = Math.round(Number(monto) * 100);
  const pesos = Math.floor(centavosTotales / 100);
  const centavos = centavosTotales % 100;
  return enteroEnLetras(pesos) + (centavos ? " CON " + hasta999(centavos, true) + (centavos === 1 ? " CENTAVO" : " CENTAVOS") : "");
}

// "$3.218.147,30"
export function montoEnNumeros(monto) {
  return "$" + (Math.round(Number(monto) * 100) / 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// "2026-10-01" → "1° de octubre de 2026"
export function fechaEnPalabras(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "";
  const [a, m, d] = iso.split("-").map(Number);
  return (d === 1 ? "1°" : String(d)) + " de " + MESES[m - 1] + " de " + a;
}

// El pase en partes, para mostrarlo y para el Word. Los tramos en negrita
// van como { negrita: "..." }.
export function armarPase({ exp, fuerza, destino, inicio, fin, monto, ejercicio, fojasPresupuesto, fojasCuadro, agente, anio }) {
  const falta = t => t || "......";
  return {
    expediente: falta(exp),
    lugarYFecha: "Buenos Aires, ...... de .................... de " + (anio || ejercicio || ""),
    parrafos: [
      [
        "Atenta la necesidad de contratar el servicio de Policía Adicional brindado por la " + falta(fuerza) +
        ", con destino " + falta(destino) + ", para el período comprendido entre el " + falta(fechaEnPalabras(inicio)) +
        " y el " + falta(fechaEnPalabras(fin)) + ", pase al ",
        { negrita: "DEPARTAMENTO DE CONTADURÍA -División Contabilidad de Presupuesto-" },
        " previa intervención de la ",
        { negrita: "DIRECCIÓN DE PLANIFICACIÓN" },
        ", a fin de que se sirva tener a bien realizar la afectación contable por la suma de ",
        { negrita: "PESOS " + montoEnLetras(monto) + " (" + montoEnNumeros(monto) + "), con cargo al Ejercicio Financiero " + falta(ejercicio) + "." },
      ],
      [
        "Se deja constancia que el importe surge del presupuesto y convenio obrante a fs. " + falta(fojasPresupuesto) +
        " y cuadro de costos que luce a fs. " + falta(fojasCuadro) + ".",
      ],
      ["Cumplido, vuelva a este Departamento para la prosecución del trámite."],
    ],
    firma: "DEPARTAMENTO DE INFORMATICA Y VARIOS",
    agente: agente || "", // va abajo de la firma del Departamento
  };
}
