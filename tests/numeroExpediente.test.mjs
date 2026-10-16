// Formato del N° de expediente (NN-NNNNN/AAAA). Correr con `npm test`.
// Los casos son formas que aparecen en las planillas cargadas.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mismoExp, normalizarExp } from "../lib/numeroExpediente.js";

test("pasa al formato NN-NNNNN/AAAA", () => {
  const casos = {
    "13-13222/26": "13-13222/2026",
    "13-13222/2026": "13-13222/2026",
    "13-0092/26": "13-00092/2026",
    "13-03/23": "13-00003/2023",
    "13-009/2026": "13-00009/2026",
    "13-000999/2026": "13-00999/2026",
    "13-13816-25": "13-13816/2025",
    "13=08869/26": "13-08869/2026",
    "13.11892/25": "13-11892/2025",
    "13.-07348/25": "13-07348/2025",
    " 13 - 13222 / 26 ": "13-13222/2026",
  };
  for (const [antes, despues] of Object.entries(casos)) assert.equal(normalizarExp(antes), despues, antes);
});

test("respeta el resto del texto", () => {
  assert.equal(normalizarExp("REF. 14-10868/25"), "REF. 14-10868/2025");
  assert.equal(normalizarExp("REF: 14-08675/26"), "REF: 14-08675/2026");
  assert.equal(normalizarExp("13-06148/26-LA"), "13-06148/2026-LA");
  assert.equal(normalizarExp("13-06148/26-LA2"), "13-06148/2026-LA2");
  assert.equal(normalizarExp("13-06148/26-ANT"), "13-06148/2026-ANT");
  assert.equal(normalizarExp("13-02631/26 y 13-02627/26"), "13-02631/2026 y 13-02627/2026");
  assert.equal(normalizarExp("13-02834/25 EDA 448/25"), "13-02834/2025 EDA 448/25");
  assert.equal(normalizarExp("13-07092/23 (EDA 636/23)"), "13-07092/2023 (EDA 636/23)");
  assert.equal(normalizarExp("13-02694/26."), "13-02694/2026.");
});

test("no toca lo que no es un N° de expediente", () => {
  for (const t of ["mateos", "999", "-", "(sin N°)", "13-14451/5", "14-12779725", "10-06-26", "13-009",
    "Resolución N° 3262-26 los renglones 1 al 8", "Apertura 10/06/26 a las 10 hs", "CD N° 967/24"]) {
    assert.equal(normalizarExp(t), t, t);
  }
  assert.equal(normalizarExp(null), null);
});

test("mismo expediente escrito distinto", () => {
  assert.ok(mismoExp("13-13222/26", "13-13222/2026"));
  assert.ok(mismoExp("13-0092/26", "13-00092/2026"));
  assert.ok(mismoExp("ref. 14-10868/25", "REF. 14-10868/2025"));
  assert.ok(!mismoExp("13-13222/26", "13-13222/2025"));
  assert.ok(!mismoExp("", ""));
});
