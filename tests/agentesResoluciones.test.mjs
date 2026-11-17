// Asignación de agentes de Resoluciones: solo a los activos. Correr con `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { agentePermitido, normalizarSiglaAgente } from "../lib/resoluciones.js";

const ACTIVOS = ["LRB", "MLA", "JC", "SR", "AUG"];

test("se puede asignar a un activo o dejar sin asignar", () => {
  assert.equal(agentePermitido("LRB", ACTIVOS, null), true);
  assert.equal(agentePermitido("", ACTIVOS, "CG"), true);
  assert.equal(agentePermitido(null, ACTIVOS, "CG"), true);
});

test("no se puede asignar a un inactivo", () => {
  assert.equal(agentePermitido("CG", ACTIVOS, null), false);
  assert.equal(agentePermitido("CG", ACTIVOS, "LRB"), false);
});

test("si el expediente ya lo tenía, se puede guardar igual", () => {
  assert.equal(agentePermitido("CG", ACTIVOS, "CG"), true);
});

test("la sigla se guarda en mayúsculas y sin espacios", () => {
  assert.equal(normalizarSiglaAgente("  l rb "), "LRB");
  assert.equal(normalizarSiglaAgente(null), "");
});
