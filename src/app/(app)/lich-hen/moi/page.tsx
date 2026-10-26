import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addDays, isDateStr, isTimeStr, todayStr } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page";
import { AppointmentForm } from "../appointment-form";

export const metadata = { title: "Đặt lịch hẹn" };

type SP = { customerId?: string; serviceId?: string; customerPackageId?: string; date?: string; time?: string };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayStr();
  const customerId = Number(sp.customerId) || null;
  const [customer, services] = await Promise.all([
    customerId ? db.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, phone: true } }) : null,
    db.service.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Đặt lịch hẹn" topic="appt" />
      <AppointmentForm
        today={today}
        services={services}
        initial={{
          customer,
          serviceId: Number(sp.serviceId) || null,
          customerPackageId: Number(sp.customerPackageId) || null,
          date: isDateStr(sp.date) && sp.date >= today ? sp.date : addDays(today, 1),
          time: isTimeStr(sp.time) ? sp.time : "09:00",
          note: "",
        }}
      />
    </>
  );
}
