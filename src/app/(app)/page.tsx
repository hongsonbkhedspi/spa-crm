import Link from "next/link";
import { AlertTriangle, CalendarPlus, ChevronRight, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { dueProductsWhere } from "@/lib/products";
import { FLAG_LABEL, loadPackageOverview, type PackageFlag } from "@/lib/packages";
import { addDays, dateToStr, dayStart, diffDays, fmtDate, strToDate, todayStr } from "@/lib/dates";
import { fmtMoney, fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Panel, headerLinkClass } from "@/components/ui/page";
import { SummaryRow, SummaryTile } from "@/components/ui/summary-tile";
import { Tag } from "@/components/ui/tag";
import { SessionProgress } from "@/components/ui/beads";
import { loadAppointments, type ApptRow } from "./_today/appointments";
import { AppointmentRow } from "./_today/appointment-row";
import { Upcoming } from "./_today/upcoming";

export const metadata = { title: "Hôm nay" };

const WEEKDAY_FULL = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

export default async function TodayPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const today = todayStr();
  const todayDate = strToDate(today);
  const now = new Date();

  const [todays, upcoming, overdue, products, productCount, packages, lastGoodBackup, visitCount, serviceSum, productSum, packageSum] =
    await Promise.all([
      loadAppointments({
        scheduledAt: { gte: dayStart(today), lt: dayStart(addDays(today, 1)) },
        status: { not: "cancelled" },
      }),
      loadAppointments({
        scheduledAt: { gte: dayStart(addDays(today, 1)), lt: dayStart(addDays(today, 4)) },
        status: "scheduled",
      }),
      loadAppointments({ scheduledAt: { lt: dayStart(today) }, status: "scheduled" }, { order: "desc", take: 20 }),
      db.productSale.findMany({
        where: dueProductsWhere(settings.productRemindDays),
        orderBy: { runOutDate: "asc" },
        take: 5,
        include: { customer: { select: { id: true, name: true, phone: true } }, product: { select: { name: true } } },
      }),
      db.productSale.count({ where: dueProductsWhere(settings.productRemindDays) }),
      loadPackageOverview({ expiryDays: settings.packageExpiryDays }),
      db.backupLog.findFirst({
        where: { status: "success", finishedAt: { gte: new Date(now.getTime() - 48 * 3600 * 1000) } },
        select: { id: true },
      }),
      // Today's takings, read-only, for the summary tile (same sources as Nhật ký).
      db.visit.count({ where: { visitDate: todayDate } }),
      db.visitItem.aggregate({ where: { visit: { visitDate: todayDate } }, _sum: { price: true } }),
      db.productSale.aggregate({ where: { saleDate: todayDate }, _sum: { price: true } }),
      db.customerPackage.aggregate({ where: { purchaseDate: todayDate, status: { not: "cancelled" } }, _sum: { paidAmount: true } }),
    ]);
  const takings = (serviceSum._sum.price ?? 0) + (productSum._sum.price ?? 0) + (packageSum._sum.paidAmount ?? 0);

  const attention = packages.filter((p) => p.flags.length > 0);
  const flagCounts = (["noSchedule", "expiringSoon", "nearlyDone"] as PackageFlag[]).map((f) => ({
    flag: f,
    n: attention.filter((p) => p.flags.includes(f)).length,
  }));

  const days = [1, 2, 3].map((n) => {
    const date = addDays(today, n);
    const label = n === 1 ? "Ngày mai" : n === 2 ? "Ngày kia" : fmtDate(date).slice(0, 5);
    return {
      date,
      label,
      sub: `${WEEKDAY_FULL[new Date(`${date}T00:00:00Z`).getUTCDay()]}, ${fmtDate(date).slice(0, 5)}`,
      items: upcoming.filter((a) => a.date === date),
    };
  });

  const weekdayName = WEEKDAY_FULL[new Date(`${today}T00:00:00Z`).getUTCDay()];
  const waiting = todays.filter((a) => a.status === "scheduled").length;
  const noSchedule = flagCounts.find((f) => f.flag === "noSchedule")!.n;

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      {!lastGoodBackup && (
        <div role="alert" className="flex items-start gap-3 rounded-[var(--radius-panel)] bg-lotus px-4 py-3 text-white">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">Hơn 48 giờ chưa có bản sao lưu thành công</p>
            {user.role === "owner" ? (
              <Link href="/cai-dat/sao-luu" className="underline underline-offset-2">
                Mở trang Sao lưu
              </Link>
            ) : (
              <p>Báo chủ spa kiểm tra sao lưu.</p>
            )}
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-soft">
            {weekdayName}, {fmtDate(today)}
          </p>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">
            {greeting(now)}, {firstName(user.fullName)}
          </h1>
        </div>
        <LinkButton href="/lich-hen/moi" variant="secondary">
          <CalendarPlus className="size-4" /> Đặt lịch
        </LinkButton>
      </header>

      {/* At a glance: one tile per topic, each jumps to its block */}
      <SummaryRow label="Tóm tắt hôm nay">
        <SummaryTile
          topic="appt"
          href="#lich-hom-nay"
          value={todays.length}
          label="Lịch hẹn hôm nay"
          note={todays.length === 0 ? "Chưa có ai đặt" : waiting > 0 ? `${waiting} khách chưa đến` : "Đã đón hết khách"}
        />
        <SummaryTile
          topic="pkg"
          href="#goi-can-chu-y"
          value={attention.length}
          label="Gói cần chú ý"
          note={attention.length === 0 ? "Gói nào cũng có lịch" : noSchedule > 0 ? `${noSchedule} gói chưa có lịch` : "Sắp hết hạn, sắp xong"}
        />
        <SummaryTile
          topic="prod"
          href="#my-pham-sap-het"
          value={productCount}
          label="Mỹ phẩm sắp hết"
          note={productCount === 0 ? "Chưa cần hỏi ai" : "Cần hỏi mua thêm"}
        />
        <SummaryTile
          topic="money"
          href="/nhat-ky"
          value={fmtMoney(takings)}
          label="Thu hôm nay"
          note={`${visitCount} lượt khách`}
          small
        />
      </SummaryRow>

      {overdue.length > 0 && (
        <Panel id="qua-han" topic="alert" icon={Clock} title="Lịch quá hạn chưa xử lý" count={overdue.length} bodyClassName="py-0 divide-y divide-line">
          {overdue.map((a) => (
            <AppointmentRow key={a.id} a={a} showDate={fmtDate(a.date).slice(0, 5)} />
          ))}
        </Panel>
      )}

      <Panel
        id="lich-hom-nay"
        topic="appt"
        title="Lịch hẹn hôm nay"
        count={todays.length}
        bodyClassName={todays.length ? "p-0" : undefined}
      >
        {todays.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
            Hôm nay chưa có lịch hẹn.
            <LinkButton href="/lich-hen/moi" variant="secondary" size="sm">
              <CalendarPlus className="size-4" /> Đặt lịch
            </LinkButton>
          </div>
        ) : (
          <TodayTimeline items={todays} now={now} />
        )}
      </Panel>

      <Panel
        topic="appt"
        title="3 ngày tới"
        count={upcoming.length}
        aside={
          <Link href="/lich-hen?view=week" className={headerLinkClass("appt")}>
            Xem tuần
          </Link>
        }
      >
        <Upcoming days={days} />
      </Panel>

      <div className="grid gap-5 md:gap-6 lg:grid-cols-2">
        <Panel
          id="my-pham-sap-het"
          topic="prod"
          title="Mỹ phẩm sắp hết"
          count={productCount}
          aside={
            productCount > 5 && (
              <Link href="/my-pham-sap-het" className={headerLinkClass("prod")}>
                Xem tất cả
              </Link>
            )
          }
          bodyClassName="py-0"
        >
          {products.length === 0 ? (
            <p className="py-4 text-sm text-muted">Chưa có khách nào sắp hết mỹ phẩm</p>
          ) : (
            <ul className="divide-y divide-line">
              {products.map((s) => {
                const run = dateToStr(s.runOutDate);
                const left = diffDays(run, today);
                return (
                  <li key={s.id} className="flex min-h-12 items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/khach-hang/${s.customer.id}`} className="font-medium hover:text-prod-ink hover:underline">
                        {s.customer.name}
                      </Link>
                      <span className="num ml-2 whitespace-nowrap text-xs text-ink-soft">{fmtPhone(s.customer.phone)}</span>
                      <p className="truncate text-sm text-prod-ink">{s.product.name}</p>
                    </div>
                    <Tag tone={left < 0 ? "lotus" : "turmeric"}>
                      {left < 0 ? `Hết từ ${fmtDate(run).slice(0, 5)}` : left === 0 ? "Hết hôm nay" : `Còn ${left} ngày`}
                    </Tag>
                  </li>
                );
              })}
            </ul>
          )}
          {productCount > 0 && (
            <Link
              href="/my-pham-sap-het"
              className="-mx-4 flex min-h-11 items-center justify-center gap-1 border-t border-line text-sm font-medium text-prod-ink hover:bg-prod-wash"
            >
              Hỏi khách <ChevronRight className="size-4" />
            </Link>
          )}
        </Panel>

        <Panel
          id="goi-can-chu-y"
          topic="pkg"
          title="Gói cần chú ý"
          count={attention.length}
          aside={
            attention.length > 5 && (
              <Link href="/goi" className={headerLinkClass("pkg")}>
                Xem tất cả
              </Link>
            )
          }
          bodyClassName="py-0"
        >
          {attention.length === 0 ? (
            <p className="py-4 text-sm text-muted">Mọi gói đang dùng đều đã có lịch</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 border-b border-line py-3">
                {flagCounts.map(({ flag, n }) => (
                  <Link
                    key={flag}
                    href={`/goi?filter=${flag}`}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm md:min-h-9",
                      n > 0 ? FLAG_STYLE[flag] : "bg-paper text-muted",
                    )}
                  >
                    {FLAG_LABEL[flag]} <span className="num font-semibold">{n}</span>
                  </Link>
                ))}
              </div>
              <ul className="divide-y divide-line">
                {attention.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/goi/${p.id}`} className="font-medium hover:text-jade-deep hover:underline">
                        {p.customer.name}
                      </Link>
                      <p className="truncate text-sm text-ink-soft">
                        {p.packageName}
                        {p.expiryDate && <span className="num"> · HSD {fmtDate(p.expiryDate)}</span>}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <SessionProgress used={p.used} total={p.total} size="sm" />
                      <div className="flex gap-1">
                        {p.flags.map((f) => (
                          <Tag key={f} tone={f === "expiringSoon" ? "lotus" : f === "noSchedule" ? "turmeric" : "jade"}>
                            {FLAG_LABEL[f]}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

const FLAG_STYLE: Record<PackageFlag, string> = {
  noSchedule: "bg-turmeric-wash text-turmeric hover:ring-2 hover:ring-turmeric-bright/30",
  expiringSoon: "bg-lotus-wash text-lotus hover:ring-2 hover:ring-lotus/30",
  nearlyDone: "bg-jade-wash text-jade-deep hover:ring-2 hover:ring-jade/30",
};

/** Today's appointments on an hour rail. Past hours fade; the current hour is marked. */
function TodayTimeline({ items, now }: { items: ApptRow[]; now: Date }) {
  const hourNow = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(now);
  const groups = new Map<string, ApptRow[]>();
  for (const a of items) {
    const h = a.time.slice(0, 2);
    groups.set(h, [...(groups.get(h) ?? []), a]);
  }
  return (
    <ol>
      {[...groups.entries()].map(([h, rows], gi) => {
        const past = h < hourNow;
        const current = h === hourNow;
        return (
          <li key={h} className={cn("grid grid-cols-[3.5rem_1fr] md:grid-cols-[5rem_1fr]", gi > 0 && "border-t border-line")}>
            <div className={cn("relative border-r-2 px-3 pt-3.5 md:px-4", current ? "border-appt" : "border-appt/20")}>
              <span className={cn("num text-lg font-semibold leading-none", current ? "text-appt-ink" : past ? "text-muted" : "text-ink")}>
                {h}
                <span className="text-xs font-medium">:00</span>
              </span>
              {current && <span className="absolute -right-[6px] top-4 size-2.5 rounded-full bg-appt" aria-label="Giờ hiện tại" />}
            </div>
            <div className="divide-y divide-line px-3 md:px-4">
              {rows.map((a) => (
                <AppointmentRow key={a.id} a={a} lateIfPast={past} />
              ))}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function greeting(now: Date) {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", hour12: false }).format(now));
  if (h < 11) return "Chào buổi sáng";
  if (h < 13) return "Chào buổi trưa";
  if (h < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

function firstName(full: string) {
  return full.trim().split(/\s+/).at(-1) ?? full;
}
