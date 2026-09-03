// Funciones utilitarias puras, usadas por varios componentes.

import { DOCUMENTOS_CHECKLIST, CHECKLIST_POLICIA_ADICIONAL, HOY, NOMBRES_MES, TIPOS_SIN_APERTURA, HORARIOS_APERTURA } from "./constants";

export function diasRestantes(fecha) {
  const v = new Date(fecha + "T00:00:00");
  return Math.round((v - HOY) / 86400000);
}

// Días transcurridos desde el último movimiento de sector registrado (o null si
// el expediente todavía no tiene ninguno). Usado por Servicios como "Días frenado".
export function diasFrenado(observaciones) {
  const movimientos = (observaciones || []).filter(o => o.tipo === "movimiento");
  if (movimientos.length === 0) return null;
  const ultimo = movimientos.reduce((a, b) => (new Date(a.fecha) > new Date(b.fecha) ? a : b));
  return Math.round((HOY - new Date(ultimo.fecha + "T00:00:00")) / 86400000);
}

export function alerta(dias) {
  if (dias < 0) return "vencido";
  if (dias < 30) return "rojo";
  if (dias < 90) return "amarillo";
  return "verde";
}

export function documentacionDeExpediente(exp) {
  if (exp.documentacion) return exp.documentacion;
  const base = exp.esPoliciaAdicional ? CHECKLIST_POLICIA_ADICIONAL : DOCUMENTOS_CHECKLIST;
  return base.map(item => ({ item, cargado: false }));
}



export function fmtMoneda(v, m = "ARS") {
  if (!v) return "-";
  return (m === "USD" ? "US$ " : "$ ") + Number(v).toLocaleString("es-AR");
}
export function fmtFecha(f) {
  if (!f) return "-";
  return new Date(f + "T00:00:00").toLocaleDateString("es-AR");
}


export function requiereApertura(tipo) {
  return !TIPOS_SIN_APERTURA.includes(tipo);
}

export function calcularDiasServicio(fechaInicioStr, fechaFinStr, periodicidad, feriadosSet) {
  if (!fechaInicioStr || !fechaFinStr) return { dias: 0, detalle: [] };
  const inicio = new Date(fechaInicioStr + "T00:00:00");
  const fin = new Date(fechaFinStr + "T00:00:00");
  if (fin < inicio) return { dias: 0, detalle: [] };

  let dias = 0;
  let indice = 0;
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1), indice++) {
    const diaSemana = d.getDay(); // 0=domingo, 6=sábado
    const esFinde = diaSemana === 0 || diaSemana === 6;
    const iso = d.toISOString().slice(0, 10);
    const esFeriado = feriadosSet.has(iso);

    let corresponde = false;
    if (periodicidad === "todos") corresponde = true;
    else if (periodicidad === "lv_habiles") corresponde = !esFinde && !esFeriado;
    else if (periodicidad === "lv") corresponde = !esFinde;
    else if (periodicidad === "finde_feriados") corresponde = esFinde || esFeriado;
    else if (periodicidad === "dia_por_medio") corresponde = indice % 2 === 0;

    if (corresponde) dias++;
  }
  return { dias };
}

export function diasServicioPorMes(fechaInicioStr, fechaFinStr, periodicidad, feriadosSet) {
  if (!fechaInicioStr || !fechaFinStr) return [];
  const inicio = new Date(fechaInicioStr + "T00:00:00");
  const fin = new Date(fechaFinStr + "T00:00:00");
  if (fin < inicio) return [];

  const porMes = {};
  let indice = 0;
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1), indice++) {
    const diaSemana = d.getDay();
    const esFinde = diaSemana === 0 || diaSemana === 6;
    const iso = d.toISOString().slice(0, 10);
    const esFeriado = feriadosSet.has(iso);

    let corresponde = false;
    if (periodicidad === "todos") corresponde = true;
    else if (periodicidad === "lv_habiles") corresponde = !esFinde && !esFeriado;
    else if (periodicidad === "lv") corresponde = !esFinde;
    else if (periodicidad === "finde_feriados") corresponde = esFinde || esFeriado;
    else if (periodicidad === "dia_por_medio") corresponde = indice % 2 === 0;

    if (corresponde) {
      const claveMes = iso.slice(0, 7); // "YYYY-MM"
      porMes[claveMes] = (porMes[claveMes] || 0) + 1;
    }
  }

  return Object.entries(porMes)
    .map(([mes, dias]) => ({
      mes,
      etiqueta: NOMBRES_MES[Number(mes.slice(5, 7)) - 1] + " " + mes.slice(0, 4),
      dias,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Igual que calcularDiasServicio, pero devuelve el detalle día a día agrupado por mes (YYYY-MM). */

export function esFinDeSemana(fechaISO) {
  const dia = new Date(fechaISO + "T00:00:00").getDay();
  return dia === 0 || dia === 6;
}

export function esDiaHabilLibro(fechaISO, feriadosSet) {
  return !esFinDeSemana(fechaISO) && !feriadosSet.has(fechaISO);
}

export function sumarDiasISO(fechaISO, dias) {
  const d = new Date(fechaISO + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function horariosOcupadosEnFecha(fechaISO, contrataciones, excluirId) {
  return new Set(
    contrataciones
      .filter(c => c.fechaApertura === fechaISO && c.id !== excluirId)
      .map(c => c.hora)
  );
}

export function proximaAperturaLibreLibro(desdeISO, contrataciones, feriadosSet) {
  let cursor = desdeISO;
  for (let i = 0; i < 730; i++) {
    if (esDiaHabilLibro(cursor, feriadosSet)) {
      const ocupadas = horariosOcupadosEnFecha(cursor, contrataciones);
      const libre = HORARIOS_APERTURA.find(h => !ocupadas.has(h));
      if (libre !== undefined) return { fecha: cursor, hora: libre };
    }
    cursor = sumarDiasISO(cursor, 1);
  }
  return null;
}

export function proximosSlotsLibro(cantidad, desdeISO, contrataciones, feriadosSet) {
  const resultado = [];
  let cursor = desdeISO;
  for (let i = 0; i < 730 && resultado.length < cantidad; i++) {
    if (esDiaHabilLibro(cursor, feriadosSet)) {
      const ocupadas = horariosOcupadosEnFecha(cursor, contrataciones);
      HORARIOS_APERTURA.filter(h => !ocupadas.has(h)).forEach(h => {
        if (resultado.length < cantidad) resultado.push({ fecha: cursor, hora: h });
      });
    }
    cursor = sumarDiasISO(cursor, 1);
  }
  return resultado;
}


export function numeroALetras(num) {
  if (num == null || isNaN(num)) return "";
  const enteros = Math.floor(num);
  const centavos = Math.round((num % 1) * 100);
  return "Pesos " + enteros.toLocaleString("es-AR") + " con " + centavos.toString().padStart(2, "0") + "/100";
}


export function descargarArchivoBase64(base64Data, nombreArchivo, mimeType) {
  const binario = atob(base64Data);
  const array = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) array[i] = binario.charCodeAt(i);
  const blob = new Blob([array], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function escaparHtml(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

