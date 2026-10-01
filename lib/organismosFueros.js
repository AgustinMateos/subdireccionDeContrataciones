// Tabulación de organismos judiciales y sus fueros a partir del padrón
// unificado (lib/organismos_fueros_unificado.json): cada "camara" es un
// fuero (la cámara identifica la jurisdicción/rama judicial — Civil,
// Comercial, Criminal, etc. — no una oficina puntual), y sus "dependencia"
// son los organismos concretos (juzgados/secretarías puntuales), cuyas
// direcciones se sugieren al elegir el fuero.

import datos from "./organismos_fueros_unificado.json";

const registros = datos.registros || [];

function normalizar(s) {
  return String(s || "").trim().toLowerCase();
}

// Fueros judiciales del padrón (para sumar a la lista de fueros).
export const FUEROS_JUDICIALES = Array.from(new Set(registros.map(r => r.camara))).sort();

// Direcciones del padrón de los fueros (camara) dados: todas las de sus
// dependencias. El organismo se carga a mano y no interviene.
export function direccionesDe(fueros) {
  const fue = (fueros || []).map(normalizar).filter(Boolean);
  if (fue.length === 0) return [];
  const coincidencias = registros.filter(r => fue.includes(normalizar(r.camara)));
  return Array.from(new Set(coincidencias.flatMap(r => r.direcciones || [])));
}
