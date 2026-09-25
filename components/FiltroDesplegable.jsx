"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";

// Desplegable propio para los filtros (reemplaza al <select> nativo).
// `opciones`: [{ valor, etiqueta }]. `clase` permite teñir el botón según el
// valor elegido (ej. el filtro de vencimiento). `anchoCompleto` estira el
// botón al ancho del contenedor (ej. una columna de tabla). `flotante`
// dibuja la lista en un portal con posición fija, para que no la recorte un
// contenedor con overflow (como el scroll horizontal de una tabla); se
// cierra al hacer scroll o cambiar el tamaño de la ventana. `grande` usa el
// tamaño de los campos de formulario (ej. dentro de un modal).
export default function FiltroDesplegable({ valor, onChange, opciones, clase = "bg-white border-slate-300 text-slate-700", anchoCompleto = false, flotante = false, grande = false }) {
  const [abierto, setAbierto] = useState(false);
  const [posicion, setPosicion] = useState(null);
  const ref = useRef(null);
  const botonRef = useRef(null);
  const listaRef = useRef(null);
  const actual = opciones.find(o => o.valor === valor) || opciones[0];

  useEffect(() => {
    if (!abierto) return;
    function fuera(e) {
      if (ref.current?.contains(e.target) || listaRef.current?.contains(e.target)) return;
      setAbierto(false);
    }
    function tecla(e) { if (e.key === "Escape") setAbierto(false); }
    function cerrar(e) { if (!listaRef.current?.contains(e.target)) setAbierto(false); }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    if (flotante) {
      window.addEventListener("scroll", cerrar, true);
      window.addEventListener("resize", cerrar);
    }
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
      window.removeEventListener("scroll", cerrar, true);
      window.removeEventListener("resize", cerrar);
    };
  }, [abierto, flotante]);

  function alternar() {
    if (!abierto && flotante && botonRef.current) {
      const r = botonRef.current.getBoundingClientRect();
      setPosicion({ top: r.bottom + 4, left: r.left, minWidth: r.width });
    }
    setAbierto(a => !a);
  }

  const lista = (
    <ul
      ref={listaRef}
      style={flotante && posicion ? { position: "fixed", top: posicion.top, left: posicion.left, minWidth: posicion.minWidth } : undefined}
      className={(flotante ? "z-50 " : "absolute z-30 mt-1 min-w-full ") + "w-max max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg py-1"}
    >
      {opciones.map(o => (
        <li key={o.valor}>
          <button
            type="button"
            onClick={() => { onChange(o.valor); setAbierto(false); }}
            className={"w-full flex items-center justify-between gap-3 text-left px-3 hover:bg-slate-50 " + (grande ? "text-sm py-2 " : "text-xs py-1.5 ") +
              (o.valor === valor ? "font-semibold text-slate-900" : "text-slate-600")}
          >
            {o.etiqueta}
            {o.valor === valor && <Check size={12} className="text-slate-700" />}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={ref} className="relative">
      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        className={"flex items-center gap-2 border rounded-md hover:border-slate-500 transition-colors " + (grande ? "text-sm px-3 py-2 " : "text-xs px-2.5 py-1.5 ") +
          (anchoCompleto ? "w-full justify-between font-normal " : "") + clase}
      >
        <span className={anchoCompleto ? "truncate" : ""}>{actual.etiqueta}</span>
        <ChevronDown size={13} className={"shrink-0 text-slate-400 transition-transform " + (abierto ? "rotate-180" : "")} />
      </button>
      {abierto && (flotante ? (posicion && createPortal(lista, document.body)) : lista)}
    </div>
  );
}
