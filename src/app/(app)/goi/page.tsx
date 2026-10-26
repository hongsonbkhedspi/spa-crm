import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { FLAG_LABEL, STATUS_LABEL, loadPackageOverview, type PackageFlag, type PackageOverview } from "@/lib/packages";
import { fmtDate, instantToTimeStr, relativeDay, todayStr, addDays } from "@/lib/dates";
import { fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, Empty } from "@/components/ui/page";
import { SessionProgress } from "@/components/ui/beads";
import { Tag } from "@/components/ui/tag";
import { buttonClass } from "@/components/ui/button";
import { ContactButtons } from "@/components/contact";
import { SellPackageButton } from "@/components/sell-package-button";

export const metadata = { title: "Gói liệu trình" };

const FILTERS = [
  { key: "active", label: "Đang dùng" },
  { key: "noSchedule", label: FLAG_LABEL.noSchedule },
  { key: "expiringSoon", label: FLAG_LABEL.expiringSoon },
  { key: "nearlyDone", label: FLAG_LABEL.nearlyDone },
  { key: "completed", label: "Đã xong" },
  { key: "expired", label: "Hết hạn" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default async function PackagesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireUser();
  const { filter: raw } = await searchParams;
  const filter: FilterKey = FILTERS.some((f) => f.key === raw) ? (raw as FilterKey) : "active";
  const settings = await getSettings();

  const active = await loadPackageOverview({ expiryDays: settings.packageExpiryDays });
  const [completedCount, expiredCount] = await Promise.all([
    db.customerPackage.count({ where: { status: "completed" } }),
    db.customerPackage.count({ where: { status: "expired" } }),
  ]);

  const counts: Record<FilterKey, number> = {
    active: active.length,
    noSchedule: active.filter((p) => p.flags.includes("noSchedule")).length,
    expiringSoon: active.filter((p) => p.flags.includes("expiringSoon")).length,
    nearlyDone: active.filter((p) => p.flags.includes("nearlyDone")).length,
    completed: completedCount,
    expired: expiredCount,
  };

  let rows: PackageOverview[];
  if (filter === "completed" || filter === "expired") {
    rows = await loadPackageOverview({ expiryDays: settings.packageExpiryDays, statuses: [filter] });
    rows.sort((a, b) => (b.lastUsedDate ?? b.purchaseDate).localeCompare(a.lastUsedDate ?? a.purchaseDate));
  } else if (filter === "active") {
    rows = active;
  } else {
    rows = active.filter((p) => p.flags.includes(filter as PackageFlag));
  }

  return (
    <>
      <PageHeader title="Gói liệu trình" topic="pkg" actions={<SellPackageButton />} />

      <nav aria-label="Lọc gói" className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex w-max gap-1.5">
          {FILTERS.map((f) => {
            const on = f.key === filter;
            return (
              <li key={f.key}>
                <Link
                  href={f.key === "active" ? "/goi" : `/goi?filter=${f.key}`}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium md:min-h-9",
                    on ? "border-jade bg-jade text-white" : "border-line-strong bg-surface text-ink-soft hover:border-jade",
                  )}
                >
                  {f.label}
                  <span className={cn("num text-xs", on ? "text-white/80" : "text-muted")}>{counts[f.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {rows.length === 0 ? (
        <Empty action={filter === "active" ? <SellPackageButton variant="secondary" /> : undefined}>
          {filter === "active" ? "Chưa có khách nào đang dùng gói." : "Không có gói nào trong mục này."}
        </Empty>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-panel)] border border-jade/25 bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-jade-wash text-left text-xs font-semibold text-jade-deep">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Khách</th>
                  <th className="px-3 py-2.5 font-medium">Gói</th>
                  <th className="px-3 py-2.5 font-medium">Tiến độ</th>
                  <th className="px-3 py-2.5 font-medium">Buổi gần nhất</th>
                  <th className="px-3 py-2.5 font-medium">Lịch tiếp theo</th>
                  <th className="px-3 py-2.5 font-medium">HSD</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/khach-hang/${p.customer.id}`} className="font-semibold hover:text-jade-deep">
                        {p.customer.name}
                      </Link>
                      <div className="num text-xs text-muted">{fmtPhone(p.customer.phone)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/goi/${p.id}`} className="font-medium hover:text-jade-deep">
                        {p.packageName}
                      </Link>
                      <Flags p={p} />
                    </td>
                    <td className="px-3 py-3">
                      <SessionProgress used={p.used} total={p.total} size="sm" />
                    </td>
                    <td className="num px-3 py-3 text-ink-soft">{p.lastUsedDate ? fmtDate(p.lastUsedDate) : "—"}</td>
                    <td className="px-3 py-3">
                      <NextAppt p={p} />
                    </td>
                    <td className="px-3 py-3">
                      <Expiry p={p} days={settings.packageExpiryDays} />
                    </td>
                    <td className="px-4 py-3">
                      <Actions p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone cards */}
          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((p) => (
              <li key={p.id} className="rounded-[var(--radius-panel)] border border-jade/25 border-l-4 border-l-jade bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/khach-hang/${p.customer.id}`} className="font-semibold">
                      {p.customer.name}
                    </Link>
                    <div className="num text-xs text-muted">{fmtPhone(p.customer.phone)}</div>
                  </div>
                  <Expiry p={p} days={settings.packageExpiryDays} />
                </div>
                <Link href={`/goi/${p.id}`} className="mt-3 block font-medium text-ink-soft">
                  {p.packageName}
                </Link>
                <div className="mt-1.5">
                  <SessionProgress used={p.used} total={p.total} />
                </div>
                <Flags p={p} />
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">Buổi gần nhất</dt>
                    <dd className="num font-medium">{p.lastUsedDate ? fmtDate(p.lastUsedDate) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Lịch tiếp theo</dt>
                    <dd>
                      <NextAppt p={p} />
                    </dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-line pt-3">
                  <Actions p={p} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Flags({ p }: { p: PackageOverview }) {
  if (p.status !== "active") {
    return (
      <div className="mt-1">
        <Tag tone={p.status === "completed" ? "jade" : "lotus"}>{STATUS_LABEL[p.status]}</Tag>
      </div>
    );
  }
  if (p.flags.length === 0 && !p.dormant) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {p.flags.map((f) => (
        <Tag key={f} tone={f === "expiringSoon" ? "lotus" : f === "nearlyDone" ? "jade" : "turmeric"}>
          {f === "noSchedule" && p.nextAppointment && p.dormant ? "Lâu chưa đến" : FLAG_LABEL[f]}
        </Tag>
      ))}
    </div>
  );
}

function NextAppt({ p }: { p: PackageOverview }) {
  if (!p.nextAppointment) return <span className="text-muted">—</span>;
  return (
    <span className="num font-medium">
      {relativeDay(p.nextAppointment.date)} · {instantToTimeStr(p.nextAppointment.at)}
    </span>
  );
}

function Expiry({ p, days }: { p: PackageOverview; days: number }) {
  if (!p.expiryDate) return <span className="text-xs text-muted">Không hạn</span>;
  const today = todayStr();
  const past = p.expiryDate < today;
  const soon = !past && p.expiryDate <= addDays(today, days);
  return (
    <span className={cn("num whitespace-nowrap text-sm", past ? "text-lotus" : soon ? "font-semibold text-turmeric" : "text-ink-soft")}>
      {fmtDate(p.expiryDate)}
    </span>
  );
}

function Actions({ p }: { p: PackageOverview }) {
  const nextItem = p.items.find((i) => i.used < i.total);
  const params = new URLSearchParams({ customerId: String(p.customer.id), customerPackageId: String(p.id) });
  if (nextItem) params.set("serviceId", String(nextItem.serviceId));
  return (
    <div className="flex flex-wrap gap-1.5 md:justify-end">
      <ContactButtons phone={p.customer.phone} />
      {p.status === "active" && p.remaining > 0 && (
        <Link href={`/lich-hen/moi?${params}`} className={buttonClass("ghost", "sm")}>
          <CalendarPlus className="size-4" /> Đặt lịch
        </Link>
      )}
    </div>
  );
}
