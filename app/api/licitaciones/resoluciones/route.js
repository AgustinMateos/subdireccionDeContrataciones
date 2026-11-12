import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sesionLicitaciones } from "@/lib/licitacionesServidor";
import { resultadosDeTexto, RESULTADOS_LICITACION } from "@/lib/licitaciones";

// Para el Excel de Licitaciones: por cada expediente, para qué está o
// estuvo en Resoluciones (tipo de resolución de cada paso por el sector,
// con la contratación y el ingreso). Se busca por N° de expediente
// (cualquier N° NN-NNNNN/AAAA en común).
// → { resoluciones: { [idLicitacion]: "texto" }, contrataciones: { [idLicitacion]: "L.PRIVADA 362/26, ..." } }
// (en Fracasa / Autoriza, también la contratación que se autoriza),
// `actas`: { [idLicitacion]: ["333/2026", ...] } para el link a las actas de
// apertura (cada N°/año que se entiende; el año, con 4 dígitos).
// `resultados`: { [idLicitacion]: { tipos: ["Fracasada", "Desierta", ...], detalle } }
// para los expedientes con fracasos, desiertas, revocaciones o adjudicaciones
// parciales, según el tipo de resolución y las observaciones de Resoluciones
// (también de los escritos) y las observaciones del propio expediente.
const numeros = t => String(t || "").match(/\d{2}-\d{4,6}\/\d{4}/g) || [];
const dia = f => (f ? new Date(f).toISOString().slice(0, 10).split("-").reverse().join("/") : "");

export async function GET() {
  if (!(await sesionLicitaciones())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [licitaciones, resoluciones] = await Promise.all([
    prisma.expedienteLicitacion.findMany({
      select: { id: true, exp: true, observaciones: true, movimientos: { where: { campo: "Observaciones" }, select: { valor: true } } },
    }),
    prisma.expedienteResolucion.findMany({
      select: {
        exp: true, esEscrito: true, escritoMotivo: true, observaciones: true, tipoResolucion: true, situacion: true, tipoContratacion: true, numero: true, fechaIngreso: true,
        autorizaTipo: true, autorizaNumero: true,
        movimientos: { where: { campo: "Tipo de resolución" }, select: { sectorAnterior: true }, orderBy: { fecha: "asc" } },
      },
      orderBy: { fechaIngreso: "asc" },
    }),
  ]);

  const porNumero = new Map();
  for (const r of resoluciones) for (const n of new Set(numeros(r.exp))) {
    if (!porNumero.has(n)) porNumero.set(n, []);
    porNumero.get(n).push(r);
  }

  const texto = r => {
    const tipo = String(r.tipoResolucion || "").trim();
    const verbo = r.situacion === "FINALIZADO" ? "Estuvo" : "Está";
    const antes = [...new Set(r.movimientos.map(m => String(m.sectorAnterior || "").trim()).filter(t => t && t !== "-" && t !== tipo))];
    const detalle = [[r.tipoContratacion, r.numero].filter(Boolean).join(" "), r.fechaIngreso && "ingresó " + dia(r.fechaIngreso)].filter(Boolean).join(", ");
    return (tipo ? verbo + " para " + tipo : verbo + " en Resoluciones (sin tipo)") +
      (antes.length ? " (antes para " + antes.join(", ") + ")" : "") + (detalle ? " [" + detalle + "]" : "");
  };

  const contratacion = (tipo, numero) => (numero ? [tipo, numero].filter(Boolean).join(" ").trim() : "");
  const numerosConAnio = t => [...String(t || "").matchAll(/(\d{1,5})\s*\/\s*(\d{4}|\d{2})(?!\d)/g)]
    .map(([, n, a]) => [Number(n), a.length === 2 ? "20" + a : a])
    .filter(([n, a]) => n > 0 && a >= "2000" && a <= "2099")
    .map(([n, a]) => n + "/" + a);
  const corto = t => { const x = String(t || "").replace(/\s+/g, " ").trim(); return x.length > 160 ? x.slice(0, 157) + "..." : x; };
  const resultado = {}, contrataciones = {}, actas = {}, resultados = {};
  for (const l of licitaciones) {
    const todas = [...new Set(numeros(l.exp).flatMap(n => porNumero.get(n) || []))];

    const tipos = new Set(), detalle = [];
    for (const r of todas) {
      const t = resultadosDeTexto([r.tipoResolucion, r.observaciones, r.escritoMotivo].filter(Boolean).join(" // "));
      if (!t.size) continue;
      t.forEach(x => tipos.add(x));
      detalle.push("Resoluciones" + (r.esEscrito ? " (escrito)" : "") + ": " +
        [r.tipoResolucion, [r.tipoContratacion, r.numero].filter(Boolean).join(" "), corto(r.observaciones || r.escritoMotivo)].filter(Boolean).join(" · "));
    }
    for (const obs of new Set([l.observaciones, ...l.movimientos.map(m => m.valor)].filter(Boolean))) {
      const t = resultadosDeTexto(obs);
      if (!t.size) continue;
      t.forEach(x => tipos.add(x));
      detalle.push("Licitaciones: " + corto(obs));
    }
    if (tipos.size) resultados[l.id] = { tipos: RESULTADOS_LICITACION.filter(x => tipos.has(x)), detalle: detalle.join(" | ") };

    const encontradas = todas.filter(r => !r.esEscrito);
    if (!encontradas.length) continue;
    resultado[l.id] = encontradas.map(texto).join(" | ");
    const nums = [...new Set(encontradas.flatMap(r => [contratacion(r.tipoContratacion, r.numero), contratacion(r.autorizaTipo, r.autorizaNumero)]).filter(Boolean))];
    if (nums.length) contrataciones[l.id] = nums.join(", ");
    const conAnio = [...new Set(encontradas.flatMap(r => [...numerosConAnio(r.numero), ...numerosConAnio(r.autorizaNumero)]))];
    if (conAnio.length) actas[l.id] = conAnio;
  }
  return NextResponse.json({ resoluciones: resultado, contrataciones, actas, resultados });
}
