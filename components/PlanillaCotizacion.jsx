"use client";

import { useState, useRef } from "react";
import { FileText, Download } from "lucide-react";
import { numeroALetras, escaparHtml } from "@/lib/utils";
function crearSubItemPlanilla(subId, letra) {
  return { subId, letra, descripcion: "", cantidad: "1", unidad: "", precioUnitario: "", precioUnitarioLetras: "", total: 0, totalLetras: "" };
}

function crearRenglonPlanilla(id, esSimple = true) {
  return {
    id, esSimple, descripcion: "", cantidad: esSimple ? "1" : "", unidad: "",
    precioUnitario: "", precioUnitarioLetras: "", total: 0, totalLetras: "",
    items: esSimple ? [] : [crearSubItemPlanilla(1, "a")], subtotal: 0,
  };
}


// Formulario de Faltas y Licencias (.doc original) codificado en base64,
// partido en líneas cortas para evitar problemas de renderizado con líneas muy largas.

export default function PlanillaCotizacion({ mostrarToast }) {
  const contenedorRef = useRef(null);
  const [renglones, setRenglones] = useState([crearRenglonPlanilla(1, true)]);
  const [organismoSolicitante, setOrganismoSolicitante] = useState("Dirección General de Infraestructura Judicial");
  const [expediente, setExpediente] = useState("13-06148/26");
  const [numeroContratacion, setNumeroContratacion] = useState("540/26");
  const [tipoProcedimiento, setTipoProcedimiento] = useState("contratacionDirectaExclusividad");
  const [fechaApertura, setFechaApertura] = useState("2026-09-14");
  const [horaApertura, setHoraApertura] = useState("9");
  const [mostrarCantidad, setMostrarCantidad] = useState(false);
  const [mostrarDescripcionGeneral, setMostrarDescripcionGeneral] = useState(false);
  const [descripcionGeneral, setDescripcionGeneral] = useState("");
  const [etiquetaUnitario, setEtiquetaUnitario] = useState("C. Unitario $ (Número y letras)");
  const [etiquetaTotal, setEtiquetaTotal] = useState("C. Total $ (Número y letras)");

  // Si el expediente / N° de contratación / fecha de apertura todavía no están
  // definidos, se puede marcar como "opcional" para que la planilla imprima el
  // espacio en blanco (puntitos) en vez de forzar a cargar un valor.
  const [expedienteOpcional, setExpedienteOpcional] = useState(false);
  const [numeroContratacionOpcional, setNumeroContratacionOpcional] = useState(false);
  const [fechaAperturaOpcional, setFechaAperturaOpcional] = useState(false);

  const hayConSubItems = renglones.some(r => !r.esSimple);

  // Devuelve el valor cargado, o una línea de puntos si el campo está marcado
  // como opcional (o directamente vacío) — para que el espacio quede en blanco
  // tanto en la vista previa como en el Word exportado.
  function campoOBlanco(valor, esOpcional, ancho = 24) {
    if (esOpcional || !valor || !valor.trim()) return ".".repeat(ancho);
    return valor;
  }

  function getTextoProcedimiento() {
    if (tipoProcedimiento === "tramiteSimplificado") {
      return "ARTÍCULOS N° 36 Y 168 (TRÁMITE SIMPLIFICADO) DEL REGLAMENTO DE CONTRATACIONES DEL CONSEJO DE LA MAGISTRATURA DEL P.J.N. APROBADO POR RESOLUCIÓN N° 254/15 y SUS MODIFICATORIAS Y LA RESOLUCIÓN N° 77/18 Y MODIFICATORIAS DE LA ADMINISTRACIÓN GENERAL";
    }
    if (tipoProcedimiento === "licitacionPrivada") {
      return "ARTS. N° 25 Y 26, ap. 1 a) y 2 a) (LICITACIÓN PRIVADA) DEL REGLAMENTO DE CONTRATACIONES DEL CONSEJO DE LA MAGISTRATURA DEL P.J.N. APROBADO POR RESOLUCIÓN Nº 254/15 Y SUS MODIFICATORIAS Y RESOLUCIÓN N° 77/18 Y MODIFICATORIAS DE LA ADMINISTRACIÓN GENERAL.";
    }
    if (tipoProcedimiento === "contratacionDirectaExclusividad") {
      return "ART. 31 Y 163 (CONTRATACIÓN DIRECTA POR EXCLUSIVIDAD) DEL REGLAMENTO DE CONTRATACIONES DEL CONSEJO DE LA MAGISTRATURA DEL P.J.N. APROBADO POR RESOL. Nº 254/15 Y SUS MODIFICATORIAS Y LA RESOLUCIÓN A.G. 77/18 Y MODIFICATORIAS.";
    }
    return "ARTS. N° 27 Y 28 DEL REGLAMENTO DE CONTRATACIONES DEL CONSEJO DE LA MAGISTRATURA DEL P.J.N. APROBADO POR RESOLUCIÓN Nº 254/15 Y SUS MODIFICATORIAS Y RESOLUCIÓN N° 77/18 Y MODIFICATORIAS DE LA ADMINISTRACIÓN GENERAL.";
  }

  function getTituloContratacion() {
    if (tipoProcedimiento === "tramiteSimplificado") return "CONTRATACIÓN DIRECTA – TRÁMITE SIMPLIFICADO N°:";
    if (tipoProcedimiento === "licitacionPrivada") return "LICITACIÓN PRIVADA N°:";
    if (tipoProcedimiento === "contratacionDirectaExclusividad") return "CONTRATACIÓN DIRECTA (EXCLUSIVIDAD) N°:";
    return "CONTRATACIÓN DIRECTA N°:";
  }

  function fechaAperturaLarga() {
    if (fechaAperturaOpcional || !fechaApertura) return "..........................";
    const d = new Date(fechaApertura + "T00:00:00");
    return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" }).toUpperCase();
  }

  function horaAperturaTexto() {
    if (fechaAperturaOpcional || !horaApertura) return "........";
    return horaApertura + ":00 HORAS";
  }

  function agregarRenglon(esSimple = true) {
    const nuevoId = Math.max(...renglones.map(r => r.id), 0) + 1;
    setRenglones(prev => [...prev, crearRenglonPlanilla(nuevoId, esSimple)]);
  }

  function eliminarRenglon(id) {
    if (renglones.length <= 1) return;
    setRenglones(prev => prev.filter(r => r.id !== id));
  }

  function agregarSubItem(renglonId) {
    setRenglones(prev => prev.map(r => {
      if (r.id !== renglonId || r.esSimple) return r;
      const ultimo = r.items[r.items.length - 1];
      const nuevaLetra = String.fromCharCode(ultimo.letra.charCodeAt(0) + 1);
      return { ...r, items: [...r.items, crearSubItemPlanilla(r.items.length + 1, nuevaLetra)] };
    }));
  }

  function eliminarSubItem(renglonId, subId) {
    setRenglones(prev => {
      let debeEliminarRenglon = false;
      const nuevosRenglones = prev.map(r => {
        if (r.id !== renglonId || r.esSimple) return r;
        const nuevosItems = r.items.filter(it => it.subId !== subId);
        if (nuevosItems.length <= 1) { debeEliminarRenglon = true; return null; }
        const itemsRenumerados = nuevosItems.map((it, idx) => ({ ...it, letra: String.fromCharCode(97 + idx) }));
        const subtotal = itemsRenumerados.reduce((sum, it) => sum + Number(it.total || 0), 0);
        return { ...r, items: itemsRenumerados, subtotal, total: subtotal, totalLetras: numeroALetras(subtotal) };
      }).filter(Boolean);

      if (debeEliminarRenglon) return nuevosRenglones.filter(r => r?.id !== renglonId);
      return nuevosRenglones.length > 0 ? nuevosRenglones : [crearRenglonPlanilla(1, true)];
    });
  }

  function actualizarRenglon(id, campo, valor) {
    setRenglones(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [campo]: valor };
      if (campo === "precioUnitario" || campo === "cantidad") {
        const cant = Number(updated.cantidad || 1);
        const pu = Number(updated.precioUnitario || 0);
        updated.total = cant * pu;
        updated.totalLetras = numeroALetras(updated.total);
        updated.precioUnitarioLetras = numeroALetras(pu);
      }
      return updated;
    }));
  }

  function actualizarSubItem(renglonId, subId, campo, valor) {
    setRenglones(prev => prev.map(r => {
      if (r.id !== renglonId || r.esSimple) return r;
      const nuevosItems = r.items.map(item => {
        if (item.subId !== subId) return item;
        const updated = { ...item, [campo]: valor };
        if (campo === "cantidad" || campo === "precioUnitario") {
          const cant = Number(updated.cantidad || 1);
          const pu = Number(updated.precioUnitario || 0);
          updated.total = cant * pu;
          updated.totalLetras = numeroALetras(updated.total);
          updated.precioUnitarioLetras = numeroALetras(pu);
        }
        return updated;
      });
      const subtotal = nuevosItems.reduce((acc, it) => acc + Number(it.total || 0), 0);
      return { ...r, items: nuevosItems, subtotal, total: subtotal, totalLetras: numeroALetras(subtotal) };
    }));
  }

  function exportarAPlanillaWord() {
    const nombreArchivo = "Planilla_Cotizacion_" + numeroContratacion.replace("/", "-") + ".doc";

    const css =
      "<style>" +
      "@page Section1 { size: 841.95pt 595.35pt; mso-page-orientation: landscape; margin: 1.5cm; }" +
      "div.Section1 { page: Section1; }" +
      "table { border-collapse: collapse; width: 100%; }" +
      "td, th { border: 1.5pt double black; padding: 8px 10px; vertical-align: top; font-family: Calibri, sans-serif; font-size: 10pt; }" +
      "th { font-weight: bold; text-align: center; }" +
      "body { font-family: Calibri, sans-serif; font-size: 10pt; line-height: 1.4; }" +
      "p, span, div { font-family: Calibri, sans-serif; font-size: 10pt; }" +
      ".centro { text-align: center; } .negrita { font-weight: bold; } .subrayado { text-decoration: underline; }" +
      ".justificado { text-align: justify; } .sin-borde { border: none; }" +
      ".salto-pagina { page-break-before: always; mso-page-break-before: always; }" +
      "</style>";

    // Filas de la tabla de renglones (texto fijo, sin botones ni textareas).
    let filasHtml = "";
    renglones.forEach((r, indexGlobal) => {
      const indiceVisible = indexGlobal + 1;
      const celdaCantidad = mostrarCantidad ? "<td style='text-align:center;'>" + escaparHtml(r.cantidad) + "</td>" : "";
      if (r.esSimple) {
        filasHtml +=
          "<tr><td style='text-align:center;'>" + indiceVisible + "</td>" +
          (hayConSubItems ? "<td style='text-align:center;'></td>" : "") +
          "<td>" + escaparHtml(r.descripcion) + "</td>" +
          celdaCantidad +
          "<td>$ Pesos ..........................................................</td>" +
          "<td>$ Pesos ..........................................................</td></tr>";
      } else {
        r.items.forEach((item, idxItem) => {
          const celdaCantidadItem = mostrarCantidad ? "<td style='text-align:center;'>" + escaparHtml(item.cantidad) + "</td>" : "";
          filasHtml +=
            "<tr>" +
            (idxItem === 0 ? "<td style='text-align:center;' rowspan='" + r.items.length + "'>" + indiceVisible + "</td>" : "") +
            "<td style='text-align:center;'>" + indiceVisible + "." + item.letra + "</td>" +
            "<td>" + escaparHtml(item.descripcion) + "</td>" +
            celdaCantidadItem +
            "<td>$ Pesos ..........................................................</td>" +
            "<td>$ Pesos ..........................................................</td></tr>";
        });
      }
    });

    const fechaTexto = fechaAperturaLarga();

    const pagina1 =
      "<div style='text-align:center;font-size:20pt;font-weight:bold;margin-bottom:18pt;'>Anexo I</div>" +
      "<table style='border:none;'><tr>" +
      "<td style='border:none;width:60%;'>" +
      "<p style='font-weight:bold;text-align:center;margin:0;'>CONSEJO DE LA MAGISTRATURA<br/>ADMINISTRACIÓN GENERAL<br/>SUBDIRECCIÓN DE CONTRATACIONES</p><br/>" +
      "<p style='text-align:justify;'>La presente cotización se encuentra amparada en lo establecido por el Reglamento de " +
      "Contrataciones del Consejo de la Magistratura aprobado por Resolución CM N° 254/15 y sus modificatorias y " +
      "la Resolución A.G. N° 77/18 y sus modificatorias.</p>" +
      "</td>" +
      "<td style='border:none;width:40%;text-align:right;'>" +
      "Sres. ..............................................................<br/><br/>" +
      "Calle: .............................................................<br/><br/><br/>" +
      "----------------------------------------------<br/>" +
      "<span style='font-weight:bold;'>Firma funcionario autorizado</span>" +
      "</td></tr></table><br/>" +
      (mostrarDescripcionGeneral
        ? "<table><tr><th>Descripción</th></tr><tr><td style='text-align:justify;'>" + escaparHtml(descripcionGeneral) + "</td></tr></table><br/>"
        : "") +
      "<table><thead><tr><th style='width:6%;'>Reng</th>" +
      (hayConSubItems ? "<th style='width:6%;'>Item</th>" : "") +
      "<th>Descripción</th>" +
      (mostrarCantidad ? "<th style='width:10%;'>Cant.</th>" : "") +
      "<th style='width:20%;'>" + escaparHtml(etiquetaUnitario) + "</th><th style='width:20%;'>" + escaparHtml(etiquetaTotal) + "</th>" +
      "</tr></thead><tbody>" + filasHtml + "</tbody></table>";

    const pagina2 =
      "<table>" +
      "<tr><td style='width:16%;font-weight:bold;text-align:center;'>Costo Total<br/>(N° y letras)</td>" +
      "<td>Son Pesos ..............................................................................................................<br/><br/>" +
      "....................................................................................................................................</td></tr>" +
      "<tr><td style='font-weight:bold;text-align:center;'>Costo Global<br/>(N° y letras)</td>" +
      "<td>Son Pesos ..............................................................................................................<br/><br/>" +
      "....................................................................................................................................</td></tr>" +
      "<tr><td colspan='2'>" +
      "<p><span style='font-weight:bold;'>ORGANISMO SOLICITANTE: </span>" + escaparHtml(organismoSolicitante) + ".</p>" +
      "<p><span style='font-weight:bold;'>NOTA:</span> AL MOMENTO DE PROCEDER A EMITIR LA PERTINENTE ORDEN DE COMPRA -EN CASO DE SER NECESARIO-, SE ADAPTARÁ LA FECHA DE INICIO.</p>" +
      "<p style='font-weight:bold;'>EL PLIEGO DE BASES Y CONDICIONES FORMA PARTE DE LA PLANILLA DE COTIZACIÓN.</p>" +
      "</td></tr></table>";

    const pagina3 =
      "<table><tr>" +
      "<td style='width:38%;'>" +
      "<p style='font-weight:bold;font-size:13pt;'>Expediente N° " + escaparHtml(campoOBlanco(expediente, expedienteOpcional)) + "</p><br/>" +
      "<p style='text-align:justify;'><span style='font-weight:bold;'>PROCEDIMIENTO </span>" + escaparHtml(getTextoProcedimiento()) + "</p>" +
      "<p style='font-weight:bold;text-align:center;'>" + escaparHtml(getTituloContratacion()) + " " + escaparHtml(campoOBlanco(numeroContratacion, numeroContratacionOpcional)) + "</p>" +
      "<br/><p style='font-weight:bold;text-decoration:underline;text-align:center;'>OFERENTE</p>" +
      "<p style='font-weight:bold;text-decoration:underline;'>DOMICILIO:</p><p>....................................................................</p>" +
      "<p style='font-weight:bold;text-decoration:underline;'>TELÉFONO:</p><p>....................................................................</p>" +
      "<p style='font-weight:bold;text-decoration:underline;'>CUIT:</p><p>....................................................................</p>" +
      "<p style='font-weight:bold;text-decoration:underline;'>CORREO ELECTRÓNICO:</p><p>....................................................................</p>" +
      "</td>" +
      "<td style='width:62%;'>" +
      "<p style='text-align:justify;'><span style='font-weight:bold;text-decoration:underline;'>PRESENTACIÓN DE OFERTAS: </span>SUBDIRECCIÓN DE CONTRATACIONES, " +
      "SITA EN LA CALLE SARMIENTO N° 877, 1ER SUBSUELO, (SALA DE APERTURAS), C.A.B.A., HASTA EL DÍA " + fechaTexto + " A LAS " + horaAperturaTexto() + ".</p>" +
      "<p style='text-align:justify;'><span style='font-weight:bold;text-decoration:underline;'>LUGAR, FECHA Y HORA DE APERTURA</span> SUBDIRECCIÓN DE CONTRATACIONES, " +
      "SITA EN LA CALLE SARMIENTO N° 877, 1ER SUBSUELO, (SALA DE APERTURAS), C.A.B.A., EL DÍA " + fechaTexto + " A LAS " + horaAperturaTexto() + ".</p>" +
      "<p style='text-align:justify;'><span style='font-weight:bold;text-decoration:underline;'>CONSULTA Y DESCARGA DE PLIEGOS: </span>Sitio Web: Sistema de Registro de " +
      "Proveedores del Consejo de la Magistratura (SRPCM): https://srpcm.pjn.gov.ar.</p>" +
      "<p style='text-align:justify;font-weight:bold;'>Toda consulta respecto al Pliego de Bases y Condiciones deberá efectuarse conforme a lo indicado en el Anexo a las Cláusulas Particulares del respectivo Pliego.</p>" +
      "<p style='font-weight:bold;text-decoration:underline;'>INSCRIPCIÓN EN EL REGISTRO DE PROVEEDORES</p>" +
      "<p style='text-align:justify;'>Se recuerda que a fin de dar cumplimiento a lo dispuesto por la Resolución CM N° 362/2021, que establece la " +
      "obligatoriedad de la inscripción en el registro de proveedores del Consejo de la Magistratura del Poder Judicial de la Nación " +
      "(SRPCM), deberán ingresar al siguiente link https://srpcm.pjn.gov.ar/ o a los que en un futuro los reemplacen.</p>" +
      "<p style='text-align:justify;'>Asimismo, se recuerda lo dispuesto en el Art. N° 3° -PRE-INSCRIPCIÓN- in fine, del Anexo I – Instructivo, de la " +
      "citada Resolución: <span style='font-weight:bold;'>\"Cuando el proveedor se encuentre pre-inscripto podrá adquirir pliego y presentar ofertas. " +
      "No obstante, es requisito obligatorio haber finalizado el trámite de Inscripción para ser preadjudicado o adjudicado, como así también " +
      "mantener la información y documentación actualizada en dicho registro. En cuyo caso, no será necesario volver a anexar toda la " +
      "documentación que fue presentada para ser incorporados en el sistema, sino solo aquella que se pretenda actualizar.</span></p>" +
      "<p style='text-align:justify;font-weight:bold;'>Para el caso de que la inscripción no haya sido finalizada por motivos que no le puedan ser endilgados " +
      "al proveedor, no se lo podrá excluir de la posibilidad de ser preadjudicado o adjudicado\".</p>" +
      "</td></tr></table>";

    const htmlCompleto =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      "<head><meta charset=\"utf-8\"><title>Planilla de Cotización - " + numeroContratacion + "</title>" + css +
      "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom>" +
      "<w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->" +
      "</head><body>" +
      "<div class='Section1'>" + pagina1 + "</div>" +
      "<br clear='all' style='page-break-before:always;mso-page-break-before:always;' />" +
      "<div class='Section1'>" + pagina2 + "</div>" +
      "<br clear='all' style='page-break-before:always;mso-page-break-before:always;' />" +
      "<div class='Section1'>" + pagina3 + "</div>" +
      "</body></html>";

    const blob = new Blob(["\ufeff", htmlCompleto], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    mostrarToast("Planilla exportada a Word (.doc)");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileText size={18} className="text-slate-500" /> Planilla de Cotización (Anexo I)
          </h2>
          <p className="text-xs text-slate-500">Subdirección de Contrataciones · documento para adjuntar al pliego de bases y condiciones</p>
        </div>
        <button onClick={exportarAPlanillaWord} className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800">
          <Download size={14} /> Exportar a Word (.doc)
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Opciones de la planilla</h3>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={mostrarCantidad} onChange={e => setMostrarCantidad(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300" />
            Mostrar columna "Cant." (cantidad por renglón)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input type="checkbox" checked={mostrarDescripcionGeneral} onChange={e => setMostrarDescripcionGeneral(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-slate-300" />
            Agregar bloque de "Descripción" general (arriba de la tabla)
          </label>
        </div>

        {mostrarDescripcionGeneral && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Texto de la descripción general</label>
            <textarea value={descripcionGeneral} onChange={e => setDescripcionGeneral(e.target.value)} rows={2}
              placeholder="Ej: Contratar el servicio de mantenimiento del sistema de aviso y detección de incendio..."
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título de la columna "C. Unitario"</label>
            <input value={etiquetaUnitario} onChange={e => setEtiquetaUnitario(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Título de la columna "C. Total"</label>
            <input value={etiquetaTotal} onChange={e => setEtiquetaTotal(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-800" />
          </div>
        </div>
        <p className="text-[11px] text-slate-400">
          Ej: para plazos escalonados podés usar "Costo unitario mensual" y "Costo total por trimestre". La columna
          "Item" (1.a, 1.b...) aparece sola cuando agregás una partida con sub-ítems.
        </p>
      </div>

      <div ref={contenedorRef} style={{ fontFamily: "Calibri, 'Segoe UI', sans-serif", fontSize: "10pt" }} className="bg-white border border-slate-300 rounded-xl p-6 sm:p-8 text-slate-900">
        <div className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b border-slate-200">
          <div className="flex flex-col items-center text-center w-full sm:w-64">
            <div className="w-16 h-16 rounded-full border-2 border-slate-800 flex items-center justify-center mb-2 shrink-0">
              <span className="font-bold text-base text-slate-800">CM</span>
            </div>
            <p className="font-semibold leading-tight m-0">
              Consejo de la Magistratura<br />
              Administración General<br />
              Subdirección de Contrataciones
            </p>
            <p className="mt-3 text-xs text-slate-600 leading-relaxed">
              La presente contratación se encuentra amparada en lo establecido por el Reglamento de Contrataciones
              del Consejo de la Magistratura aprobado por Resolución N.º 254/15 y sus modificatorias y Resolución
              A.G. N.º 77/18 y sus modificatorias.
            </p>
          </div>
          <div className="flex items-center justify-center">
            <p className="text-3xl font-bold">Anexo I</p>
          </div>
          <div className="w-full sm:w-64 space-y-3 text-sm text-right">
            <p>Sres. ...........................................................</p>
            <p>Calle: ..........................................................</p>
            <p className="pt-6">
              ----------------------------------------------<br />
              <span className="font-bold">Firma funcionario autorizado</span>
            </p>
          </div>
        </div>

        {mostrarDescripcionGeneral && (
          <table className="w-full border-double border-4 border-black mt-6">
            <thead>
              <tr><th className="px-3 py-2 border-double border-4 border-black text-center">Descripción</th></tr>
            </thead>
            <tbody>
              <tr><td className="px-3 py-2 border-double border-4 border-black text-justify whitespace-pre-line">{descripcionGeneral}</td></tr>
            </tbody>
          </table>
        )}

        <table className="w-full border-double border-4 border-black mt-6">
          <thead>
            <tr className="font-bold">
              <th className="px-3 py-2 border-double border-4 border-black w-16 text-center">Reng</th>
              {hayConSubItems && <th className="px-3 py-2 border-double border-4 border-black w-16 text-center">Item</th>}
              <th className="px-3 py-2 border-double border-4 border-black text-center">Descripción</th>
              {mostrarCantidad && <th className="px-3 py-2 border-double border-4 border-black w-24 text-center">Cant.</th>}
              <th className="px-3 py-2 border-double border-4 border-black w-48 text-center">{etiquetaUnitario}</th>
              <th className="px-3 py-2 border-double border-4 border-black w-56 text-center">{etiquetaTotal}</th>
            </tr>
          </thead>
          <tbody>
            {renglones.map((renglon, indexGlobal) => (
              <RenglonPlanillaFilas
                key={renglon.id}
                renglon={renglon}
                indiceVisible={indexGlobal + 1}
                mostrarCantidad={mostrarCantidad}
                mostrarColumnaItem={hayConSubItems}
                onUpdateRenglon={actualizarRenglon}
                onUpdateSub={actualizarSubItem}
                onAddSub={agregarSubItem}
                onDeleteSub={eliminarSubItem}
                onDeleteRenglon={eliminarRenglon}
              />
            ))}
          </tbody>
        </table>

        <div className="pt-4 flex flex-wrap gap-3">
          <button onClick={() => agregarRenglon(true)} className="bg-slate-800 text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-slate-900">
            + Renglón simple
          </button>
          <button onClick={() => agregarRenglon(false)} className="bg-slate-500 text-white px-4 py-2 rounded-md text-xs font-medium hover:bg-slate-600">
            + Partida con sub-ítems
          </button>
        </div>

        <div className="mt-6 border-4 border-double border-black bg-slate-50">
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-b-2 border-black">
                <td className="w-1/3 p-4 font-bold border-r-2 border-black align-top">Costo Total (N° y letras)</td>
                <td className="py-4 px-4">
                  Son Pesos.................................................................................................
                  <div className="border-b border-dotted border-slate-500 h-6" />
                  <div className="border-b border-dotted border-slate-500 h-6" />
                </td>
              </tr>
              <tr className="border-b-2 border-black">
                <td className="w-1/3 py-4 px-4 font-bold border-r-2 border-black align-top">Costo Global (N° y letras)</td>
                <td className="py-4 px-4">
                  Son Pesos.................................................................................................
                  <div className="mt-3 border-b border-dotted border-slate-500 h-6" />
                  <div className="mt-3 border-b border-dotted border-slate-500 h-6" />
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="py-6 px-4 font-bold">
                  ORGANISMO SOLICITANTE:
                  <br />
                  <input
                    type="text"
                    value={organismoSolicitante}
                    onChange={e => setOrganismoSolicitante(e.target.value)}
                    className="w-full border-0 border-b border-slate-400 focus:outline-none focus:border-black bg-transparent font-bold py-1"
                  />
                  <br />
                  LA PLANILLA DE COTIZACIÓN FORMA PARTE DEL PLIEGO DE BASES Y CONDICIONES.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 border-4 border-double border-black bg-white text-sm leading-relaxed">
          <table className="w-full border-collapse table-fixed">
            <tbody>
              <tr>
                <td className="w-[38%] p-0 border-r-2 border-black align-top">
                  <div className="p-4 border-b-2 border-black">
                    <p className="font-bold text-base whitespace-nowrap flex items-center gap-2 flex-wrap">
                      Expediente N°{" "}
                      <input
                        type="text"
                        value={expediente}
                        onChange={e => setExpediente(e.target.value)}
                        placeholder="13-00000/26"
                        disabled={expedienteOpcional}
                        className="border-0 border-b border-slate-400 focus:outline-none focus:border-black bg-transparent font-bold w-40 disabled:opacity-40"
                      />
                    </p>
                    <label className="flex items-center gap-1.5 text-[11px] font-normal text-slate-500 mt-1.5 cursor-pointer">
                      <input type="checkbox" checked={expedienteOpcional} onChange={e => setExpedienteOpcional(e.target.checked)}
                        className="w-3 h-3 rounded border-slate-300" />
                      Todavía no tiene expediente asignado (dejar en blanco)
                    </label>
                  </div>

                  <div className="p-4 border-b-2 border-black">
                    <div className="mb-2">
                      <select
                        value={tipoProcedimiento}
                        onChange={e => setTipoProcedimiento(e.target.value)}
                        className="w-full border border-slate-400 rounded px-2 py-1.5 focus:outline-none focus:border-black bg-white text-xs"
                      >
                        <option value="tramiteSimplificado">Contratación Directa – Trámite Simplificado</option>
                        <option value="licitacionPrivada">Licitación Privada</option>
                        <option value="contratacionDirecta">Contratación Directa</option>
                        <option value="contratacionDirectaExclusividad">Contratación Directa por Exclusividad</option>
                      </select>
                    </div>
                    <p className="text-justify leading-relaxed">
                      <span className="font-bold">PROCEDIMIENTO </span>
                      {getTextoProcedimiento()}
                    </p>
                    <p className="font-bold text-center mt-4">
                      {getTituloContratacion()}{" "}
                      <input
                        type="text"
                        value={numeroContratacion}
                        onChange={e => setNumeroContratacion(e.target.value)}
                        disabled={numeroContratacionOpcional}
                        className="border-0 border-b border-slate-400 focus:outline-none focus:border-black bg-transparent font-bold text-center w-20 disabled:opacity-40"
                      />
                    </p>
                    <label className="flex items-center gap-1.5 text-[11px] font-normal text-slate-500 mt-1.5 justify-center cursor-pointer">
                      <input type="checkbox" checked={numeroContratacionOpcional} onChange={e => setNumeroContratacionOpcional(e.target.checked)}
                        className="w-3 h-3 rounded border-slate-300" />
                      Todavía no tiene número de contratación (dejar en blanco)
                    </label>
                  </div>

                  <div className="p-4">
                    <p className="font-bold underline text-center mb-4">OFERENTE</p>
                    <p className="font-bold underline">DOMICILIO:</p>
                    <p className="border-b border-dotted border-slate-400 h-6 mb-3" />
                    <p className="font-bold underline">TELÉFONO:</p>
                    <p className="border-b border-dotted border-slate-400 h-6 mb-3" />
                    <p className="font-bold underline">CUIT:</p>
                    <p className="border-b border-dotted border-slate-400 h-6 mb-3" />
                    <p className="font-bold underline">CORREO ELECTRÓNICO:</p>
                    <p className="border-b border-dotted border-slate-400 h-6" />
                  </div>
                </td>

                <td className="w-[62%] p-4 align-top">
                  <p className="mb-4 text-justify">
                    <span className="font-bold underline">PRESENTACIÓN DE OFERTAS:</span> SUBDIRECCIÓN DE
                    CONTRATACIONES, SITA EN LA CALLE SARMIENTO N° 877, 1ER SUBSUELO, (SALA DE APERTURAS), C.A.B.A.,
                    HASTA EL DÍA {fechaAperturaLarga()} A LAS {horaAperturaTexto()}.
                  </p>

                  <p className="mb-4 text-justify">
                    <span className="font-bold underline">LUGAR, FECHA Y HORA DE APERTURA</span> SUBDIRECCIÓN DE
                    CONTRATACIONES, SITA EN LA CALLE SARMIENTO N° 877, 1ER SUBSUELO, (SALA DE APERTURAS), C.A.B.A.,
                    EL DÍA {fechaAperturaLarga()} A LAS {horaAperturaTexto()}.
                  </p>

                  <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
                    <label className="font-medium text-slate-600">Fecha de presentación / apertura:</label>
                    <input type="date" value={fechaApertura} onChange={e => setFechaApertura(e.target.value)}
                      disabled={fechaAperturaOpcional}
                      className="border border-slate-300 rounded px-2 py-1 disabled:opacity-40" />
                    <select value={horaApertura} onChange={e => setHoraApertura(e.target.value)}
                      disabled={fechaAperturaOpcional}
                      className="border border-slate-300 rounded px-2 py-1 disabled:opacity-40">
                      <option value="9">9:00</option>
                      <option value="10">10:00</option>
                      <option value="11">11:00</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-500 mb-4 cursor-pointer">
                    <input type="checkbox" checked={fechaAperturaOpcional} onChange={e => setFechaAperturaOpcional(e.target.checked)}
                      className="w-3 h-3 rounded border-slate-300" />
                    Todavía no hay fecha/hora de apertura definida (dejar en blanco)
                  </label>

                  <p className="mb-2 text-justify">
                    <span className="font-bold underline">CONSULTA Y DESCARGA DE PLIEGOS:</span> Sitio Web: Sistema
                    de Registro de Proveedores del Consejo de la Magistratura (SRPCM):{" "}
                    <a href="https://srpcm.pjn.gov.ar" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                      https://srpcm.pjn.gov.ar
                    </a>.
                  </p>
                  <p className="font-bold mb-4 text-justify">
                    Toda consulta respecto al Pliego de Bases y Condiciones deberá efectuarse conforme a lo indicado
                    en el Anexo a las Cláusulas Particulares del respectivo Pliego.
                  </p>

                  <p className="font-bold underline mb-2">INSCRIPCIÓN EN EL REGISTRO DE PROVEEDORES</p>
                  <p className="mb-2 text-justify">
                    Se recuerda que a fin de dar cumplimiento a lo dispuesto por la Resolución CM N° 362/2021, que
                    establece la obligatoriedad de la inscripción en el registro de proveedores del Consejo de la
                    Magistratura del Poder Judicial de la Nación (SRPCM), deberán ingresar al siguiente link{" "}
                    <a href="https://srpcm.pjn.gov.ar" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                      https://srpcm.pjn.gov.ar
                    </a>{" "}
                    o a los que en un futuro los reemplacen.
                  </p>
                  <p className="mb-2 text-justify">
                    Asimismo, se recuerda lo dispuesto en el Art. N° 3° -PRE-INSCRIPCIÓN- in fine, del Anexo I –
                    Instructivo, de la citada Resolución: <span className="font-semibold">"Cuando el proveedor se
                    encuentre pre-inscripto podrá adquirir pliego y presentar ofertas. No obstante, es requisito
                    obligatorio haber finalizado el trámite de Inscripción para ser preadjudicado o adjudicado, como
                    así también mantener la información y documentación actualizada en dicho registro. En cuyo caso,
                    no será necesario volver a anexar toda la documentación que fue presentada para ser incorporados
                    en el sistema, sino solo aquella que se pretenda actualizar.</span>
                  </p>
                  <p className="text-justify font-semibold">
                    Para el caso de que la inscripción no haya sido finalizada por motivos que no le puedan ser
                    endilgados al proveedor, no se lo podrá excluir de la posibilidad de ser preadjudicado o
                    adjudicado".
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RenglonPlanillaFilas({ renglon, onUpdateRenglon, indiceVisible, mostrarCantidad, mostrarColumnaItem, onUpdateSub, onAddSub, onDeleteSub, onDeleteRenglon }) {
  const isSimple = renglon.esSimple;
  const filas = [];

  if (isSimple) {
    filas.push({
      tipo: "simple", key: "simple-" + renglon.id, codigoItem: null,
      descripcion: renglon.descripcion || "", cantidad: renglon.cantidad || "",
    });
  } else {
    renglon.items.forEach(item => {
      filas.push({
        tipo: "subitem", key: "sub-" + renglon.id + "-" + item.subId, codigoItem: indiceVisible + "." + item.letra,
        descripcion: item.descripcion || "", cantidad: item.cantidad || "", subId: item.subId,
      });
    });
  }

  return (
    <>
      {filas.map((fila, index) => (
        <tr key={fila.key} className={"border-double border-4 border-black " + (fila.tipo === "subitem" ? "bg-slate-50" : "")}>
          {index === 0 && (
            <td className="px-3 py-3 text-center align-middle font-medium border-double border-4 border-black" rowSpan={filas.length}>
              {indiceVisible}
            </td>
          )}
          {mostrarColumnaItem && (
            <td className="px-3 py-3 text-center align-middle font-medium border-double border-4 border-black">
              {fila.codigoItem || ""}
            </td>
          )}

          <td className="px-3 py-3 align-top border-double border-4 border-black">
            <div className="flex items-start gap-3">
              <textarea
                value={fila.descripcion}
                onChange={e => {
                  if (fila.tipo === "simple") onUpdateRenglon(renglon.id, "descripcion", e.target.value);
                  else onUpdateSub(renglon.id, fila.subId, "descripcion", e.target.value);
                }}
                placeholder="Descripción..."
                rows={fila.tipo === "simple" ? 3 : 2}
                className="flex-1 bg-transparent focus:outline-none resize-y border-b border-slate-300 pb-1 text-sm"
              />
              <button onClick={() => onDeleteRenglon(renglon.id)} className="text-red-600 hover:text-red-800 text-xl leading-none mt-1" title="Eliminar renglón completo">
                ×
              </button>
            </div>
            {fila.tipo === "subitem" && fila.subId === renglon.items[renglon.items.length - 1]?.subId && (
              <button onClick={() => onAddSub(renglon.id)} className="text-blue-600 hover:underline text-xs mt-3 block">
                + Agregar sub-ítem ({String.fromCharCode(97 + renglon.items.length)})
              </button>
            )}
          </td>

          {mostrarCantidad && (
            <td className="text-center align-middle px-3 py-2 border-double border-4 border-black">
              <input
                value={fila.cantidad}
                onChange={e => {
                  if (fila.tipo === "simple") onUpdateRenglon(renglon.id, "cantidad", e.target.value);
                  else onUpdateSub(renglon.id, fila.subId, "cantidad", e.target.value);
                }}
                placeholder="Ej: 2, 4 agentes, 36 meses"
                className="w-full text-xs text-center bg-transparent focus:outline-none border-b border-slate-300 pb-1"
              />
            </td>
          )}

          <td className="text-left align-middle px-3 py-2 border-double border-4 border-black">
            <p className="text-xs">$Pesos.......................................................................................</p>
          </td>
          <td className="text-left align-middle px-3 py-2 border-double border-4 border-black">
            <p className="text-xs">$Pesos.......................................................................................</p>
          </td>
        </tr>
      ))}
    </>
  );
}

