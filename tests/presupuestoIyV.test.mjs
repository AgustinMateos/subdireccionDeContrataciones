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

// Licitaciones: Mobiliario, maquinaria y equipamiento (por objeto y rubro).
import { PRESUPUESTO_LICITACIONES } from "../lib/presupuestoLicitaciones.js";
const tituloLic = (objeto, rubro = "") => PRESUPUESTO_LICITACIONES.renglonesDe(objeto + " " + rubro).map(x => x.descripcion);

test("Licitaciones: los renglones suman el total de la planilla", () => {
  for (const t of PRESUPUESTO_LICITACIONES.tipos) assert.ok(Math.abs(PRESUPUESTO_LICITACIONES.suma(t.id) - t.total) <= 5, t.id);
});

test("Licitaciones: cada objeto va a su título", () => {
  assert.deepEqual(tituloLic("Provisión e instalación de equipos", "AA"), ["Equipos de Aire Acondicionado / Termomecánica"]);
  assert.deepEqual(tituloLic("Adquisición de sillas y escritorios", "MOBILIARIO"), ["Dependencias Total País"]);
  assert.deepEqual(tituloLic("Provisión de heladeras y microondas", "ELECTRODOMESTICO"), ["Desfibriladores / Electrodomésticos"]);
  assert.deepEqual(tituloLic("Recarga de matafuegos"), ["Matafuegos / Iluminación Emergencia"]);
  assert.deepEqual(tituloLic("Sistema de detección de incendio"), ["Provisión de Sistema Detección Incendio"]);
  assert.deepEqual(tituloLic("Provisión de resmas", "RESMAS"), []);
});

test("Licitaciones: los de la partida 4.2 van a Construcciones y remodelaciones", () => {
  const tit = (objeto, partida) => PRESUPUESTO_LICITACIONES.renglonesDe(objeto, partida).map(x => x.descripcion);
  assert.deepEqual(tit("Refacción integral del edificio de Tribunales", "4.2"), ["Construcciones y remodelaciones"]);
  assert.deepEqual(tit("Refacción integral del edificio de Tribunales", "4.3"), []);
  assert.deepEqual(tit("Provisión de sillas", "4.3"), ["Dependencias Total País"]);
});
