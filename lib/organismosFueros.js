// Tabulación de organismos judiciales y sus fueros a partir del padrón
// unificado (lib/organismos_fueros_unificado.json): cada "camara" es un
// organismo, y sus "dependencia" son los fueros que se buscan dentro de ese
// organismo una vez elegido.

import datos from "./organismos_fueros_unificado.json";

const registros = datos.registros || [];

function normalizar(s) {
  return String(s || "").trim().toLowerCase();
}

// Organismos judiciales del padrón (para sumar a la lista de organismos).
export const ORGANISMOS_JUDICIALES = Array.from(new Set(registros.map(r => r.camara))).sort();

// Fueros (dependencias) de los organismos ya elegidos. Si ninguno de los
// organismos seleccionados está en el padrón, devuelve todos los fueros
// conocidos como sugerencia general.
export function fuerosDeOrganismos(organismos) {
  const seleccionados = (organismos || []).map(normalizar).filter(Boolean);
  const coincidencias = seleccionados.length
    ? registros.filter(r => seleccionados.includes(normalizar(r.camara)))
    : [];
  const fuente = coincidencias.length ? coincidencias : registros;
  return Array.from(new Set(fuente.map(r => r.dependencia))).sort();
}

// Direcciones del padrón para uno o más fueros (dependencia), acotadas a los
// organismos dados si coinciden alguno; si no coincide ningún organismo,
// busca el fuero en todo el padrón (por si el organismo cargado no está
// tabulado tal cual, pero el fuero sí es reconocible).
export function direccionesDe(organismos, fueros) {
  const orgs = (organismos || []).map(normalizar).filter(Boolean);
  const deps = (fueros || []).map(normalizar).filter(Boolean);
  if (deps.length === 0) return [];
  const porFueroYOrganismo = registros.filter(r =>
    deps.includes(normalizar(r.dependencia)) && orgs.includes(normalizar(r.camara))
  );
  const coincidencias = (orgs.length && porFueroYOrganismo.length)
    ? porFueroYOrganismo
    : registros.filter(r => deps.includes(normalizar(r.dependencia)));
  return Array.from(new Set(coincidencias.flatMap(r => r.direcciones || [])));
}
