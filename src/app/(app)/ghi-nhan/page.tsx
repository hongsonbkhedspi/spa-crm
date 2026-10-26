import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { instantToDateStr, todayStr } from "@/lib/dates";
import { PenLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { RecordForm, type Catalog, type Prefill } from "./record-form";

export const metadata = { title: "Ghi nhận" };

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; appointmentId?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;

  const [services, products, packages] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.package.findMany({
      where: { active: true },
      include: { items: { orderBy: { id: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const catalog: Catalog = {
    services: services.map((s) => ({ id: s.id, name: s.name, price: s.price, recallDays: s.recallDays })),
    products: products.map((p) => ({ id: p.id, name: p.name, price: p.price, usageDays: p.usageDays })),
    packages: packages.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      validityDays: p.validityDays,
      intervalDays: p.intervalDays,
      items: p.items.map((i) => ({ serviceId: i.serviceId, sessions: i.sessions })),
    })),
  };

  let prefill: Prefill = { customer: null, appointmentId: null, serviceId: null, customerPackageId: null };
  if (sp.appointmentId) {
    const a = await db.appointment.findUnique({
      where: { id: Number(sp.appointmentId) || 0 },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    });
    if (a && a.status === "scheduled") {
      prefill = {
        customer: a.customer,
        appointmentId: a.id,
        serviceId: a.serviceId,
        customerPackageId: a.customerPackageId,
        appointmentLabel: `Lịch hẹn ${instantToDateStr(a.scheduledAt).split("-").reverse().join("/")}`,
      };
    }
  } else if (sp.customerId) {
    const c = await db.customer.findUnique({
      where: { id: Number(sp.customerId) || 0 },
      select: { id: true, name: true, phone: true },
    });
    if (c) prefill.customer = c;
  }

  return (
    <>
      <PageHeader title="Ghi nhận" topic="pkg" icon={PenLine} />
      <RecordForm key={`${prefill.customer?.id ?? 0}-${prefill.appointmentId ?? 0}`} catalog={catalog} prefill={prefill} today={todayStr()} canEditCatalog={me.role === "owner"} />
    </>
  );
}
