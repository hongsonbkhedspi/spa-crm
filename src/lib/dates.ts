/**
 * Date helpers pinned to Asia/Ho_Chi_Minh regardless of the server's TZ.
 *
 * Calendar dates (Prisma @db.Date columns) travel as "YYYY-MM-DD" strings and are
 * stored as UTC-midnight Date objects. Timestamps (appointments) are real instants
 * and are converted with the fixed +07:00 offset (Vietnam has no DST).
 */
export const TZ = "Asia/Ho_Chi_Minh";
const OFFSET = "+07:00";

const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Today in Vietnam as YYYY-MM-DD. */
export function todayStr(): string {
  return ymdFmt.format(new Date());
}

/** Calendar date (UTC-midnight Date from a @db.Date column) → YYYY-MM-DD. */
export function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** YYYY-MM-DD → UTC-midnight Date for a @db.Date column. */
export function strToDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

export function addDays(s: string, n: number): string {
  const d = strToDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return dateToStr(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((strToDate(a).getTime() - strToDate(b).getTime()) / 86400000);
}

/** Instant → YYYY-MM-DD in Vietnam. */
export function instantToDateStr(d: Date): string {
  return ymdFmt.format(d);
}

/** Instant → HH:mm in Vietnam. */
export function instantToTimeStr(d: Date): string {
  return hmFmt.format(d);
}

/** YYYY-MM-DD + HH:mm (Vietnam) → instant. */
export function toInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${OFFSET}`);
}

/** Start of a Vietnam calendar day as an instant. */
export function dayStart(date: string): Date {
  return toInstant(date, "00:00");
}

/** dd/MM/yyyy */
export function fmtDate(s: string | Date | null | undefined): string {
  if (!s) return "";
  const str = typeof s === "string" ? s : dateToStr(s);
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtInstantDate(d: Date): string {
  return fmtDate(instantToDateStr(d));
}

const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function weekday(s: string): string {
  return WEEKDAYS[strToDate(s).getUTCDay()];
}

/** "Hôm nay", "Ngày mai", or "T5 20/11". */
export function relativeDay(s: string, today = todayStr()): string {
  const n = diffDays(s, today);
  if (n === 0) return "Hôm nay";
  if (n === 1) return "Ngày mai";
  if (n === 2) return "Ngày kia";
  if (n === -1) return "Hôm qua";
  return `${weekday(s)} ${fmtDate(s).slice(0, 5)}`;
}

export function isDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isTimeStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{2}:\d{2}$/.test(s);
}
