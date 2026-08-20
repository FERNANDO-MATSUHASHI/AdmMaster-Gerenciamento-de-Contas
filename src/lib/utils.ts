import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function safeParseDate(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? new Date() : dateVal;
  }
  if (typeof dateVal === "string") {
    const cleanStr = dateVal.split("T")[0];
    const parts = cleanStr.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function safeFormatDate(dateVal: any, formatStr: string = "dd/MM/yyyy"): string {
  try {
    if (!dateVal) return "";
    const d = safeParseDate(dateVal);
    if (isNaN(d.getTime())) return "";
    return format(d, formatStr, { locale: ptBR });
  } catch (e) {
    return "";
  }
}


