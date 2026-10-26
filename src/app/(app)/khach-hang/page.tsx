import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Search, Upload } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchCustomerIds } from "@/lib/search";
import { dateToStr, fmtDate } from "@/lib/dates";
import { fmtPhone } from "@/lib/format";
import { PageHeader, Empty } from "@/components/ui/page";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { CustomerDialogButton } from "./customer-dialog";

export const metadata = { title: "Khách hàng" };

const PAGE_SIZE = 50;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.CustomerWhereInput = q ? { id: { in: await searchCustomerIds(q, 1000) } } : {};
  const [total, customers] = await Promise.all([
    db.customer.count({ where }),
    db.customer.findMany({
      where,
      orderBy: q ? { name: "asc" } : { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        phone: true,
        visits: { orderBy: { visitDate: "desc" }, take: 1, select: { visitDate: true } },
        _count: { select: { packages: { where: { status: "active" } } } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isOwner = user.role === "owner";
  const pageHref = (p: number) => `/khach-hang?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader
        title="Khách hàng"
        topic="cust"
        actions={
          <>
            {isOwner && (
              <>
                <LinkButton href="/khach-hang/nhap" variant="secondary">
                  <Upload className="size-4" /> Nhập từ file
                </LinkButton>
                <a href="/api/customers/export" className={buttonClass("secondary")}>
                  <Download className="size-4" /> Xuất CSV
                </a>
              </>
            )}
            <CustomerDialogButton />
          </>
        }
      >
        <p className="num mt-1 text-sm text-muted">{total} khách</p>
      </PageHeader>

      <form action="/khach-hang" className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Tìm tên hoặc SĐT"
          aria-label="Tìm khách"
          autoComplete="off"
          className="w-full min-h-11 rounded-[var(--radius-field)] border border-line-strong bg-surface pl-9 pr-3 text-base placeholder:text-muted/80 focus:border-cust focus:outline-none focus:ring-2 focus:ring-jade/20"
        />
      </form>

      {customers.length === 0 ? (
        <Empty action={q ? <Link href="/khach-hang" className="font-medium text-jade-deep underline">Xem tất cả khách</Link> : undefined}>
          {q ? `Không có khách nào khớp “${q}”.` : "Chưa có khách nào. Thêm khách đầu tiên hoặc nhập từ file."}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-cust/25 bg-surface">
          <div className="hidden grid-cols-[minmax(0,2fr)_9rem_8rem_8rem] gap-4 bg-cust-wash px-4 py-3 text-xs font-semibold text-cust-ink md:grid">
            <span>Tên</span>
            <span>SĐT</span>
            <span>Lần cuối đến</span>
            <span>Gói đang dùng</span>
          </div>
          <ul className="divide-y divide-line">
            {customers.map((c) => {
              const last = c.visits[0]?.visitDate;
              const pk = c._count.packages;
              return (
                <li key={c.id}>
                  <Link
                    href={`/khach-hang/${c.id}`}
                    className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-2.5 hover:bg-paper md:grid-cols-[minmax(0,2fr)_9rem_8rem_8rem]"
                  >
                    <span className="truncate font-medium">{c.name}</span>
                    <span className="num text-sm text-ink-soft md:order-none">{fmtPhone(c.phone)}</span>
                    <span className="num text-xs text-muted md:text-sm md:text-ink-soft">
                      {last ? <><span className="md:hidden">Lần cuối </span>{fmtDate(dateToStr(last))}</> : <span className="text-muted">Chưa đến</span>}
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      {pk > 0 ? <Tag tone="jade">{pk} gói</Tag> : <span className="hidden text-sm text-muted md:inline">—</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Trang" className="mt-4 flex items-center justify-between gap-3">
          {page > 1 ? (
            <LinkButton href={pageHref(page - 1)} variant="secondary" size="sm">
              <ChevronLeft className="size-4" /> Trước
            </LinkButton>
          ) : (
            <span />
          )}
          <span className="num text-sm text-muted">
            Trang {page}/{pages}
          </span>
          {page < pages ? (
            <LinkButton href={pageHref(page + 1)} variant="secondary" size="sm">
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
