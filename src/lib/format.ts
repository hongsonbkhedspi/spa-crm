const vnd = new Intl.NumberFormat("vi-VN");

/** 1250000 → "1.250.000 đ" */
export function fmtMoney(n: number | null | undefined): string {
  return `${vnd.format(n ?? 0)} đ`;
}

/** Normalize a Vietnamese phone number: strip spaces/dots/dashes, +84/84 → 0. */
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[\s.\-()]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  else if (p.startsWith("84") && p.length === 11) p = "0" + p.slice(2);
  return p;
}

export function isValidPhone(p: string): boolean {
  return /^0\d{8,10}$/.test(p);
}

/** 0901234567 → "0901 234 567" for display; no phone → "". */
export function fmtPhone(p: string | null): string {
  if (!p) return "";
  if (p.length === 10) return `${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`;
  return p;
}

export function zaloLink(phone: string): string {
  return `https://zalo.me/${phone}`;
}

/** Lowercase, strip Vietnamese diacritics — for accent-insensitive search. */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function parseIntSafe(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}
