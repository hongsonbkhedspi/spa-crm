import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { dueProductsWhere } from "@/lib/products";
import { dateToStr, diffDays, fmtDate, todayStr } from "@/lib/dates";
import { fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, Empty } from "@/components/ui/page";
import { ContactButtons } from "@/components/contact";
import { FollowUpButton } from "./follow-up";

export const metadata = { title: "Mỹ phẩm sắp hết" };

export default async function DueProductsPage() {
  await requireUser();
  const settings = await getSettings();
  const sales = await db.productSale.findMany({
    where: dueProductsWhere(settings.productRemindDays),
    orderBy: [{ runOutDate: "asc" }, { id: "asc" }],
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      product: { select: { id: true, name: true } },
    },
  });
  const today = todayStr();
  const rows = sales.map((s) => ({
    id: s.id,
    customer: s.customer,
    product: s.product,
    quantity: s.quantity,
    saleDate: dateToStr(s.saleDate),
    runOut: dateToStr(s.runOutDate),
    daysLeft: diffDays(dateToStr(s.runOutDate), today),
  }));

  return (
    <>
      <PageHeader title="Mỹ phẩm sắp hết" topic="prod">
        {rows.length > 0 && <p className="num mt-1 text-ink-soft">{rows.length} khách cần hỏi thăm</p>}
      </PageHeader>

      {rows.length === 0 ? (
        <Empty>Không có khách nào sắp hết mỹ phẩm.</Empty>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[var(--radius-panel)] border border-prod/25 bg-surface md:block">
            <table className="w-full text-sm">
              <thead className="bg-prod-wash text-left text-xs font-semibold text-prod-ink">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Khách</th>
                  <th className="px-3 py-2.5 font-medium">Sản phẩm</th>
                  <th className="px-3 py-2.5 font-medium">Ngày mua</th>
                  <th className="px-3 py-2.5 font-medium">Dự kiến hết</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link href={`/khach-hang/${r.customer.id}`} className="font-semibold hover:text-jade-deep">
                        {r.customer.name}
                      </Link>
                      <div className="num text-xs text-muted">{fmtPhone(r.customer.phone)}</div>
                    </td>
                    <td className="px-3 py-3">
                      {r.product.name}
                      {r.quantity > 1 && <span className="num text-muted"> × {r.quantity}</span>}
                    </td>
                    <td className="num px-3 py-3 text-ink-soft">{fmtDate(r.saleDate)}</td>
                    <td className="px-3 py-3">
                      <RunOut date={r.runOut} daysLeft={r.daysLeft} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <ContactButtons phone={r.customer.phone} />
                        <FollowUpButton saleId={r.id} customer={r.customer} productId={r.product.id} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id} className="rounded-[var(--radius-panel)] border border-prod/25 border-l-4 border-l-prod bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/khach-hang/${r.customer.id}`} className="font-semibold">
                      {r.customer.name}
                    </Link>
                    <div className="num text-xs text-muted">{fmtPhone(r.customer.phone)}</div>
                  </div>
                  <RunOut date={r.runOut} daysLeft={r.daysLeft} />
                </div>
                <p className="mt-2 font-medium text-ink-soft">
                  {r.product.name}
                  {r.quantity > 1 && <span className="num text-muted"> × {r.quantity}</span>}
                </p>
                <p className="num text-xs text-muted">Mua {fmtDate(r.saleDate)}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  <ContactButtons phone={r.customer.phone} />
                  <FollowUpButton saleId={r.id} customer={r.customer} productId={r.product.id} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function RunOut({ date, daysLeft }: { date: string; daysLeft: number }) {
  const past = daysLeft < 0;
  return (
    <div className={cn("num text-right md:text-left", past ? "text-lotus" : "text-turmeric")}>
      <div className="font-semibold">{fmtDate(date)}</div>
      <div className="text-xs">
        {past ? `đã hết ${-daysLeft} ngày` : daysLeft === 0 ? "hết hôm nay" : `còn ${daysLeft} ngày`}
      </div>
    </div>
  );
}
