import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, CalendarPlus, History, PenLine } from "lucide-react";
import type { FollowUpStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { loadPackageOverview, STATUS_LABEL, FLAG_LABEL, type PackageOverview } from "@/lib/packages";
import { dateToStr, fmtDate, instantToDateStr, instantToTimeStr, relativeDay, todayStr } from "@/lib/dates";
import { fmtMoney, fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader, Panel, Empty } from "@/components/ui/page";
import { SummaryRow, SummaryTile } from "@/components/ui/summary-tile";
import { LinkButton } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { SessionProgress } from "@/components/ui/beads";
import { ContactButtons } from "@/components/contact";
import { SellPackageButton } from "@/components/sell-package-button";
import { ProductSaleButton } from "@/components/product-sale-button";
import { CustomerDialogButton } from "../customer-dialog";
import { DeleteCustomerButton } from "./delete-customer";

const FOLLOW_UP: Record<FollowUpStatus, { label: string; tone: "neutral" | "jade" | "turmeric" }> = {
  pending: { label: "Chưa hỏi", tone: "neutral" },
  contacted: { label: "Đã hỏi · chưa mua", tone: "turmeric" },
  repurchased: { label: "Đã mua thêm", tone: "jade" },
  not_interested: { label: "Không quan tâm", tone: "neutral" },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id: Number(id) || 0 }, select: { name: true } });
  return { title: c?.name ?? "Khách hàng" };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  const settings = await getSettings();
  const [packages, appointments, visits, sales] = await Promise.all([
    loadPackageOverview({
      expiryDays: settings.packageExpiryDays,
      statuses: ["active", "completed", "expired", "cancelled"],
      customerId: id,
    }),
    db.appointment.findMany({
      where: { customerId: id, status: "scheduled", scheduledAt: { gte: new Date(Date.now() - 12 * 3600 * 1000) } },
      orderBy: { scheduledAt: "asc" },
      include: {
        service: { select: { name: true } },
        customerPackage: { select: { items: { select: { serviceId: true, usedSessions: true, totalSessions: true } } } },
      },
    }),
    db.visit.findMany({
      where: { customerId: id },
      orderBy: [{ visitDate: "desc" }, { id: "desc" }],
      take: 50,
      include: {
        items: {
          orderBy: { id: "asc" },
          include: {
            service: { select: { name: true } },
            customerPackageItem: { select: { totalSessions: true } },
          },
        },
        productSales: { include: { product: { select: { name: true } } } },
        packagesSold: { include: { package: { select: { name: true } } } },
      },
    }),
    db.productSale.findMany({
      where: { customerId: id },
      orderBy: [{ saleDate: "desc" }, { id: "desc" }],
      take: 50,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const today = todayStr();
  const groups: { title: string; items: PackageOverview[] }[] = [
    { title: "Đang dùng", items: packages.filter((p) => p.status === "active") },
    { title: "Đã xong", items: packages.filter((p) => p.status === "completed") },
    { title: "Hết hạn / đã huỷ", items: packages.filter((p) => p.status === "expired" || p.status === "cancelled") },
  ].filter((g) => g.items.length > 0);

  const lite = { id: customer.id, name: customer.name, phone: customer.phone };

  // At-a-glance values, all derived from the data loaded above.
  const active = packages.filter((p) => p.status === "active");
  const sessionsLeft = active.reduce((s, p) => s + p.remaining, 0);
  const nextAppt = appointments.find((a) => instantToDateStr(a.scheduledAt) >= today);
  const lastVisit = visits[0] ? dateToStr(visits[0].visitDate) : null;
  const lastSale = sales[0] ?? null;
  const needsReminder = sales.filter((s) => s.followUpStatus === "pending").length;

  return (
    <>
      <PageHeader
        title={customer.name}
        topic="cust"
        actions={
          <>
            <CustomerDialogButton
              customer={{
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                birthday: customer.birthday ? dateToStr(customer.birthday) : null,
                note: customer.note,
              }}
            />
            {user.role === "owner" && <DeleteCustomerButton id={customer.id} name={customer.name} />}
          </>
        }
      >
        <p className="num mt-1 text-ink-soft">
          {fmtPhone(customer.phone)}
          {customer.birthday && <span className="text-muted"> · Sinh nhật {fmtDate(dateToStr(customer.birthday)).slice(0, 5)}</span>}
        </p>
        {customer.note && <p className="mt-2 max-w-prose whitespace-pre-line text-sm text-ink-soft">{customer.note}</p>}
      </PageHeader>

      <div className="mb-5 flex flex-wrap gap-2">
        <LinkButton href={`/ghi-nhan?customerId=${customer.id}`}>
          <PenLine className="size-4" /> Ghi nhận
        </LinkButton>
        <LinkButton href={`/lich-hen/moi?customerId=${customer.id}`} variant="secondary">
          <CalendarPlus className="size-4" /> Đặt lịch
        </LinkButton>
        <SellPackageButton customer={lite} variant="secondary" />
        <ProductSaleButton customer={lite} />
        <ContactButtons phone={customer.phone} />
      </div>

      <div className="mb-5">
        <SummaryRow label="Tóm tắt khách">
          <SummaryTile
            topic="cust"
            icon={History}
            href="#lich-su"
            label="Lần cuối đến"
            value={lastVisit ? relativeDay(lastVisit, today) : "Chưa đến"}
            note={lastVisit ? fmtDate(lastVisit) : "Chưa có lượt ghi nhận"}
            small
          />
          <SummaryTile
            topic="pkg"
            href="#goi"
            label="Gói đang dùng"
            value={active.length}
            note={active.length ? `Còn ${sessionsLeft} buổi` : "Chưa có gói"}
          />
          <SummaryTile
            topic="appt"
            href="#lich-hen"
            label="Lịch hẹn tới"
            value={nextAppt ? `${instantToTimeStr(nextAppt.scheduledAt)} ${relativeDay(instantToDateStr(nextAppt.scheduledAt), today)}` : "Chưa có"}
            note={nextAppt ? (nextAppt.service?.name ?? "Chưa chọn dịch vụ") : "Nên đặt lịch cho khách"}
            small
          />
          <SummaryTile
            topic="prod"
            href="#my-pham"
            label="Mỹ phẩm"
            value={lastSale ? lastSale.product.name : "Chưa mua"}
            note={lastSale ? `Dự kiến hết ${fmtDate(dateToStr(lastSale.runOutDate))}${needsReminder > 1 ? ` · ${needsReminder} món cần hỏi` : ""}` : undefined}
            small
          />
        </SummaryRow>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel id="goi" topic="pkg" title="Gói liệu trình" count={packages.length} bodyClassName="p-0">
            {groups.length === 0 ? (
              <div className="px-4">
                <Empty>Khách chưa mua gói nào.</Empty>
              </div>
            ) : (
              groups.map((g) => (
                <div key={g.title}>
                  <p className="border-b border-line bg-jade-wash/40 px-4 py-1.5 text-xs font-semibold text-jade-deep">{g.title}</p>
                  <ul className="divide-y divide-line">
                    {g.items.map((p) => (
                      <li key={p.id}>
                        <Link href={`/goi/${p.id}`} className="block px-4 py-3 hover:bg-jade-wash/30">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className={cn("font-semibold", p.status !== "active" && "text-ink-soft")}>{p.packageName}</span>
                            <span className="flex flex-wrap gap-1">
                              {p.status !== "active" && <Tag tone={p.status === "completed" ? "jade" : "neutral"}>{STATUS_LABEL[p.status]}</Tag>}
                              {p.flags.map((f) => (
                                <Tag key={f} tone={f === "expiringSoon" ? "lotus" : "turmeric"}>
                                  {FLAG_LABEL[f]}
                                </Tag>
                              ))}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-col gap-1.5">
                            {p.items.map((i) => (
                              <div key={i.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 text-sm">
                                <span className="truncate text-ink-soft">{i.serviceName}</span>
                                <SessionProgress used={i.used} total={i.total} size="sm" />
                              </div>
                            ))}
                          </div>
                          <p className="num mt-2 text-xs text-muted">
                            Mua {fmtDate(p.purchaseDate)}
                            {p.expiryDate && (
                              <span className={cn(p.status === "active" && p.expiryDate < today && "text-lotus")}> · HSD {fmtDate(p.expiryDate)}</span>
                            )}
                            {p.nextAppointment && <> · Lịch tới {relativeDay(p.nextAppointment.date, today)}</>}
                          </p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </Panel>

          <Panel id="lich-su" topic="money" icon={BookOpen} title="Lịch sử dịch vụ" count={visits.length} bodyClassName="p-0">
            {visits.length === 0 ? (
              <div className="px-4">
                <Empty>Chưa có lượt ghi nhận nào.</Empty>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {visits.map((v) => {
                  const total =
                    v.items.reduce((s, i) => s + i.price, 0) +
                    v.productSales.reduce((s, ps) => s + ps.price, 0) +
                    v.packagesSold.reduce((s, cp) => s + cp.paidAmount, 0);
                  return (
                    <li key={v.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-x-3 px-4 py-3 text-sm">
                      <span className="num font-medium text-money-ink">{fmtDate(dateToStr(v.visitDate))}</span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {v.items.map((i) => (
                          <span key={i.id}>
                            {i.service.name}
                            {i.customerPackageItemId && (
                              <span className="num text-jade-deep">
                                {" "}
                                · buổi {i.sessionNo ?? "?"}
                                {i.customerPackageItem ? `/${i.customerPackageItem.totalSessions}` : ""}
                              </span>
                            )}
                          </span>
                        ))}
                        {v.productSales.map((ps) => (
                          <span key={`p${ps.id}`} className="text-prod-ink">
                            {ps.product.name} × {ps.quantity}
                          </span>
                        ))}
                        {v.packagesSold.map((cp) => (
                          <span key={`k${cp.id}`} className="text-ink-soft">
                            Mua gói {cp.package.name}
                          </span>
                        ))}
                        {v.note && <span className="text-xs text-muted">{v.note}</span>}
                      </div>
                      <span className="num text-right font-semibold text-money-ink">{fmtMoney(total)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel id="lich-hen" topic="appt" title="Lịch hẹn sắp tới" count={appointments.length} bodyClassName="p-0">
            {appointments.length === 0 ? (
              <div className="px-4">
                <Empty action={<LinkButton href={`/lich-hen/moi?customerId=${customer.id}`} variant="secondary" size="sm">Đặt lịch</LinkButton>}>
                  Chưa có lịch hẹn.
                </Empty>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {appointments.map((a) => {
                  const date = instantToDateStr(a.scheduledAt);
                  const item = a.customerPackage?.items.find((i) => i.serviceId === a.serviceId);
                  return (
                    <li key={a.id}>
                      <Link href={`/lich-hen/${a.id}`} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-4 py-3 text-sm hover:bg-appt-wash/40">
                        <span className="num">
                          <span className="font-semibold text-appt-ink">{instantToTimeStr(a.scheduledAt)}</span>{" "}
                          <span className={cn("text-ink-soft", date < today && "text-lotus")}>{relativeDay(date, today)}</span>
                        </span>
                        <span className="truncate">
                          {a.service?.name ?? "Chưa chọn dịch vụ"}
                          {item && (
                            <span className="num text-jade-deep">
                              {" "}
                              · buổi {Math.min(item.usedSessions + 1, item.totalSessions)}/{item.totalSessions}
                            </span>
                          )}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel id="my-pham" topic="prod" title="Mỹ phẩm đã mua" count={sales.length} bodyClassName="p-0">
            {sales.length === 0 ? (
              <div className="px-4">
                <Empty>Chưa mua mỹ phẩm.</Empty>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {sales.map((s) => {
                  const fu = FOLLOW_UP[s.followUpStatus];
                  return (
                    <li key={s.id} className="px-4 py-3 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">
                          {s.product.name} <span className="num font-normal text-ink-soft">× {s.quantity}</span>
                        </span>
                        <Tag tone={fu.tone}>{fu.label}</Tag>
                      </div>
                      <p className="num mt-1 text-xs text-muted">
                        Mua {fmtDate(dateToStr(s.saleDate))} · Dự kiến hết {fmtDate(dateToStr(s.runOutDate))}
                      </p>
                      {s.followUpNote && <p className="mt-1 text-xs text-ink-soft">{s.followUpNote}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
