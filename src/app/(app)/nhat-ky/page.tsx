import Link from "next/link";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dateToStr, fmtDate, instantToTimeStr, isDateStr, relativeDay, strToDate, todayStr, weekday } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { searchCatalogIds, searchCustomerIds } from "@/lib/search";
import { PageHeader, Empty } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { DateNav } from "./date-nav";
import { DeleteVisit } from "./delete-visit";
import { LogFilters, type CatalogOption, type LogFilter } from "./filters";
import { logHref } from "./href";

export const metadata = { title: "Nhật ký" };

const PAGE_SIZE = 100;
const COLS = "lg:grid-cols-[120px_minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_110px_44px]";

type Search = { from?: string; to?: string; date?: string; q?: string; cust?: string; it?: string; item?: string; by?: string; page?: string };

export default async function LogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requireUser();
  const today = todayStr();
  const sp = await searchParams;

  // ?date= is the old single-day link; from/to default to today.
  const single = isDateStr(sp.date) ? sp.date : undefined;
  let from = isDateStr(sp.from) ? sp.from : (single ?? today);
  let to = isDateStr(sp.to) ? sp.to : (single ?? (isDateStr(sp.from) ? today : from));
  if (from > to) [from, to] = [to, from];
  const id = (s?: string) => (/^\d+$/.test(s ?? "") ? s! : "");
  const by = id(sp.by);
  const q = (sp.q ?? "").trim();
  const cust = q ? id(sp.cust) : "";
  const item = (sp.item ?? "").trim();
  const it = item && /^[spk]\d+$/.test(sp.it ?? "") ? sp.it! : "";
  const filter: LogFilter = { from, to, q, cust, item, it, by };
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const oneDay = from === to;
  const dirty = !(oneDay && from === today) || !!(filter.q || filter.item || filter.by);

  const and: Prisma.VisitWhereInput[] = [{ visitDate: { gte: strToDate(from), lte: strToDate(to) } }];
  if (filter.by) and.push({ createdBy: Number(filter.by) });
  if (filter.cust) and.push({ customerId: Number(filter.cust) });
  else if (filter.q) and.push({ customerId: { in: await searchCustomerIds(filter.q, 5000) } });
  if (filter.it) {
    const n = Number(filter.it.slice(1));
    const k = filter.it[0];
    and.push(
      k === "s"
        ? { items: { some: { serviceId: n } } }
        : k === "p"
          ? { productSales: { some: { productId: n } } }
          : { packagesSold: { some: { packageId: n } } },
    );
  } else if (filter.item) {
    const ids = await searchCatalogIds(filter.item);
    and.push({
      OR: [
        { items: { some: { serviceId: { in: ids.services } } } },
        { productSales: { some: { productId: { in: ids.products } } } },
        { packagesSold: { some: { packageId: { in: ids.packages } } } },
      ],
    });
  }
  const where: Prisma.VisitWhereInput = { AND: and };

  const named = { select: { id: true, name: true, active: true }, orderBy: [{ active: "desc" as const }, { name: "asc" as const }] };
  const [count, visits, users, svc, prod, pkg, services, products, packages] = await Promise.all([
    db.visit.count({ where }),
    db.visit.findMany({
      where,
      orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { id: true, name: true } },
        creator: { select: { fullName: true } },
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
    }),
    db.user.findMany({ select: { id: true, fullName: true }, orderBy: [{ active: "desc" }, { fullName: "asc" }] }),
    // Totals cover every matching visit, not just this page.
    db.visitItem.aggregate({ where: { visit: where }, _sum: { price: true } }),
    db.productSale.aggregate({ where: { visit: where }, _sum: { price: true } }),
    db.customerPackage.aggregate({ where: { visit: where }, _sum: { paidAmount: true } }),
    db.service.findMany(named),
    db.product.findMany(named),
    db.package.findMany(named),
  ]);
  const catalog: CatalogOption[] = [
    ...services.map((x) => ({ ref: `s${x.id}`, name: x.name, active: x.active })),
    ...products.map((x) => ({ ref: `p${x.id}`, name: x.name, active: x.active })),
    ...packages.map((x) => ({ ref: `k${x.id}`, name: x.name, active: x.active })),
  ];

  const rows = visits.map((v) => ({
    v,
    total:
      v.items.reduce((s, i) => s + i.price, 0) +
      v.productSales.reduce((s, p) => s + p.price, 0) +
      v.packagesSold.reduce((s, p) => s + p.paidAmount, 0),
  }));
  const sum = (svc._sum.price ?? 0) + (prod._sum.price ?? 0) + (pkg._sum.paidAmount ?? 0);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const isOwner = user.role === "owner";

  return (
    <>
      <PageHeader
        title="Nhật ký"
        topic="money"
        icon={BookOpen}
        actions={oneDay ? <DateNav filter={filter} today={today} /> : undefined}
      >
        <p className="num mt-1 text-ink-soft">
          {oneDay ? (
            <>
              {relativeDay(from, today)}
              {from !== today && ` · ${fmtDate(from)}`}
            </>
          ) : (
            `${fmtDate(from)} – ${fmtDate(to)}`
          )}{" "}
          · {count} lượt · {fmtMoney(sum)}
        </p>
      </PageHeader>

      <LogFilters filter={filter} today={today} users={users} catalog={catalog} dirty={dirty} />

      {rows.length === 0 ? (
        <Empty
          action={
            dirty ? (
              <Link href="/nhat-ky" className="font-medium text-jade-deep underline">
                Xoá lọc
              </Link>
            ) : (
              <Link href="/ghi-nhan" className={buttonClass("primary")}>
                Ghi nhận lượt khách
              </Link>
            )
          }
        >
          {dirty ? "Không có lượt khách nào khớp điều kiện lọc." : "Chưa có lượt khách nào hôm nay."}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-money/30 bg-surface">
          <div className={`hidden gap-4 bg-money-wash px-4 py-3 text-xs font-semibold text-money-ink lg:grid ${COLS}`}>
            <span>{oneDay ? "Giờ" : "Ngày"}</span>
            <span>Khách</span>
            <span>Dịch vụ</span>
            <span>Mỹ phẩm</span>
            <span>Ghi chú</span>
            <span>Người nhập</span>
            <span className="text-right">Tổng tiền</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {rows.map(({ v, total }) => {
              const time = instantToTimeStr(v.createdAt);
              const ds = dateToStr(v.visitDate);
              const day = `${weekday(ds)} ${fmtDate(ds)}`;
              return (
                <li key={v.id} className={`grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 px-4 py-3 lg:items-start lg:gap-4 ${COLS}`}>
                  <span className="text-sm text-muted lg:flex lg:flex-col lg:pt-0.5">
                    {!oneDay && <span className="num whitespace-nowrap lg:text-ink-soft">{day} </span>}
                    <span className="num">{time}</span>
                    {v.creator && <span className="lg:hidden"> · {v.creator.fullName}</span>}
                  </span>
                  <Link
                    href={`/khach-hang/${v.customer.id}`}
                    className="col-start-1 row-start-2 font-semibold hover:text-jade-deep lg:col-start-auto lg:row-start-auto"
                  >
                    {v.customer.name}
                  </Link>
                  <div className="col-span-2 flex flex-col gap-1 text-sm lg:col-span-1">
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
                  </div>
                  <div className="col-span-2 text-sm text-prod-ink lg:col-span-1">
                    {v.productSales.map((p) => (
                      <div key={p.id}>
                        {p.product.name}
                        {p.quantity > 1 && <span className="num"> ×{p.quantity}</span>}
                      </div>
                    ))}
                  </div>
                  <div className={cn("col-span-2 whitespace-pre-line break-words text-sm text-ink-soft lg:col-span-1", !v.note && "hidden lg:block")}>
                    {v.note ? (
                      <>
                        <span className="text-muted lg:hidden">Ghi chú: </span>
                        {v.note}
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                  <span className="hidden text-sm text-ink-soft lg:block">{v.creator?.fullName ?? "—"}</span>
                  <span className="num col-start-2 row-start-1 text-right font-semibold text-money-ink lg:col-start-auto lg:row-start-auto">
                    {fmtMoney(total)}
                  </span>
                  <div className="col-start-2 row-start-2 flex justify-end lg:col-start-auto lg:row-start-auto lg:-mt-1.5">
                    {isOwner && <DeleteVisit id={v.id} label={`${v.customer.name} · ${day} ${time}`} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Trang" className="mt-4 flex items-center justify-between gap-3">
          {page > 1 ? (
            <LinkButton href={logHref(filter, page - 1)} variant="secondary" size="sm">
              <ChevronLeft className="size-4" /> Trước
            </LinkButton>
          ) : (
            <span />
          )}
          <span className="num text-sm text-muted">
            Trang {page}/{pages}
          </span>
          {page < pages ? (
            <LinkButton href={logHref(filter, page + 1)} variant="secondary" size="sm">
              Sau <ChevronRight className="size-4" />
            </LinkButton>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
