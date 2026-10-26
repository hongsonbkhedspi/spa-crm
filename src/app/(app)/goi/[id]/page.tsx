import Link from "next/link";
import { History, SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { CalendarPlus, ChevronLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { expireOverduePackages, STATUS_LABEL } from "@/lib/packages";
import { dateToStr, fmtDate, fmtInstantDate, instantToDateStr, instantToTimeStr, relativeDay, todayStr } from "@/lib/dates";
import { fmtMoney, fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, Panel, Empty } from "@/components/ui/page";
import { SessionProgress } from "@/components/ui/beads";
import { Tag } from "@/components/ui/tag";
import { buttonClass } from "@/components/ui/button";
import { ContactButtons } from "@/components/contact";
import { AdjustSessions, ExtendExpiry, CancelPackage } from "./adjust";

export const metadata = { title: "Chi tiết gói" };

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  await expireOverduePackages();

  const cp = await db.customerPackage.findUnique({
    where: { id },
    include: {
      customer: true,
      package: true,
      creator: { select: { fullName: true } },
      items: {
        orderBy: { id: "asc" },
        include: {
          service: { select: { name: true } },
          visitItems: {
            include: { visit: { select: { id: true, visitDate: true, createdAt: true } } },
          },
        },
      },
      appointments: {
        where: { status: "scheduled", scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        include: { service: { select: { name: true } } },
      },
    },
  });
  if (!cp) notFound();

  const owner = user.role === "owner";
  const used = cp.items.reduce((s, i) => s + i.usedSessions, 0);
  const total = cp.items.reduce((s, i) => s + i.totalSessions, 0);
  const expiry = cp.expiryDate ? dateToStr(cp.expiryDate) : null;
  const expired = !!expiry && expiry < todayStr();

  const usage = cp.items
    .flatMap((i) =>
      i.visitItems.map((v) => ({
        id: v.id,
        date: dateToStr(v.visit.visitDate),
        createdAt: v.visit.createdAt,
        service: i.service.name,
        sessionNo: v.sessionNo,
        total: i.totalSessions,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.getTime() - a.createdAt.getTime());

  const history = (cp.note ?? "").split("\n").filter(Boolean).reverse();
  const firstOpen = cp.items.find((i) => i.usedSessions < i.totalSessions);
  const apptParams = new URLSearchParams({ customerId: String(cp.customerId), customerPackageId: String(cp.id) });
  if (firstOpen) apptParams.set("serviceId", String(firstOpen.serviceId));
  const editable = owner && cp.status !== "cancelled";

  return (
    <>
      <Link href="/goi" className="mb-2 inline-flex min-h-11 items-center gap-1 text-sm text-ink-soft hover:text-jade-deep md:min-h-8">
        <ChevronLeft className="size-4" /> Gói liệu trình
      </Link>
      <PageHeader
        title={cp.package.name}
        topic="pkg"
        actions={
          <>
            <ContactButtons phone={cp.customer.phone} />
            {cp.status === "active" && firstOpen && (
              <Link href={`/lich-hen/moi?${apptParams}`} className={buttonClass("primary", "sm")}>
                <CalendarPlus className="size-4" /> Đặt lịch
              </Link>
            )}
          </>
        }
      >
        <p className="mt-1 text-ink-soft">
          <Link href={`/khach-hang/${cp.customer.id}`} className="font-semibold text-ink hover:text-jade-deep">
            {cp.customer.name}
          </Link>
          <span className="num ml-2">{fmtPhone(cp.customer.phone)}</span>
        </p>
      </PageHeader>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">
          <Panel
            topic="pkg"
            title="Buổi liệu trình"
            aside={<span className="num text-sm font-semibold text-ink-soft">{used}/{total}</span>}
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-line">
              {cp.items.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-medium">{i.service.name}</div>
                    <div className="mt-1.5">
                      <SessionProgress used={i.usedSessions} total={i.totalSessions} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num text-sm text-ink-soft">còn {i.totalSessions - i.usedSessions}</span>
                    {editable && (
                      <AdjustSessions
                        itemId={i.id}
                        serviceName={i.service.name}
                        used={i.usedSessions}
                        total={i.totalSessions}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel topic="pkg" icon={History} title="Lịch sử dùng" count={usage.length} bodyClassName={usage.length ? "p-0" : undefined}>
            {usage.length === 0 ? (
              <Empty>Chưa dùng buổi nào.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {usage.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="num w-24 shrink-0 text-ink-soft">{fmtDate(u.date)}</span>
                    <span className="flex-1 truncate font-medium">{u.service}</span>
                    {u.sessionNo && (
                      <span className="num text-xs text-muted">
                        buổi {u.sessionNo}/{u.total}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {history.length > 0 && (
            <Panel topic="warn" icon={SlidersHorizontal} title="Điều chỉnh" count={history.length} bodyClassName="p-0">
              <ul className="divide-y divide-line">
                {history.map((line, k) => (
                  <li key={k} className="px-4 py-2.5 text-sm text-ink-soft">
                    {line}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Panel>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
              <dt className="text-muted">Trạng thái</dt>
              <dd>
                <Tag tone={cp.status === "active" ? "jade" : cp.status === "completed" ? "neutral" : "lotus"}>
                  {STATUS_LABEL[cp.status]}
                </Tag>
              </dd>
              <dt className="text-muted">Ngày mua</dt>
              <dd className="num">{fmtDate(dateToStr(cp.purchaseDate))}</dd>
              <dt className="text-muted">Đã trả</dt>
              <dd className="num font-medium">{fmtMoney(cp.paidAmount)}</dd>
              <dt className="text-muted">Hạn dùng</dt>
              <dd className={cn("num", expired && cp.status !== "completed" && "font-semibold text-lotus")}>
                {expiry ? fmtDate(expiry) : "Không hạn"}
              </dd>
              {cp.creator && (
                <>
                  <dt className="text-muted">Người bán</dt>
                  <dd>{cp.creator.fullName}</dd>
                </>
              )}
            </dl>
            {editable && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <ExtendExpiry cpId={cp.id} current={expiry} />
                <CancelPackage cpId={cp.id} />
              </div>
            )}
          </Panel>

          <Panel topic="appt" title="Lịch hẹn sắp tới" count={cp.appointments.length} bodyClassName={cp.appointments.length ? "p-0" : undefined}>
            {cp.appointments.length === 0 ? (
              <Empty>Chưa có lịch hẹn.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {cp.appointments.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-sm">
                    <div className="num font-semibold">
                      {relativeDay(instantToDateStr(a.scheduledAt))} · {instantToTimeStr(a.scheduledAt)}
                    </div>
                    <div className="text-xs text-muted">
                      {fmtInstantDate(a.scheduledAt)}
                      {a.service ? ` · ${a.service.name}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
