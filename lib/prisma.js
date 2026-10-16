import { PrismaClient } from "@prisma/client";
import { normalizarExp } from "./numeroExpediente";

const globalParaPrisma = globalThis;

// Campo con el N° de expediente de cada tabla. Todo lo que se guarda o se
// busca por ese campo pasa por normalizarExp (NN-NNNNN/AAAA), venga de
// donde venga (formularios, cambios rápidos, cargas de planillas...).
const CAMPO_EXP = {
  Expediente: "exp",
  ExpedienteMesa: "exp",
  ExpedienteResolucion: "exp",
  NotificacionResolucion: "exp",
  ExpedienteLicitacion: "exp",
  OrdenCompra: "exp",
  NotificacionArt44: "exp",
  ObraPlan: "expediente",
};

function conExp(objeto, campo) {
  if (Array.isArray(objeto)) return objeto.map(o => conExp(o, campo));
  if (!objeto || typeof objeto !== "object") return objeto;
  const valor = objeto[campo];
  if (typeof valor === "string") return { ...objeto, [campo]: normalizarExp(valor) };
  if (valor && typeof valor === "object" && typeof valor.set === "string") return { ...objeto, [campo]: { ...valor, set: normalizarExp(valor.set) } };
  if (valor && typeof valor === "object" && typeof valor.equals === "string") return { ...objeto, [campo]: { ...valor, equals: normalizarExp(valor.equals) } };
  if (valor && typeof valor === "object" && Array.isArray(valor.in)) return { ...objeto, [campo]: { ...valor, in: valor.in.map(normalizarExp) } };
  return objeto;
}

function crearCliente() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
  return base.$extends({
    query: {
      $allModels: {
        $allOperations({ model, args, query }) {
          const campo = CAMPO_EXP[model];
          if (!campo || !args) return query(args);
          const a = { ...args };
          for (const k of ["data", "create", "update"]) if (a[k]) a[k] = conExp(a[k], campo);
          if (a.where) {
            a.where = conExp(a.where, campo);
            if (a.where.departamentoId_exp) a.where = { ...a.where, departamentoId_exp: conExp(a.where.departamentoId_exp, campo) };
          }
          return query(a);
        },
      },
    },
  });
}

export const prisma = globalParaPrisma.prisma || crearCliente();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prisma = prisma;
}
