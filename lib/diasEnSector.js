// Días en sector de un expediente de Resoluciones y su semáforo (la
// columna "Días en sector" del panel y los gráficos de la jefa).

import { HOY } from "./constants";
import { esCompletado, fechaISO } from "./resoluciones";

// Días desde que ingresó al sector (la fecha de ingreso queda fija como se
// cargó; el último movimiento se renueva al cambiar de sector y no mueve
// el semáforo). Sin fecha de ingreso, desde el último movimiento. Un
// completado ya se fue del sector: no cuenta (null).
export function diasEnSector(e) {
  if (esCompletado(e)) return null;
  const f = fechaISO(e.fechaIngreso) || fechaISO(e.fechaUltimoMov);
  if (!f) return null;
  return Math.round((HOY - new Date(f + "T00:00:00")) / 86400000);
}

// Semáforo: hasta 10 verde, de 11 a 15 amarillo, más de 15 rojo.
export function alertaDias(dias) {
  if (dias <= 10) return "verde";
  if (dias <= 15) return "amarillo";
  return "rojo";
}
