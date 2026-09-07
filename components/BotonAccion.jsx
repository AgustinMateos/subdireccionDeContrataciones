"use client";

import { Loader2 } from "lucide-react";

// Botón de acción que se deshabilita y muestra un spinner mientras `cargando`
// está en true — para que quede claro que la acción está en curso (evita
// además que se pueda hacer doble clic mientras se espera la respuesta).
export default function BotonAccion({ cargando, cargandoTexto = "Guardando...", children, className, disabled, ...props }) {
  return (
    <button {...props} disabled={cargando || disabled} className={className}>
      {cargando ? (
        <span className="flex items-center justify-center gap-1.5">
          <Loader2 size={14} className="animate-spin" /> {cargandoTexto}
        </span>
      ) : children}
    </button>
  );
}
