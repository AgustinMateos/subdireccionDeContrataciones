// Presupuestos de bienes de uso por título (las planillas del año) y qué
// expedientes encuadran en cada título. El cruce es por palabras del texto
// del expediente (objeto, y en Licitaciones también el rubro), sin tildes y
// en mayúsculas: `claves` dice qué tiene que aparecer y `excluye`, qué no.
// Un título sin `claves` (las previsiones) no se cruza solo.
// Lo usan el Cuadro de Informática y Varios (lib/presupuestoIyV.js) y
// Licitaciones (lib/presupuestoLicitaciones.js).
import { sinTildesMayus } from "./inciso4.js";

export const renglon = (descripcion, monto, claves, excluye) => ({ descripcion, monto, claves, excluye });

// def: { anio, fuente, tipos: [{ id, titulo, subtitulo, partidas, total, secciones: [{ titulo, renglones }] }] }
// Suma `renglones` (cada uno con id "tipo-n", tipo y sección), `suma(tipo?)`
// (lo que suman los renglones) y `renglonesDe(texto)` (los títulos donde
// encuadra; si es más de uno, queda "a revisar").
export function armarPresupuesto(def) {
  const renglones = def.tipos.flatMap(t => {
    let i = 0;
    return t.secciones.flatMap(s => s.renglones.map(x => ({ ...x, id: t.id + "-" + i++, tipo: t.id, seccion: s.titulo })));
  });
  return {
    ...def,
    renglones,
    total: def.tipos.reduce((s, t) => s + t.total, 0),
    suma: tipo => renglones.filter(x => !tipo || x.tipo === tipo).reduce((s, x) => s + x.monto, 0),
    renglonesDe(texto) {
      const o = sinTildesMayus(texto).replace(/\s+/g, " ").trim();
      if (!o) return [];
      return renglones.filter(x => x.claves && x.claves.test(o) && !(x.excluye && x.excluye.test(o)));
    },
  };
}
