import "server-only";
import type { Prisma } from "@prisma/client";
import { addDays, strToDate, todayStr } from "./dates";

/** run_out_date = sale_date + usage_days × quantity */
export function computeRunOut(saleDate: string, usageDays: number, quantity: number) {
  return addDays(saleDate, usageDays * Math.max(1, quantity));
}

/** Pending follow-ups whose reminder window has opened (today ≥ run_out − remindDays). */
export function dueProductsWhere(remindDays: number): Prisma.ProductSaleWhereInput {
  return {
    followUpStatus: "pending",
    runOutDate: { lte: strToDate(addDays(todayStr(), remindDays)) },
  };
}
