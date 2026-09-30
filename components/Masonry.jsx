"use client";

import { Children, useEffect, useState } from "react";

// Grilla tipo "masonry" (estilo ClickUp): cada columna apila sus tarjetas sin
// esperar a que termine la fila de al lado, así una card alta (o una que se
// despliega) no deja huecos en las vecinas. Las tarjetas se reparten en
// orden de izquierda a derecha, fila por fila, y cada una se queda siempre en
// su columna — al abrir una card solo se corre lo que tiene debajo.
// Mismos cortes que la grilla anterior: 1 col, 2 desde sm, 3 desde lg.
function useColumnas() {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const calcular = () => setCols(lg.matches ? 3 : sm.matches ? 2 : 1);
    calcular();
    sm.addEventListener("change", calcular);
    lg.addEventListener("change", calcular);
    return () => {
      sm.removeEventListener("change", calcular);
      lg.removeEventListener("change", calcular);
    };
  }, []);
  return cols;
}

export default function Masonry({ children, className = "" }) {
  const cols = useColumnas();
  const columnas = Array.from({ length: cols }, () => []);
  Children.toArray(children).forEach((hijo, i) => columnas[i % cols].push(hijo));
  return (
    <div className={"flex gap-4 items-start " + className}>
      {columnas.map((col, i) => (
        <div key={i} className="flex-1 min-w-0 flex flex-col gap-4">
          {col}
        </div>
      ))}
    </div>
  );
}
