// Presupuestos de bienes de uso por título (las planillas del año) y qué
// expedientes encuadran en cada título. El cruce es por palabras del texto
// del expediente (objeto, y en Licitaciones también el rubro), sin tildes y
// en mayúsculas: `claves` dice qué tiene que aparecer y `excluye`, qué no.
// Un título sin `claves` (las previsiones) no se cruza solo.
// `partidas` (opcional): el título toma además todos los expedientes de esa
// partida, digan lo que digan (p. ej. 4.2 Construcciones).
// Lo usan el Cuadro de Informática y Varios (lib/presupuestoIyV.js) y
// Licitaciones (lib/presupuestoLicitaciones.js).
import { sinTildesMayus } from "./inciso4.js";

export const renglon = (descripcion, monto, claves, excluye, partidas) => ({ descripcion, monto, claves, excluye, partidas });

// def: { anio, fuente, tipos: [{ id, titulo, subtitulo, partidas, total, secciones: [{ titulo, renglones }] }] }
// Suma `renglones` (cada uno con id "tipo-n", tipo y sección), `suma(tipo?)`
// (lo que suman los renglones) y `renglonesDe(texto, partida)` (los títulos
// donde encuadra; si es más de uno, queda "a revisar"). Un monto null es un
// título sin monto cargado todavía.
export function armarPresupuesto(def) {
  const renglones = def.tipos.flatMap(t => {
    let i = 0;
    return t.secciones.flatMap(s => s.renglones.map(x => ({ ...x, id: t.id + "-" + i++, tipo: t.id, seccion: s.titulo })));
  });
  return {
    ...def,
    renglones,
    total: def.tipos.reduce((s, t) => s + (t.total || 0), 0),
    suma: tipo => renglones.filter(x => !tipo || x.tipo === tipo).reduce((s, x) => s + (x.monto || 0), 0),
    renglonesDe(texto, partida) {
      const o = sinTildesMayus(texto).replace(/\s+/g, " ").trim();
      return renglones.filter(x => (partida && x.partidas?.includes(partida))
        || (o && x.claves && x.claves.test(o) && !(x.excluye && x.excluye.test(o))));
    },
  };
}
