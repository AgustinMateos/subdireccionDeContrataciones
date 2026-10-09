"use client";

import { useState } from "react";
import { Star } from "lucide-react";

// Botón de estrella para marcar/quitar prioridad: al tocarlo la estrella
// da un giro (clase .girar-estrella de globals.css).
export default function EstrellaPrioridad({ prioritario, onClick, size = 14 }) {
  const [girando, setGirando] = useState(false);
  return (
    <button
      type="button"
      onClick={ev => { ev.stopPropagation(); setGirando(true); onClick(); }}
      title={prioritario ? "Quitar prioridad" : "Marcar como prioritario"}
      className={"p-0.5 rounded hover:bg-amber-50 " + (prioritario ? "text-amber-500" : "text-slate-300 hover:text-amber-500")}
    >
      <Star
        size={size}
        fill={prioritario ? "currentColor" : "none"}
        className={girando ? "girar-estrella" : ""}
        onAnimationEnd={() => setGirando(false)}
      />
    </button>
  );
}
