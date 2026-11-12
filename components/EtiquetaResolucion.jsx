import { ESTILO_RESOLUCION_CONV } from "@/lib/resolucionConv";

// Etiqueta de color con la resolución de la convocatoria (Adjudicada,
// Desierta, Fracasada...).
export default function EtiquetaResolucion({ valor }) {
  if (!valor) return null;
  return (
    <span className={"block mt-1 w-fit text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap " + (ESTILO_RESOLUCION_CONV[valor] || ESTILO_RESOLUCION_CONV["Sin efecto"])}>
      {valor}
    </span>
  );
}
