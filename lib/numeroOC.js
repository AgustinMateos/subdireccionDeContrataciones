// N° de orden de compra (sin dependencias, para poder probarlo con node).

// El N° de OC como entero ("146", " 146 "), o null si no es solo un número.
export function numeroOCEntero(v) {
  const t = String(v ?? "").trim();
  return /^\d+$/.test(t) ? Number(t) : null;
}

// Las OC que se corren +1 si un proveedor nuevo toma el N° `numero`: esa y
// todas las de N° mayor (la numeración es una sola, de un año al otro).
export function ordenesACorrer(ordenes, numero) {
  const n = numeroOCEntero(numero);
  return n == null ? [] : ordenes.filter(o => (numeroOCEntero(o.numeroOC) ?? -1) >= n);
}
