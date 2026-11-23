import type { LogFilter } from "./filters";

/** /nhat-ky URL for a filter, leaving out empty conditions. */
export function logHref(f: LogFilter, page = 1) {
  const p = new URLSearchParams();
  for (const k of ["from", "to", "q", "cust", "item", "it", "by"] as const) if (f[k]) p.set(k, f[k]);
  if (page > 1) p.set("page", String(page));
  return `/nhat-ky?${p}`;
}
