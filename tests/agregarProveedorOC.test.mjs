// Órdenes de Compra: agregar un proveedor a un expediente ya cargado y
// correr +1 las OC desde el N° que toma. Correr con `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { numeroOCEntero, ordenesACorrer } from "../lib/numeroOC.js";

test("el N° de OC como entero", () => {
  assert.equal(numeroOCEntero("146"), 146);
  assert.equal(numeroOCEntero(" 146 "), 146);
  assert.equal(numeroOCEntero("549/2026"), null);
  assert.equal(numeroOCEntero(""), null);
  assert.equal(numeroOCEntero(null), null);
});

test("se corren la que tiene el N° y todas las de N° mayor", () => {
  const ordenes = [{ numeroOC: "10" }, { numeroOC: "11" }, { numeroOC: "12" }, { numeroOC: "13" }, { numeroOC: "14" }, { numeroOC: "549/2026" }, { numeroOC: null }];
  assert.deepEqual(ordenesACorrer(ordenes, "13").map(o => o.numeroOC), ["13", "14"]);
  assert.deepEqual(ordenesACorrer(ordenes, "15"), []);
  assert.deepEqual(ordenesACorrer(ordenes, "abc"), []);
});
