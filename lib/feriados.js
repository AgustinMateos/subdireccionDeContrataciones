// Solo servidor: feriados nacionales (inamovibles, trasladables y puentes)
// de la API de ArgentinaDatos, con cache para no consultarla en cada
// cálculo.
//  - En memoria, por año, durante CACHE_MS (un año ya pedido se reusa en
//    el mismo proceso; si la consulta falla, no queda guardada).
//  - En el Data Cache de Next (`revalidate`), que sobrevive entre
//    procesos y deploys.
// Se revalida una vez por día porque el Gobierno puede agregar feriados o
// puentes por decreto durante el año.

import { aniosDelCalculo, calcularVencimientos } from "./diasHabiles.js";

export const URL_FERIADOS = "https://api.argentinadatos.com/v1/feriados/";
const CACHE_MS = 24 * 60 * 60 * 1000;

const cache = new Map(); // año → { hasta, pedido: Promise<{ fecha, nombre, tipo }[]> }

async function pedirAnio(anio, fetcher) {
  const res = await fetcher(URL_FERIADOS + anio, { next: { revalidate: CACHE_MS / 1000 } });
  if (!res.ok) throw new Error("No se pudieron traer los feriados de " + anio + " (ArgentinaDatos respondió " + res.status + ")");
  const lista = await res.json();
  if (!Array.isArray(lista)) throw new Error("Respuesta inesperada de ArgentinaDatos para " + anio);
  return lista.map(f => ({ fecha: String(f.fecha).slice(0, 10), nombre: f.nombre || "Feriado", tipo: f.tipo || "" }));
}

// Feriados de esos años con nombre y tipo ({ fecha: "aaaa-mm-dd", nombre,
// tipo }), para mostrarlos en los calendarios. `fetcher` es para los tests.
export async function feriadosConNombre(anios, { fetcher = fetch, ahora = Date.now() } = {}) {
  const listas = await Promise.all(anios.map(anio => {
    const guardado = cache.get(anio);
    if (guardado && guardado.hasta > ahora) return guardado.pedido;
    const pedido = pedirAnio(anio, fetcher);
    cache.set(anio, { hasta: ahora + CACHE_MS, pedido });
    pedido.catch(() => { if (cache.get(anio)?.pedido === pedido) cache.delete(anio); });
    return pedido;
  }));
  return listas.flat();
}

// Feriados de esos años, como Set de "aaaa-mm-dd" (para contar hábiles).
export async function feriadosDe(anios, opciones) {
  return new Set((await feriadosConNombre(anios, opciones)).map(f => f.fecha));
}

// Vencimientos del art. 44 y de la OC para una fecha de publicación
// ("aaaa-mm-dd"; y la de notificación del art. 44 si ya la hay), con los
// feriados de los años que cruza.
export async function vencimientosDePublicacion(fechaPublicacion, { fechaNotificacion44, ...opciones } = {}) {
  const feriados = await feriadosDe(aniosDelCalculo(fechaPublicacion, fechaNotificacion44), opciones);
  return calcularVencimientos(fechaPublicacion, feriados, { fechaNotificacion44 });
}

export function vaciarCacheFeriados() {
  cache.clear();
}
