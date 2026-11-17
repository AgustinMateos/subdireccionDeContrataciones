// Cuadro de Informática y Varios: qué es la continuidad / renovación y
// cuánto se corrió el inicio real respecto del estimado. Correr con `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { demoraInicioIyV, clasesIyV, unirClasesIyV, subirBloqueIyV } from "../lib/cuadroIyV.js";

test("empezó después de lo estimado", () => {
  assert.deepEqual(demoraInicioIyV("1/3/2026", "15/3/2026"), { dias: 14, meses: 0, texto: "14 días" });
  const p = demoraInicioIyV("1/3/2026", "16/5/2026");
  assert.equal(p.texto, "2 meses y 15 días");
  assert.equal(p.dias, 76);
});

test("empezó antes o en la fecha estimada", () => {
  assert.deepEqual(demoraInicioIyV("1/3/2026", "20/2/2026"), { dias: -9, meses: 0, texto: "9 días" });
  assert.equal(demoraInicioIyV("1/3/26", "01/03/2026").dias, 0);
});

test("sin alguna fecha no hay nada que comparar", () => {
  assert.equal(demoraInicioIyV("1/1/2026", ""), null);
  assert.equal(demoraInicioIyV("hola", "1/1/2026"), null);
});

test("uno o varios: se guardan en el orden de la lista", () => {
  assert.equal(unirClasesIyV(["Servicio", "Bien de uso"]), "Bien de uso / Servicio");
  assert.deepEqual(clasesIyV("Bien de uso / Servicio"), ["Bien de uso", "Servicio"]);
  assert.deepEqual(clasesIyV(""), []);
});

test("al pasar la renovación a continuidad, viajan qué es y las fechas estimadas", () => {
  const { datos, notas } = subirBloqueIyV(
    { rExp: "13-00001/26", rClase: "Servicio", rInicioEstimado: "1/1/2027", rVencimientoEstimado: "31/12/2027" },
    "renovacion", "continuidad",
  );
  assert.equal(datos.cClase, "Servicio");
  assert.equal(datos.cInicioEstimado, "1/1/2027");
  assert.equal(datos.cVencimientoEstimado, "31/12/2027");
  assert.equal(datos.rClase, undefined);
  assert.deepEqual(notas, []);
});

test("meses del atraso: del estimado al día anterior al inicio real", async () => {
  const { mesesDeAtrasoIyV } = await import("../lib/cuadroIyV.js");
  assert.deepEqual(mesesDeAtrasoIyV("1/3/2026", "16/5/2026", "2026-11-17"), ["2026-03", "2026-04", "2026-05"]);
  assert.deepEqual(mesesDeAtrasoIyV("20/3/2026", "1/4/2026", "2026-11-17"), ["2026-03"]);
  assert.deepEqual(mesesDeAtrasoIyV("15/12/2025", "10/2/2026", "2026-11-17"), ["2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(mesesDeAtrasoIyV("1/3/2026", "1/3/2026", "2026-11-17"), []);
  assert.deepEqual(mesesDeAtrasoIyV("1/3/2026", "20/2/2026", "2026-11-17"), []);
});

test("si todavía no empezó, el atraso corre hasta hoy", async () => {
  const { mesesDeAtrasoIyV } = await import("../lib/cuadroIyV.js");
  assert.deepEqual(mesesDeAtrasoIyV("10/9/2026", "", "2026-11-17"), ["2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(mesesDeAtrasoIyV("1/12/2026", "", "2026-11-17"), []);
});

test("los motivos por mes se guardan como texto, un mes por renglón", async () => {
  const { leerMotivosAtrasoIyV, unirMotivosAtrasoIyV } = await import("../lib/cuadroIyV.js");
  const texto = unirMotivosAtrasoIyV({ "2026-04": "Impugnación", "2026-03": "Sin ofertas", "2026-05": "" });
  assert.equal(texto, "03/2026: Sin ofertas\n04/2026: Impugnación");
  assert.deepEqual(leerMotivosAtrasoIyV(texto), { "2026-03": "Sin ofertas", "2026-04": "Impugnación" });
});

test("al pasar la renovación a continuidad, viajan los motivos del atraso", () => {
  const { datos } = subirBloqueIyV({ rExp: "13-00002/26", rMotivosAtraso: "03/2026: Impugnación" }, "renovacion", "continuidad");
  assert.equal(datos.cMotivosAtraso, "03/2026: Impugnación");
});
