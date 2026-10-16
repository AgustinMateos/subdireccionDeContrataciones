// Pase a Contaduría del cotizador de Policía Adicional. Correr con `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { armarPase, enteroEnLetras, fechaEnPalabras, montoEnLetras, montoEnNumeros } from "../lib/paseContaduria.js";

test("el monto del pase de ejemplo (13-13222/26)", () => {
  assert.equal(montoEnLetras(3218147.3), "TRES MILLONES DOSCIENTOS DIECIOCHO MIL CIENTO CUARENTA Y SIETE CON TREINTA CENTAVOS");
  assert.equal(montoEnNumeros(3218147.3), "$3.218.147,30");
});

test("números en letras", () => {
  const casos = {
    0: "CERO", 1: "UNO", 15: "QUINCE", 16: "DIECISÉIS", 21: "VEINTIUNO", 22: "VEINTIDÓS", 30: "TREINTA", 31: "TREINTA Y UNO",
    100: "CIEN", 101: "CIENTO UNO", 115: "CIENTO QUINCE", 500: "QUINIENTOS", 1000: "MIL", 1001: "MIL UNO",
    21000: "VEINTIÚN MIL", 31000: "TREINTA Y UN MIL", 100000: "CIEN MIL", 101000: "CIENTO UN MIL",
    1000000: "UN MILLÓN", 2000000: "DOS MILLONES", 21000000: "VEINTIÚN MILLONES", 1500000: "UN MILLÓN QUINIENTOS MIL",
    1000000000: "MIL MILLONES", 2500000000: "DOS MIL QUINIENTOS MILLONES",
  };
  for (const [n, letras] of Object.entries(casos)) assert.equal(enteroEnLetras(Number(n)), letras, n);
});

test("centavos", () => {
  assert.equal(montoEnLetras(1000), "MIL");
  assert.equal(montoEnLetras(10.01), "DIEZ CON UN CENTAVO");
  assert.equal(montoEnLetras(10.21), "DIEZ CON VEINTIÚN CENTAVOS");
  // Sin errores de redondeo de los decimales de JavaScript.
  assert.equal(montoEnLetras(0.1 + 0.2), "CERO CON TREINTA CENTAVOS");
  assert.equal(montoEnNumeros(1234.5), "$1.234,50");
});

test("fechas del período", () => {
  assert.equal(fechaEnPalabras("2026-10-01"), "1° de octubre de 2026");
  assert.equal(fechaEnPalabras("2026-12-31"), "31 de diciembre de 2026");
  assert.equal(fechaEnPalabras(""), "");
});

test("el pase completo", () => {
  const p = armarPase({
    exp: "13-13222/26", fuerza: "Policía Federal Argentina",
    destino: "al servicio solicitado por el Dr. Pablo Javier Flores, Titular del Tribunal Oral en lo Criminal Federal N°3 de San Martín",
    inicio: "2026-10-01", fin: "2026-12-31", monto: 3218147.3, ejercicio: "2026", fojasPresupuesto: "8/13", fojasCuadro: "14", agente: "AM", anio: 2026,
  });
  const texto = p.parrafos.map(partes => partes.map(x => (typeof x === "string" ? x : x.negrita)).join("")).join("\n");
  assert.match(texto, /brindado por la Policía Federal Argentina, con destino al servicio solicitado por el Dr\./);
  assert.match(texto, /entre el 1° de octubre de 2026 y el 31 de diciembre de 2026, pase al DEPARTAMENTO DE CONTADURÍA/);
  assert.match(texto, /PESOS TRES MILLONES DOSCIENTOS DIECIOCHO MIL CIENTO CUARENTA Y SIETE CON TREINTA CENTAVOS \(\$3\.218\.147,30\), con cargo al Ejercicio Financiero 2026\./);
  assert.match(texto, /obrante a fs\. 8\/13 y cuadro de costos que luce a fs\. 14\./);
  assert.equal(p.expediente, "13-13222/26");
  assert.equal(p.firma, "DEPARTAMENTO DE INFORMATICA Y VARIOS");
  assert.equal(p.agente, "AM");
  assert.equal(p.lugarYFecha, "Buenos Aires, ...... de .................... de 2026");
});
