import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, ChartColumn, Minus, UserPlus } from "lucide-react";
import { requireOwnerPage } from "@/lib/auth";
import { todayStr } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import {
  PERIODS,
  SOURCES,
  loadRevenueReport,
  periodLabel,
  resolvePeriod,
  sumAmounts,
  type Period,
  type TopRow,
  type TopSort,
} from "@/lib/revenue";
import { cn } from "@/lib/utils";
import { PageHeader, Panel, Empty, TopicChip } from "@/components/ui/page";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TOPIC, type Topic } from "@/components/ui/topic";
import { RevenueChart } from "./revenue-chart";
import { SOURCE_META } from "./sources";

export const metadata = { title: "Doanh thu" };

type Search = { p?: string; from?: string; to?: string; top?: string };

const SOURCE_TOPIC = { pkg: "pkg", svc: "money", prod: "prod" } as const satisfies Record<string, Topic>;

export default async function RevenuePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireOwnerPage();
  const q = await searchParams;
  const today = todayStr();
  const period = resolvePeriod(q, today);
  const sort: TopSort = q.top === "qty" ? "qty" : "amount";
  const r = await loadRevenueReport(period, sort);
  const total = sumAmounts(r.current);
  const prevTotal = sumAmounts(r.previous);

  const href = (over: Partial<Search>) => {
    const p = new URLSearchParams();
    const next = { p: period.key, ...(period.key === "custom" ? { from: period.from, to: period.to } : {}), top: sort, ...over };
    for (const [k, v] of Object.entries(next)) if (v && !(k === "top" && v === "amount") && !(k === "p" && v === "month")) p.set(k, v);
    const s = p.toString();
    return s ? `/doanh-thu?${s}` : "/doanh-thu";
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Doanh thu" topic="money" icon={ChartColumn}>
        <p className="num mt-1 flex items-center gap-1 text-ink-soft">
          {periodLabel(period.from, period.to)}
          <InfoTip
            label="Cách tính doanh thu"
            text="Doanh thu = tiền dịch vụ lẻ + tiền bán gói (tính vào ngày mua) + tiền mỹ phẩm, giống tổng tiền ở Nhật ký. Buổi trừ từ gói không tính thêm tiền. Gói đã huỷ vẫn được tính vì tiền đã thu."
          />
        </p>
      </PageHeader>

      <PeriodPicker period={period} href={href} />

      <div className="grid gap-3 md:grid-cols-[3fr_2fr]">
        <section className="rounded-[var(--radius-panel)] border border-money/30 bg-surface p-4" aria-label="Tổng doanh thu">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-money-ink">Tổng doanh thu</h2>
              <p className="num mt-1 text-[2rem] font-semibold leading-tight tracking-[-0.02em] text-money-ink">{fmtMoney(total)}</p>
              <Delta cur={total} prev={prevTotal} money period={period} />
            </div>
            <TopicChip topic="money" icon={ChartColumn} size="sm" />
          </div>
          {total > 0 && (
            <div className="mt-3 flex h-2.5 gap-[2px] overflow-hidden rounded-full" aria-hidden>
              {SOURCES.filter((s) => r.current[s] > 0).map((s) => (
                <span key={s} className={SOURCE_META[s].fill} style={{ flexGrow: r.current[s], flexBasis: 0 }} />
              ))}
            </div>
          )}
          <ul className="mt-3 divide-y divide-line">
            {[...SOURCES].reverse().map((s) => (
              <li key={s} className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-0.5 py-1.5">
                <span className={cn("size-3 rounded-[3px]", SOURCE_META[s].fill)} aria-hidden />
                <span className={cn("flex-1 text-sm font-medium", TOPIC[SOURCE_TOPIC[s]].ink)}>{SOURCE_META[s].label}</span>
                <span className="num text-xs text-muted">{total > 0 ? `${Math.round((r.current[s] / total) * 100)}%` : "–"}</span>
                <span className="num min-w-28 text-right font-semibold">{fmtMoney(r.current[s])}</span>
                <span className="basis-full pl-5 text-right">
                  <Delta cur={r.current[s]} prev={r.previous[s]} money period={period} small />
                </span>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid grid-cols-2 content-start gap-3">
          <StatTile
            label="Lượt khách"
            value={r.cust.visits}
            note={`${r.cust.customers} khách`}
            delta={<Delta cur={r.cust.visits} prev={r.prevCust.visits} period={period} small />}
          />
          <StatTile
            label="Khách mới"
            info="Khách có lượt ghi nhận đầu tiên trong khoảng thời gian này."
            icon={UserPlus}
            value={r.cust.newCustomers}
            note={r.cust.customers > 0 ? `${Math.round((r.cust.newCustomers / r.cust.customers) * 100)}% số khách` : " "}
            delta={<Delta cur={r.cust.newCustomers} prev={r.prevCust.newCustomers} period={period} small />}
          />
        </div>
      </div>

      <Panel title="Biểu đồ doanh thu" topic="money" icon={ChartColumn}>
        {total === 0 ? <Empty>Chưa có doanh thu trong khoảng thời gian này.</Empty> : <RevenueChart buckets={r.buckets} />}
      </Panel>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Bán chạy</h2>
        <div className="flex rounded-[var(--radius-field)] border border-line-strong p-0.5 text-sm" role="group" aria-label="Sắp xếp">
          {(
            [
              ["amount", "Theo doanh thu"],
              ["qty", "Theo số lượng"],
            ] as const
          ).map(([k, label]) => (
            <Link
              key={k}
              href={href({ top: k })}
              scroll={false}
              aria-current={sort === k ? "true" : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-[calc(var(--radius-field)-2px)] px-3",
                sort === k ? "bg-money-wash font-semibold text-money-ink" : "text-ink-soft",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <TopPanel title="Dịch vụ" topic="money" rows={r.top.services} unit="lượt" showPkg />
        <TopPanel title="Gói liệu trình" topic="pkg" rows={r.top.packages} unit="gói" />
        <TopPanel title="Mỹ phẩm" topic="prod" rows={r.top.products} unit="sp" />
      </div>
    </div>
  );
}

function PeriodPicker({ period, href }: { period: Period; href: (o: Partial<Search>) => string }) {
  return (
    <div className="flex flex-col gap-2">
      <nav aria-label="Khoảng thời gian" className="flex flex-wrap gap-2">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={href(p.key === "custom" ? { p: "custom", from: period.from, to: period.to } : { p: p.key, from: undefined, to: undefined })}
            aria-current={period.key === p.key ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
              period.key === p.key ? "border-money bg-money text-white" : "border-line-strong bg-surface text-ink-soft hover:border-money",
            )}
          >
            {p.label}
          </Link>
        ))}
      </nav>
      {period.key === "custom" && (
        <form method="get" action="/doanh-thu" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="p" value="custom" />
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm text-ink-soft">
            Từ ngày
            <Input type="date" name="from" defaultValue={period.from} required />
          </label>
          <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm text-ink-soft">
            Đến ngày
            <Input type="date" name="to" defaultValue={period.to} required />
          </label>
          <Button type="submit" className="basis-full sm:basis-auto">
            Xem
          </Button>
        </form>
      )}
    </div>
  );
}

/** "▲ 12% so với 01/10 – 20/10/2026", arrow + sign so it never relies on colour alone. */
function Delta({ cur, prev, period, money, small }: { cur: number; prev: number; period: Period; money?: boolean; small?: boolean }) {
  const diff = cur - prev;
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const tone = diff > 0 ? "text-jade-deep" : diff < 0 ? "text-lotus" : "text-muted";
  const text =
    diff === 0
      ? "Không đổi"
      : pct !== null && pct >= 900
        ? `gấp ${Math.round(cur / prev)} lần`
        : pct !== null
          ? `${diff > 0 ? "+" : "−"}${Math.abs(pct)}%`
        : money
          ? `+${fmtMoney(diff)}`
          : `+${diff}`;
  return (
    <span
      className={cn("num inline-flex items-center gap-0.5", small ? "text-xs" : "mt-1 text-sm")}
      title={`Kỳ trước (${periodLabel(period.prevFrom, period.prevTo)}): ${money ? fmtMoney(prev) : prev}`}
    >
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", tone)}>
        <Icon className={small ? "size-3.5" : "size-4"} strokeWidth={2.4} aria-hidden />
        {text}
      </span>
      <span className="ml-1 text-muted">{small ? "kỳ trước" : `so với ${periodLabel(period.prevFrom, period.prevTo)}`}</span>
    </span>
  );
}

function StatTile({
  label,
  value,
  note,
  delta,
  icon,
  info,
}: {
  label: string;
  value: number;
  note: string;
  delta: React.ReactNode;
  icon?: typeof UserPlus;
  info?: string;
}) {
  return (
    <section className="flex min-h-36 flex-col justify-between gap-2 rounded-[18px] border border-cust/25 bg-cust-wash p-3.5 md:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center text-sm font-semibold leading-snug text-cust-ink">
          {label}
          {info && <InfoTip text={info} label={`Giải thích ${label}`} />}
        </span>
        <TopicChip topic="cust" icon={icon} size="sm" />
      </div>
      <div className="min-w-0">
        <p className="num text-[2.5rem] font-semibold leading-none tracking-[-0.02em] text-cust-ink">{value}</p>
        <p className="mt-1.5 truncate text-xs text-ink-soft">{note}</p>
        <div className="mt-1">{delta}</div>
      </div>
    </section>
  );
}

function TopPanel({
  title,
  topic,
  rows,
  unit,
  showPkg,
}: {
  title: string;
  topic: Topic;
  rows: TopRow[];
  unit: string;
  showPkg?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.amount));
  const t = TOPIC[topic];
  return (
    <Panel title={title} topic={topic} bodyClassName="p-0">
      {rows.length === 0 ? (
        <p className="px-4 py-5 text-sm text-muted">Chưa có.</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.id} className="flex flex-col gap-1.5 px-4 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="num w-4 shrink-0 text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}</span>
                <span className="num shrink-0 text-sm font-semibold">{fmtMoney(r.amount)}</span>
              </div>
              <div className="flex items-center gap-2 pl-6">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper" aria-hidden>
                  <span className={cn("block h-full rounded-full", t.chip.split(" ")[0])} style={{ width: `${(r.amount / max) * 100}%` }} />
                </span>
                <span className="num shrink-0 text-xs text-ink-soft">
                  {r.qty} {unit}
                  {showPkg && r.pkgQty ? ` · ${r.pkgQty} từ gói` : ""}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
