import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { instantToDateStr, instantToTimeStr, todayStr } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page";
import { AppointmentForm } from "../appointment-form";

export const metadata = { title: "Sửa lịch hẹn" };

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [appt, services] = await Promise.all([
    db.appointment.findUnique({
      where: { id },
      include: { customer: { select: { id: true, name: true, phone: true } } },
    }),
    db.service.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, active: true } }),
  ]);
  if (!appt) notFound();
  return (
    <>
      <PageHeader title="Sửa lịch hẹn" topic="appt" />
      <AppointmentForm
        today={todayStr()}
        services={services.filter((s) => s.active || s.id === appt.serviceId)}
        initial={{
          id: appt.id,
          customer: appt.customer,
          serviceId: appt.serviceId,
          customerPackageId: appt.customerPackageId,
          date: instantToDateStr(appt.scheduledAt),
          time: instantToTimeStr(appt.scheduledAt),
          note: appt.note ?? "",
          status: appt.status,
        }}
      />
    </>
  );
}
