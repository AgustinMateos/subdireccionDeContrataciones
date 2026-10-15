// Vencimientos del art. 44 y de la OC. Correr con `npm test`.
// Los feriados son los de ArgentinaDatos (copiados acá para que los tests
// no dependan de la red); los casos de la planilla de Órdenes de Compra
// llevan su N° de OC.

import { test } from "node:test";
import assert from "node:assert/strict";
import { aniosDelCalculo, calcularVencimientos, esHabil, sumarDiasHabiles } from "../lib/diasHabiles.js";
import { URL_FERIADOS, feriadosDe, vaciarCacheFeriados, vencimientosDePublicacion } from "../lib/feriados.js";

const FERIADOS_API = {
  2025: ["2025-01-01", "2025-03-03", "2025-03-04", "2025-03-24", "2025-04-02", "2025-04-18", "2025-05-01", "2025-05-02",
    "2025-05-25", "2025-06-16", "2025-06-20", "2025-07-09", "2025-08-15", "2025-08-17", "2025-10-10", "2025-10-12",
    "2025-11-21", "2025-11-24", "2025-12-08", "2025-12-25"],
  2026: ["2026-01-01", "2026-02-16", "2026-02-17", "2026-03-23", "2026-03-24", "2026-04-02", "2026-04-03", "2026-05-01",
    "2026-05-25", "2026-06-15", "2026-06-20", "2026-07-09", "2026-07-10", "2026-08-17", "2026-10-12", "2026-11-09",
    "2026-11-23", "2026-12-07", "2026-12-08", "2026-12-25"],
  // Solo el que importa para los casos que cruzan a 2027.
  2027: ["2027-01-01"],
};
const FERIADOS = new Set(Object.values(FERIADOS_API).flat());

// Hace de la API: responde cada año y cuenta las consultas.
function apiFalsa({ falla = false } = {}) {
  const pedidos = [];
  const fetcher = async url => {
    const anio = Number(url.slice(URL_FERIADOS.length));
    pedidos.push(anio);
    if (falla) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => (FERIADOS_API[anio] || []).map(fecha => ({ fecha, tipo: "inamovible", nombre: "" })) };
  };
  return { fetcher, pedidos };
}

const vencimientos = (publicacion, notificacion) =>
  calcularVencimientos(publicacion, FERIADOS, notificacion ? { fechaNotificacion44: notificacion } : undefined);

test("ejemplo: publicación 29/12/2025 → art. 44 05/01/2026 → OC 19/01/2026 (OC 1 a 4)", () => {
  // 30/12 es el 1.º hábil; 31/12 (judicial) y 1/1 (feriado) no cuentan.
  assert.deepEqual(vencimientos("2025-12-29"), { fechaArt44: "2026-01-05", fechaLimiteOC: "2026-01-19" });
});

test("cruza Navidad, 24 y 31 de diciembre y Año Nuevo (OC 5)", () => {
  assert.deepEqual(vencimientos("2025-12-15"), { fechaArt44: "2025-12-18", fechaLimiteOC: "2026-01-07" });
});

test("cruza a un año siguiente: publicación 21/12/2026 → OC en 2027", () => {
  assert.deepEqual(vencimientos("2026-12-21"), { fechaArt44: "2026-12-28", fechaLimiteOC: "2027-01-13" });
});

test("16 de noviembre, Día del Trabajador Judicial, y feriado trasladable del 23/11", () => {
  assert.equal(esHabil("2026-11-16", FERIADOS), false);
  assert.deepEqual(vencimientos("2026-11-12"), { fechaArt44: "2026-11-18", fechaLimiteOC: "2026-12-03" });
});

test("Carnaval (OC 53): sin notificación, desde el vencimiento del art. 44", () => {
  assert.deepEqual(vencimientos("2026-02-04"), { fechaArt44: "2026-02-09", fechaLimiteOC: "2026-02-25" });
});

test("Carnaval (OC 53): notificado antes del vencimiento, los 10 días corren desde la notificación", () => {
  assert.deepEqual(vencimientos("2026-02-04", "2026-02-06"), { fechaArt44: "2026-02-09", fechaLimiteOC: "2026-02-24" });
});

test("notificado antes del vencimiento (OC 39)", () => {
  assert.deepEqual(vencimientos("2026-01-23", "2026-01-27"), { fechaArt44: "2026-01-28", fechaLimiteOC: "2026-02-10" });
});

test("publicación un sábado, antes de un puente y un feriado (23 y 24/3) y de Semana Santa", () => {
  assert.deepEqual(vencimientos("2026-03-21"), { fechaArt44: "2026-03-27", fechaLimiteOC: "2026-04-14" });
});

test("el 24 y el 31 de diciembre que caen en fin de semana no cambian nada", () => {
  // En 2022 el 24/12 fue sábado.
  assert.equal(esHabil("2022-12-24", new Set()), false);
  assert.equal(sumarDiasHabiles("2022-12-22", 1, new Set()), "2022-12-23");
  assert.equal(sumarDiasHabiles("2022-12-23", 1, new Set()), "2022-12-26");
});

test("fechas inválidas", () => {
  assert.throws(() => vencimientos("29/12/2025"), /inválida/);
  assert.throws(() => vencimientos("2026-02-30"), /inválida/);
  assert.throws(() => vencimientos("2026-02-04", "06/02/2026"), /inválida/);
});

test("años que hay que consultar", () => {
  assert.deepEqual(aniosDelCalculo("2025-12-29"), [2025, 2026]);
  assert.deepEqual(aniosDelCalculo("2025-12-29", "2026-01-02"), [2025, 2026, 2027]);
});

test("cache: cada año se consulta una sola vez", async () => {
  vaciarCacheFeriados();
  const { fetcher, pedidos } = apiFalsa();
  const r = await vencimientosDePublicacion("2025-12-29", { fetcher });
  assert.deepEqual(r, { fechaArt44: "2026-01-05", fechaLimiteOC: "2026-01-19" });
  await vencimientosDePublicacion("2025-12-15", { fetcher });
  await vencimientosDePublicacion("2026-03-21", { fetcher });
  assert.deepEqual(pedidos.sort(), [2025, 2026, 2027]);
});

test("cache: vence a las 24 horas", async () => {
  vaciarCacheFeriados();
  const { fetcher, pedidos } = apiFalsa();
  await feriadosDe([2026], { fetcher, ahora: 0 });
  await feriadosDe([2026], { fetcher, ahora: 23 * 3600 * 1000 });
  await feriadosDe([2026], { fetcher, ahora: 25 * 3600 * 1000 });
  assert.deepEqual(pedidos, [2026, 2026]);
});

test("cache: si la API falla, el error no queda guardado", async () => {
  vaciarCacheFeriados();
  await assert.rejects(feriadosDe([2026], { fetcher: apiFalsa({ falla: true }).fetcher }), /503/);
  const { fetcher, pedidos } = apiFalsa();
  assert.ok((await feriadosDe([2026], { fetcher })).has("2026-02-16"));
  assert.deepEqual(pedidos, [2026]);
});
