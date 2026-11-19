// Presupuesto 2026 de bienes de uso del área informática (Informes de la
// Dirección General de Tecnología y de Seguridad Informática), y qué
// expedientes del Cuadro de Informática y Varios encuadran en cada título.
// El cruce es por palabras del objeto del expediente (sin tildes, en
// mayúsculas): `claves` dice qué tiene que aparecer y `excluye`, qué no.
// Un título sin `claves` (las previsiones) no se cruza solo.
import { armarPresupuesto, renglon as r } from "./presupuestos.js";

const FIREWALL_GENERICO = /FIREWALL/;
const CAMARAS = /CAMARA|VIDEO ?VIGILANCIA|CCTV/;

export const PRESUPUESTO_IYV = armarPresupuesto({
  anio: 2026,
  fuente: "Informes de la Dirección General de Tecnología y de Seguridad Informática",
  tipos: [
    {
      id: "tangibles",
      titulo: "Equipamiento informático",
      subtitulo: "Bienes tangibles · 4.3 Maquinaria y equipo",
      partidas: ["4.2", "4.3"],
      // Total impreso en la planilla (los renglones suman $3 menos: redondeo de centavos).
      total: 13753065281,
      secciones: [
        {
          titulo: "Equipamiento de Dirección General de Tecnología",
          renglones: [
            r("Computadoras personales (reemplazo/incremento)", 4251753828, /COMPUTADORA|\bPC\b|\bPCS\b|ALL IN ONE|DESKTOP|PUESTOS? DE TRABAJO|ESTACION(ES)? DE TRABAJO|MICROINFORMATICA/, /NOTEBOOK|PORTATIL|LAPTOP|ESCANER|IMPRESORA/),
            r("Cableados estructurados - Switches -borde y core-", 1687203900, /CABLEADO|SWITCH/, /FIREWALL/),
            r("Ampliación de Storage de Lex100 y Backup del centro de datos", 1518483510, /STORAGE|ALMACENAMIENTO|BACK ?UP|RESGUARDO|LEX ?100|CENTRO DE (COMPUTOS|DATOS)|DATA ?CENTER|HIPERCONVERGEN|SERVIDOR/, CAMARAS),
            r("Oralidad y Salas de audiencia del país", 632701462, /ORALIDAD|SALAS? DE AUDIENCIA|AUDIENCIAS|AUDIO Y VIDEO|VIDEOCONFERENCIA|VIDEO CONFERENCIA|GRABACION DE AUDIENCIA/),
            r("Provisión Escáneres", 421800975, /ESCANER|SCANNER|DIGITALIZADOR/),
            r("Impresoras MFC de red", 759241755, /IMPRESORA|MULTIFUNCION|\bMFC\b/, /INSUMO|TONER|CARTUCHO|ETIQUETA/),
            r("Bs Uso Comunicaciones - Telefonía IP y Otros", 351500812, /TELEFON|CENTRAL TELEF|HEADSET|AURICULAR|HANDY|ELECTRONICA DE COMUNICACION|GATEWAY|INTERCOMUNICADOR/),
            r("Notebooks", 140600325, /NOTEBOOK|PORTATIL|LAPTOP/),
            r("Discos externos USB (5 TB)", 140600325, /DISCOS? (RIGIDOS? )?EXTERNOS?|DISCO USB/, /\b4 ?TB/),
            r("Discos externos USB (4 TB)", 105450244, /DISCOS? (RIGIDOS? )?EXTERNOS?|DISCO USB/, /\b5 ?TB/),
            r("Discos, memorias y procesadores para taller", 421800975, /MEMORIAS?\b|PROCESADOR|\bSSD\b|DISCOS? (RIGIDOS?|SOLIDOS?|INTERNOS?)|REPUESTO|TALLER/, /EXTERNO|PEN ?DRIVE/),
            r("Lectores de códigos de barra", 30932071, /CODIGOS? DE BARRA|LECTOR(ES)? DE COD/),
            r("Pendrives 32 Gb / 64 Gb", 3374408, /PEN ?DRIVE/, /128/),
            r("Pendrives 128 Gb", 3515008, /PEN ?DRIVE/, /\b(32|64) ?GB/),
          ],
        },
        {
          titulo: "Equipamiento de Seguridad Informática",
          renglones: [
            r("Análisis de tráfico de red", 998262307, /TRAFICO|ANALISIS DE RED|\bNDR\b|SONDA/),
            r("SIEM Gestión de Eventos e Información de Seguridad", 787361820, /\bSIEM\b|GESTION DE EVENTOS|EVENTOS DE SEGURIDAD/),
            r("Implementación de 150 nuevas cámaras de video vigilancia", 659696725, CAMARAS, /MANTENIM|SERVIDOR|GRABADOR|\bNVR\b|\bDVR\b/),
            r("Firewall de Core", 442891024, FIREWALL_GENERICO, /SONICWALL|VPN|INTERIOR/),
            r("Firewall Sonicwall", 210900487, /SONICWALL/),
            r("Firewall VPN sites interior", 28120065, /\bVPN\b|FIREWALL.*INTERIOR/, /SONICWALL/),
            r("Mantenimiento sistemas de videovigilancia C.A.B.A", 24401889, /MANTENIM.*(CAMARA|VIDEO ?VIGILANCIA|CCTV)|(CAMARA|VIDEO ?VIGILANCIA|CCTV).*MANTENIM/),
            r("Adquisición Access Points (150 u)", 44036710, /ACCESS ?POINTS?|\bAP\b|WI-?FI|INALAMBRIC/),
            r("Servidor centralizado de cámaras de videovigilancia", 20011443, /(SERVIDOR|GRABADOR|\bNVR\b|\bDVR\b).*(CAMARA|VIDEO)|(CAMARA|VIDEO ?VIGILANCIA).*(SERVIDOR|GRABADOR|\bNVR\b|\bDVR\b)/),
            r("Previsión anual - Nuevas dependencias del Consejo de la Magistratura", 68423210, null),
          ],
        },
      ],
    },
    {
      id: "intangibles",
      titulo: "Programas de computación",
      subtitulo: "Activos intangibles · 4.8",
      partidas: ["4.8"],
      total: 4432349590,
      secciones: [
        {
          titulo: "Equipamiento de Dirección General de Tecnología",
          renglones: [
            r("Licencias para SGJ y SGE - Base de Datos Oracle", 3595853312, /ORACLE|\bSGJ\b|\bSGE\b|BASE DE DATOS/),
            r("Software monitoreo", 228827029, /(SOFTWARE|LICENCIA|HERRAMIENTA|PLATAFORMA).*MONITOREO|MONITOREO.*(SOFTWARE|LICENCIA)/, /SNMP|MEDIOS/),
            r("Zimbra", 261516604, /ZIMBRA|CORREO ELECTRONICO/),
            r("Licencias Microsoft y zoom", 130758302, /MICROSOFT|\bZOOM\b|OFFICE|WINDOWS/),
          ],
        },
        {
          titulo: "Equipamiento de Seguridad Informática",
          renglones: [
            r("Software Monitoreo SNMP", 65379151, /SNMP/),
            r("Certificado SSL 5 años", 9414598, /\bSSL\b/),
            r("Certificado Radius", 523033, /RADIUS/),
          ],
        },
        {
          titulo: "Equipamiento Escuela Judicial",
          renglones: [
            r("Software, material de apoyo didáctico y recursos para la Gestión del desarrollo tecnológico", 10980000, /ESCUELA JUDICIAL|DIDACTIC/),
            r("Previsión anual - Nuevas dependencias del Consejo de la Magistratura", 129097561, null),
          ],
        },
      ],
    },
  ],
});

export const RENGLONES_PRESUPUESTO_IYV = PRESUPUESTO_IYV.renglones;
export const totalPresupuestoIyV = PRESUPUESTO_IYV.suma;
export const renglonesDeObjetoIyV = PRESUPUESTO_IYV.renglonesDe;
