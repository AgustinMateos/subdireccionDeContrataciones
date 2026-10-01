"use client";

import { useEffect, useRef } from "react";
import { direccionesDe } from "@/lib/organismosFueros";

// Con el fuero (cámara) cargado, suma a "Domicilios/renglones" las
// direcciones asociadas en el padrón. Recuerda cuáles agregó sola: si
// después cambia el fuero, saca las
// que ya no corresponden y suma las nuevas, sin tocar las cargadas a mano.
// Con `omitirInicial` no sugiere al montar (al editar, los domicilios ya
// guardados se respetan tal cual) — solo reacciona a cambios posteriores.
export default function useDireccionesSugeridas({ fuero, activo, setF, omitirInicial = false }) {
  const autoAgregadas = useRef([]);
  const clave = JSON.stringify(fuero || []);
  const claveInicial = useRef(clave);

  useEffect(() => {
    // Comparar contra la clave inicial (y no un flag de "primer render")
    // también cubre el doble montaje de StrictMode en desarrollo.
    if (omitirInicial && clave === claveInicial.current && autoAgregadas.current.length === 0) return;
    if (!activo) return;
    const sugeridas = direccionesDe(fuero);
    const anteriores = autoAgregadas.current;
    autoAgregadas.current = sugeridas;
    setF(prev => {
      const actuales = prev.domiciliosRenglones || [];
      const sinViejas = actuales.filter(d => !anteriores.includes(d) || sugeridas.includes(d));
      const nuevas = sugeridas.filter(d => !sinViejas.includes(d));
      if (nuevas.length === 0 && sinViejas.length === actuales.length) return prev;
      return { ...prev, domiciliosRenglones: [...sinViejas, ...nuevas] };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, activo]);
}
