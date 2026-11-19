// Qué encuadres no llevan orden de compra (Licitaciones y Cuadro IyV). Correr con `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { noLlevaOrdenCompra } from "../lib/inciso4.js";

test("no llevan orden de compra", () => {
  for (const t of ["C.DESCENT.", "descentralizada", "Contratación descentralizada N° 3/26", "COMP. ABREV. X URG.", "Compulsa abreviada por urgencia",
    "Aprobación de Gastos", "ANT. DE FONDOS", "Ant. de Fondos.", "Anticipo de fondos"]) assert.equal(noLlevaOrdenCompra(t), true, t);
});

test("sí llevan orden de compra", () => {
  for (const t of ["L.PUBLICA", "L.PRIVADA", "C.DIRECTA", "TS", "EXCLUSIVIDAD", "AMPLIACION O.C", "Licitación pública N° 9/25", "Interadministrativo", ""]) {
    assert.equal(noLlevaOrdenCompra(t), false, t);
  }
});
