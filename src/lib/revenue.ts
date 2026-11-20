import "server-only";
import { db } from "./db";
import { addDays, dateToStr, diffDays, fmtDate, isDateStr, strToDate } from "./dates";

/**
 * Revenue = money actually charged, on the day it was charged:
 * - "svc": paid service lines of a visit (`visit_items.price`; package sessions are 0),
 * - "pkg": packages sold (`customer_packages.paid_amount` on `purchase_date`),
 * - "prod": cosmetics sold (`product_sales.price`, a line total, on `sale_date`).
 * Same sums as the Nhật ký day total, so the two screens always agree.
 */
export type Source = "svc" | "pkg" | "prod";
export const SOURCES: Source[] = ["pkg", "svc", "prod"]; // chart stack order, bottom → top
export type Amounts = Record<Source, number>;

export type PeriodKey = "today" | "week" | "month" | "lastmonth" | "custom";
export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "lastmonth", label: "Tháng trước" },
  { key: "custom", label: "Tự chọn" },
];

export type Period = { key: PeriodKey; from: string; to: string; prevFrom: string; prevTo: string };

const MAX_DAYS = 366 * 3;

function monthStart(s: string) {
  return `${s.slice(0, 7)}-01`;
}
function shiftMonth(s: string, n: number) {
  const d = strToDate(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return dateToStr(d);
}
function monthEnd(s: string) {
  return addDays(shiftMonth(s, 1), -1);
}
/** Monday of the week containing s. */
export function weekStart(s: string) {
  const dow = (strToDate(s).getUTCDay() + 6) % 7;
  return addDays(s, -dow);
}

/** Read ?p=&from=&to= into a period plus the period it is compared with. */
export function resolvePeriod(q: { p?: string; from?: string; to?: string }, today: string): Period {
  const key = (PERIODS.some((p) => p.key === q.p) ? q.p : "month") as PeriodKey;
  const shift = (from: string, to: string) => {
    const len = diffDays(to, from) + 1;
    return { prevFrom: addDays(from, -len), prevTo: addDays(from, -1) };
  };
  switch (key) {
    case "today":
      return { key, from: today, to: today, prevFrom: addDays(today, -1), prevTo: addDays(today, -1) };
    case "week": {
      const from = weekStart(today);
      return { key, from, to: today, prevFrom: addDays(from, -7), prevTo: addDays(today, -7) };
    }
    case "month": {
      // Month to date vs. the same days of last month (1 → same day, capped at its last day).
      const from = monthStart(today);
      const prevFrom = shiftMonth(today, -1);
      const sameDay = addDays(prevFrom, diffDays(today, from));
      const prevEnd = monthEnd(prevFrom);
      return { key, from, to: today, prevFrom, prevTo: sameDay < prevEnd ? sameDay : prevEnd };
    }
    case "lastmonth": {
      const from = shiftMonth(today, -1);
      const prevFrom = shiftMonth(today, -2);
      return { key, from, to: monthEnd(from), prevFrom, prevTo: monthEnd(prevFrom) };
    }
    case "custom": {
      let from = isDateStr(q.from) ? q.from : monthStart(today);
      let to = isDateStr(q.to) ? q.to : today;
      if (from > to) [from, to] = [to, from];
      if (diffDays(to, from) + 1 > MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
      return { key, from, to, ...shift(from, to) };
    }
  }
}

export function periodLabel(from: string, to: string) {
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`;
}

const zero = (): Amounts => ({ svc: 0, pkg: 0, prod: 0 });
export const sumAmounts = (a: Amounts) => a.svc + a.pkg + a.prod;

/** Revenue per day and source in [from, to]. Days without revenue are absent. */
async function dailyRevenue(from: string, to: string): Promise<Map<string, Amounts>> {
  const rows = await db.$queryRaw<{ day: string; src: Source; amount: bigint }[]>`
    SELECT to_char(d, 'YYYY-MM-DD') AS day, src, SUM(amount)::bigint AS amount FROM (
      SELECT v.visit_date AS d, 'svc' AS src, vi.price AS amount
        FROM visit_items vi JOIN visits v ON v.id = vi.visit_id
       WHERE v.visit_date BETWEEN ${from}::date AND ${to}::date
         AND vi.customer_package_item_id IS NULL -- package sessions: revenue was counted when the package was sold
      UNION ALL
      SELECT purchase_date, 'pkg', paid_amount FROM customer_packages
       WHERE purchase_date BETWEEN ${from}::date AND ${to}::date
      UNION ALL
      SELECT sale_date, 'prod', price FROM product_sales
       WHERE sale_date BETWEEN ${from}::date AND ${to}::date
    ) x GROUP BY 1, 2`;
  const map = new Map<string, Amounts>();
  for (const r of rows) {
    const a = map.get(r.day) ?? zero();
    a[r.src] += Number(r.amount);
    map.set(r.day, a);
  }
  return map;
}

function total(map: Map<string, Amounts>): Amounts {
  const t = zero();
  for (const a of map.values()) for (const s of SOURCES) t[s] += a[s];
  return t;
}

export type CustomerStats = { visits: number; customers: number; newCustomers: number };

/** Visits, distinct customers served, and customers whose very first visit falls in the range. */
async function customerStats(from: string, to: string): Promise<CustomerStats> {
  const [a] = await db.$queryRaw<{ visits: number; customers: number }[]>`
    SELECT count(*)::int AS visits, count(DISTINCT customer_id)::int AS customers
      FROM visits WHERE visit_date BETWEEN ${from}::date AND ${to}::date`;
  const [b] = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM (
      SELECT min(visit_date) AS first FROM visits GROUP BY customer_id
    ) x WHERE first BETWEEN ${from}::date AND ${to}::date`;
  return { visits: a.visits, customers: a.customers, newCustomers: b.n };
}

export type TopRow = { id: number; name: string; qty: number; amount: number; pkgQty?: number };
export type TopSort = "amount" | "qty";

async function topLists(from: string, to: string, sort: TopSort, limit = 5) {
  const num = (rows: { id: number; name: string; qty: number; amount: bigint; pkg_qty?: number }[]): TopRow[] =>
    rows
      .map((r) => ({ id: r.id, name: r.name, qty: r.qty, amount: Number(r.amount), pkgQty: r.pkg_qty }))
      .sort((x, y) => (sort === "qty" ? y.qty - x.qty || y.amount - x.amount : y.amount - x.amount || y.qty - x.qty))
      .slice(0, limit);
  const [services, packages, products] = await Promise.all([
    db.$queryRaw<{ id: number; name: string; qty: number; amount: bigint; pkg_qty: number }[]>`
      SELECT s.id, s.name, count(*)::int AS qty,
             (count(*) FILTER (WHERE vi.customer_package_item_id IS NOT NULL))::int AS pkg_qty,
             COALESCE(SUM(vi.price) FILTER (WHERE vi.customer_package_item_id IS NULL), 0)::bigint AS amount
        FROM visit_items vi
        JOIN visits v ON v.id = vi.visit_id
        JOIN services s ON s.id = vi.service_id
       WHERE v.visit_date BETWEEN ${from}::date AND ${to}::date
       GROUP BY s.id, s.name`,
    db.$queryRaw<{ id: number; name: string; qty: number; amount: bigint }[]>`
      SELECT p.id, p.name, count(*)::int AS qty, COALESCE(SUM(cp.paid_amount), 0)::bigint AS amount
        FROM customer_packages cp JOIN packages p ON p.id = cp.package_id
       WHERE cp.purchase_date BETWEEN ${from}::date AND ${to}::date
       GROUP BY p.id, p.name`,
    db.$queryRaw<{ id: number; name: string; qty: number; amount: bigint }[]>`
      SELECT p.id, p.name, COALESCE(SUM(ps.quantity), 0)::int AS qty, COALESCE(SUM(ps.price), 0)::bigint AS amount
        FROM product_sales ps JOIN products p ON p.id = ps.product_id
       WHERE ps.sale_date BETWEEN ${from}::date AND ${to}::date
       GROUP BY p.id, p.name`,
  ]);
  return { services: num(services), packages: num(packages), products: num(products) };
}

export type Bucket = { key: string; label: string; title: string; amounts: Amounts };
export type Grain = "day" | "week" | "month";

/** Group daily revenue into chart buckets: days up to a month, weeks up to ~6 months, then months. */
function buckets(daily: Map<string, Amounts>, from: string, to: string): { grain: Grain; buckets: Bucket[] } {
  const days = diffDays(to, from) + 1;
  const grain: Grain = days <= 31 ? "day" : days <= 182 ? "week" : "month";
  const out: Bucket[] = [];
  let start = grain === "day" ? from : grain === "week" ? weekStart(from) : monthStart(from);
  while (start <= to) {
    const next = grain === "day" ? addDays(start, 1) : grain === "week" ? addDays(start, 7) : shiftMonth(start, 1);
    const a = zero();
    for (let d = start < from ? from : start; d < next && d <= to; d = addDays(d, 1)) {
      const v = daily.get(d);
      if (v) for (const s of SOURCES) a[s] += v[s];
    }
    const end = addDays(next, -1) > to ? to : addDays(next, -1);
    const lo = start < from ? from : start;
    out.push({
      key: start,
      label: grain === "month" ? `T${Number(start.slice(5, 7))}` : fmtDate(lo).slice(0, 5),
      title:
        grain === "day"
          ? fmtDate(lo)
          : grain === "month"
            ? `Tháng ${start.slice(5, 7)}/${start.slice(0, 4)}`
            : periodLabel(lo, end),
      amounts: a,
    });
    start = next;
  }
  return { grain, buckets: out };
}

export async function loadRevenueReport(period: Period, sort: TopSort) {
  const [daily, prevDaily, cust, prevCust, top] = await Promise.all([
    dailyRevenue(period.from, period.to),
    dailyRevenue(period.prevFrom, period.prevTo),
    customerStats(period.from, period.to),
    customerStats(period.prevFrom, period.prevTo),
    topLists(period.from, period.to, sort),
  ]);
  return {
    current: total(daily),
    previous: total(prevDaily),
    cust,
    prevCust,
    top,
    ...buckets(daily, period.from, period.to),
  };
}
