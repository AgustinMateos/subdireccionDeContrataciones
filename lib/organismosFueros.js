// Tabulación de organismos judiciales y sus fueros a partir del padrón
// unificado (lib/organismos_fueros_unificado.json): cada "camara" es un
// fuero (la cámara identifica la jurisdicción/rama judicial — Civil,
// Comercial, Criminal, etc. — no una oficina puntual), y sus "dependencia"
// son los organismos concretos (juzgados/secretarías puntuales) que se
// buscan dentro de ese fuero una vez elegido.

import datos from "./organismos_fueros_unificado.json";

const registros = datos.registros || [];

function normalizar(s) {
  return String(s || "").trim().toLowerCase();
}

// Fueros judiciales del padrón (para sumar a la lista de fueros).
export const FUEROS_JUDICIALES = Array.from(new Set(registros.map(r => r.camara))).sort();

// Organismos (dependencias) de los fueros ya elegidos. Si ninguno de los
// fueros seleccionados está en el padrón, devuelve todos los organismos
// conocidos como sugerencia general.
export function organismosDeFueros(fueros) {
  const seleccionados = (fueros || []).map(normalizar).filter(Boolean);
  const coincidencias = seleccionados.length
    ? registros.filter(r => seleccionados.includes(normalizar(r.camara)))
    : [];
  const fuente = coincidencias.length ? coincidencias : registros;
  return Array.from(new Set(fuente.map(r => r.dependencia))).sort();
}

// Direcciones del padrón para los fueros/organismos dados — el organismo es
// opcional y solo acota el resultado cuando se cargó alguno; sin organismo,
// suma las direcciones de todas las dependencias conocidas de esos fueros.
// Si no coincide ningún fuero pero sí se cargó un organismo, lo busca en
// todo el padrón (por si el fuero cargado no está tabulado tal cual, pero
// el organismo sí es reconocible).
export function direccionesDe(fueros, organismos) {
  const fue = (fueros || []).map(normalizar).filter(Boolean);
  const orgs = (organismos || []).map(normalizar).filter(Boolean);
  if (fue.length === 0 && orgs.length === 0) return [];

  if (orgs.length === 0) {
    const porFuero = registros.filter(r => fue.includes(normalizar(r.camara)));
    return Array.from(new Set(porFuero.flatMap(r => r.direcciones || [])));
  }

  const porFueroYOrganismo = registros.filter(r =>
    orgs.includes(normalizar(r.dependencia)) && fue.includes(normalizar(r.camara))
  );
  const coincidencias = (fue.length && porFueroYOrganismo.length)
    ? porFueroYOrganismo
    : registros.filter(r => orgs.includes(normalizar(r.dependencia)));
  return Array.from(new Set(coincidencias.flatMap(r => r.direcciones || [])));
}
