import Link from "next/link";
import { BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtDate, instantToTimeStr, isDateStr, relativeDay, strToDate, todayStr } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { buttonClass } from "@/components/ui/button";
import { DateNav } from "./date-nav";
import { DeleteVisit } from "./delete-visit";

export const metadata = { title: "Nhật ký" };

const COLS = "md:grid-cols-[64px_minmax(140px,1fr)_minmax(200px,2fr)_minmax(140px,1.2fr)_120px_44px]";

export default async function LogPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const user = await requireUser();
  const today = todayStr();
  const { date: raw } = await searchParams;
  const date = isDateStr(raw) ? raw : today;

  const visits = await db.visit.findMany({
    where: { visitDate: strToDate(date) },
    orderBy: { createdAt: "asc" },
    include: {
      customer: { select: { id: true, name: true } },
      items: {
        include: {
          service: { select: { name: true } },
          customerPackageItem: { select: { totalSessions: true } },
        },
        orderBy: { id: "asc" },
      },
      productSales: { include: { product: { select: { name: true } } } },
      packagesSold: { include: { package: { select: { name: true } } } },
    },
  });

  const rows = visits.map((v) => ({
    v,
    total:
      v.items.reduce((s, i) => s + i.price, 0) +
      v.productSales.reduce((s, p) => s + p.price, 0) +
      v.packagesSold.reduce((s, p) => s + p.paidAmount, 0),
  }));
  const dayTotal = rows.reduce((s, r) => s + r.total, 0);
  const isOwner = user.role === "owner";

  return (
    <>
      <PageHeader title="Nhật ký" topic="money" icon={BookOpen} actions={<DateNav date={date} today={today} />}>
        <p className="num mt-1 text-ink-soft">
          {relativeDay(date, today)}
          {date !== today && ` · ${fmtDate(date)}`} · {visits.length} lượt · {fmtMoney(dayTotal)}
        </p>
      </PageHeader>

      {rows.length === 0 ? (
        <Empty
          action={
            date === today && (
              <Link href="/ghi-nhan" className={buttonClass("primary")}>
                Ghi nhận lượt khách
              </Link>
            )
          }
        >
          Chưa có lượt khách nào trong ngày này.
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-money/30 bg-surface">
          <div className={`hidden gap-4 bg-money-wash px-4 py-3 text-xs font-semibold text-money-ink md:grid ${COLS}`}>
            <span>Giờ</span>
            <span>Khách</span>
            <span>Dịch vụ</span>
            <span>Mỹ phẩm</span>
            <span className="text-right">Tổng tiền</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {rows.map(({ v, total }) => (
              <li key={v.id} className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-4 py-3 md:items-start md:gap-4 ${COLS}`}>
                <span className="num text-sm text-muted md:pt-0.5">{instantToTimeStr(v.createdAt)}</span>
                <Link
                  href={`/khach-hang/${v.customer.id}`}
                  className="col-start-1 row-start-2 font-semibold hover:text-jade-deep md:col-start-auto md:row-start-auto"
                >
                  {v.customer.name}
                </Link>
                <div className="col-span-2 flex flex-col gap-1 text-sm md:col-span-1">
                  {v.items.map((i) => (
                    <span key={i.id} className="flex flex-wrap items-center gap-1.5">
                      {i.service.name}
                      {i.customerPackageItemId && (
                        <Tag tone="jade">
                          buổi {i.sessionNo ?? "?"}/{i.customerPackageItem?.totalSessions ?? "?"}
                        </Tag>
                      )}
                    </span>
                  ))}
                  {v.packagesSold.map((p) => (
                    <span key={p.id} className="flex items-center gap-1.5">
                      <Tag tone="turmeric">Mua gói</Tag> {p.package.name}
                    </span>
                  ))}
                  {v.note && <span className="text-xs text-muted">{v.note}</span>}
                </div>
                <div className="col-span-2 text-sm text-prod-ink md:col-span-1">
                  {v.productSales.map((p) => (
                    <div key={p.id}>
                      {p.product.name}
                      {p.quantity > 1 && <span className="num"> ×{p.quantity}</span>}
                    </div>
                  ))}
                </div>
                <span className="num col-start-2 row-start-1 text-right font-semibold text-money-ink md:col-start-auto md:row-start-auto">
                  {fmtMoney(total)}
                </span>
                <div className="col-start-2 row-start-2 flex justify-end md:col-start-auto md:row-start-auto md:-mt-1.5">
                  {isOwner && <DeleteVisit id={v.id} label={`${v.customer.name} · ${instantToTimeStr(v.createdAt)}`} />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
