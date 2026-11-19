// Presupuesto 2026 del Cuadro de Informática y Varios: totales de las
// planillas y en qué título encuadra cada objeto. Correr con `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESUPUESTO_IYV, totalPresupuestoIyV, renglonesDeObjetoIyV } from "../lib/presupuestoIyV.js";

const titulos = o => renglonesDeObjetoIyV(o).map(x => x.descripcion);

test("los renglones suman el total de cada planilla (salvo redondeo de centavos)", () => {
  for (const t of PRESUPUESTO_IYV.tipos) assert.ok(Math.abs(totalPresupuestoIyV(t.id) - t.total) <= 5, t.id);
});

test("cada objeto va a su título", () => {
  assert.deepEqual(titulos("Provisión de computadoras personales"), ["Computadoras personales (reemplazo/incremento)"]);
  assert.deepEqual(titulos("Adquisición de notebooks"), ["Notebooks"]);
  assert.deepEqual(titulos("Provisión de escáneres"), ["Provisión Escáneres"]);
  assert.deepEqual(titulos("Firewall Sonicwall"), ["Firewall Sonicwall"]);
  assert.deepEqual(titulos("Software de monitoreo SNMP"), ["Software Monitoreo SNMP"]);
  assert.deepEqual(titulos("Licencias Oracle"), ["Licencias para SGJ y SGE - Base de Datos Oracle"]);
  assert.deepEqual(titulos("Mantenimiento de cámaras de videovigilancia"), ["Mantenimiento sistemas de videovigilancia C.A.B.A"]);
  assert.deepEqual(titulos("Pendrives 128 GB"), ["Pendrives 128 Gb"]);
});

test("lo ambiguo encuadra en más de un título y lo que no es del área, en ninguno", () => {
  assert.equal(titulos("Discos externos USB").length, 2);
  assert.deepEqual(titulos("Provisión de tóner"), []);
  assert.deepEqual(titulos(""), []);
});
