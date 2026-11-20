import type { Source } from "@/lib/revenue";

/** Shared by the server page and the client chart (a "use client" module can't export plain data to the server). */
export const SOURCE_META: Record<Source, { label: string; fill: string }> = {
  pkg: { label: "Bán gói", fill: "bg-jade" },
  svc: { label: "Dịch vụ lẻ", fill: "bg-money" },
  prod: { label: "Mỹ phẩm", fill: "bg-prod" },
};
