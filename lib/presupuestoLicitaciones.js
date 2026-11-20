// Presupuesto 2026 de Construcciones y remodelaciones (partida 4.2: todos
// los expedientes de esa partida) y de Mobiliario, maquinaria y equipamiento (equipo de
// oficina y muebles, herramientas, electrodomésticos, aires acondicionados,
// grupos electrógenos...; no incluye equipamiento informático), y qué
// expedientes de Licitaciones encuadran en cada título (por objeto y rubro:
// ver lib/presupuestos.js).
import { armarPresupuesto, renglon as r } from "./presupuestos.js";

export const PRESUPUESTO_LICITACIONES = armarPresupuesto({
  anio: 2026,
  fuente: "Construcciones y remodelaciones; Mobiliario, maquinaria y equipamiento",
  tipos: [
    {
      id: "construcciones",
      titulo: "Construcciones y remodelaciones",
      subtitulo: "Bienes de uso · 4.2 Construcciones",
      partidas: ["4.2"],
      total: 8587398310,
      secciones: [
        {
          titulo: "Construcciones y remodelaciones",
          renglones: [
            r("Construcciones y remodelaciones", 8587398310, null, null, ["4.2"]),
          ],
        },
      ],
    },
    {
      id: "mobiliario",
      titulo: "Mobiliario, maquinaria y equipamiento",
      subtitulo: "Bienes de uso · 4.3 Maquinaria y equipo (no incluye equipamiento informático)",
      partidas: ["4.3"],
      total: 1322053487,
      secciones: [
        {
          titulo: "Mobiliario",
          renglones: [
            r("Dependencias Total País", 332825634,
              /MOBILIARIO|MUEBLE|ESCRITORIO|SILLA|SILLON|MESAS?\b(?! DE ENTRADA)|BIBLIOTECA|CASILLERO|LOCKER|PERCHERO|ESTANTERIA|ARMARIO|FICHERO|CAJONERA|PLACARD|BUTACA|GUARDARROPA/,
              /ELECTRODOMESTIC/),
          ],
        },
        {
          titulo: "Adquisición de maquinaria y equipamiento",
          renglones: [
            r("Equipos de Aire Acondicionado / Termomecánica", 494613277, /\bAA\b|\bA\.A\.|AIRES? ACONDICIONADO|ACONDICIONADORES|TERMOMECANIC|\bSPLIT|CALEFAC|CALDERA|ENFRIADORA|CHILLER|ROOF ?TOP|FAN ?COIL/),
            r("Provisión de Sistema Detección Incendio", 143563749, /INCENDIO/, /MATAFUEGO|EXTINTOR/),
            r("Provisión de Herramientas", 102519000, /HERRAMIENTA/),
            r("Matafuegos / Iluminación Emergencia", 97113221, /MATAFUEGO|EXTINTOR|(ILUMINACION|LUCES|LUZ|LUMINARIAS?) DE EMERGENCIA/),
            r("Contenedores", 54358554, /CONTENEDOR/),
            r("Desfibriladores / Electrodomésticos", 50687849, /DESFIBRILAD|CARDIODESFIB|\bDEA\b|ELECTRODOMESTIC|HELADERA|MICROONDAS|\bPAVAS?\b|CAFETERA|DISPENSER|ANAFE|FRIGOBAR|TERMOTANQUE|LAVARROPA|FREEZER|VENTILADOR|ESTUFA|CALOVENTOR/),
            r("Otros (bombas, escaleras y carros, etc.)", 33282563, /\bBOMBAS?\b|ESCALERA|\bCARROS?\b|CARRITO|\bZORRAS?\b|GRUPOS? ELECTROGENO/),
            r("Prev. anual de otros bienes - Nuevas dependencias del Consejo de la Magistratura", 13089638, null),
          ],
        },
      ],
    },
  ],
});
