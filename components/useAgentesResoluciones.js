"use client";

import { useEffect, useState } from "react";

// Agentes de Resoluciones desde la base (los administra Soporte). Se piden
// una vez por carga de página. `activos`: las siglas a las que se puede
// asignar; `inactivos`: las que pasaron por el depto. y ya no están.
let pedido = null;

function pedirAgentes() {
  if (!pedido) {
    pedido = fetch("/api/resoluciones/agentes")
      .then(r => (r.ok ? r.json() : { agentes: [] }))
      .then(d => d.agentes || [])
      .catch(() => { pedido = null; return []; });
  }
  return pedido;
}

export function useAgentesResoluciones() {
  const [agentes, setAgentes] = useState(null);
  useEffect(() => {
    let vivo = true;
    pedirAgentes().then(a => { if (vivo) setAgentes(a); });
    return () => { vivo = false; };
  }, []);
  const lista = agentes || [];
  return {
    cargado: agentes !== null,
    activos: lista.filter(a => a.activo).map(a => a.sigla),
    inactivos: lista.filter(a => !a.activo).map(a => a.sigla),
  };
}
