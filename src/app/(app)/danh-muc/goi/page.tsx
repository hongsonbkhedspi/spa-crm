import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireOwnerPage } from "@/lib/auth";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Empty, PageHeader } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { PackageRowActions } from "./row-actions";

export const metadata = { title: "Gói liệu trình mẫu" };

export default async function PackagesCatalogPage() {
  await requireOwnerPage();
  const rows = await db.package.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      items: { include: { service: { select: { name: true } } }, orderBy: { id: "asc" } },
      _count: { select: { customerPackages: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Gói liệu trình"
        actions={
          <LinkButton href="/danh-muc/goi/moi">
            <Plus className="size-4" /> Thêm gói
          </LinkButton>
        }
      />
      {rows.length === 0 ? (
        <Empty action={<LinkButton href="/danh-muc/goi/moi" variant="secondary">Thêm gói đầu tiên</LinkButton>}>
          Chưa có gói liệu trình nào.
        </Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((p) => {
            const sessions = p.items.reduce((s, i) => s + i.sessions, 0);
            return (
              <li
                key={p.id}
                className={cn(
                  "flex flex-col gap-3 rounded-[var(--radius-panel)] border border-line bg-surface p-4",
                  !p.active && "bg-paper/60",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/danh-muc/goi/${p.id}`} className={cn("text-base font-semibold hover:text-jade-deep", !p.active && "text-muted")}>
                      {p.name}
                    </Link>
                    {!p.active && <Tag className="ml-2">Ngừng bán</Tag>}
                  </div>
                  <span className="num shrink-0 font-semibold">{fmtMoney(p.price)}</span>
                </div>
                <ul className="flex flex-col gap-1 text-sm">
                  {p.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3">
                      <span className="text-ink-soft">{i.service.name}</span>
                      <span className="num font-medium">{i.sessions} buổi</span>
                    </li>
                  ))}
                </ul>
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                  <div>
                    <dt className="inline">Tổng </dt>
                    <dd className="num inline font-medium text-ink-soft">{sessions} buổi</dd>
                  </div>
                  <div>
                    <dt className="inline">Hạn dùng </dt>
                    <dd className="num inline font-medium text-ink-soft">{p.validityDays ? `${p.validityDays} ngày` : "không hạn"}</dd>
                  </div>
                  {p.intervalDays && (
                    <div>
                      <dt className="inline">Cách </dt>
                      <dd className="num inline font-medium text-ink-soft">{p.intervalDays} ngày/buổi</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline">Đã bán </dt>
                    <dd className="num inline font-medium text-ink-soft">{p._count.customerPackages}</dd>
                  </div>
                </dl>
                <PackageRowActions id={p.id} active={p.active} />
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
