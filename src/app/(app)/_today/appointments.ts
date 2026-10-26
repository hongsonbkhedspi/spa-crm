import "server-only";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { instantToDateStr, instantToTimeStr } from "@/lib/dates";

/** Plain, serializable appointment row used by Hôm nay and Lịch hẹn. */
export type ApptRow = {
  id: number;
  date: string;
  time: string;
  status: AppointmentStatus;
  note: string | null;
  customer: { id: number; name: string; phone: string | null };
  serviceName: string | null;
  packageName: string | null;
  /** "buổi 6/10" when the appointment is tied to a package with that service. */
  session: { no: number; total: number } | null;
};

export async function loadAppointments(where: Prisma.AppointmentWhereInput, opts?: { order?: "asc" | "desc"; take?: number }) {
  const rows = await db.appointment.findMany({
    where,
    orderBy: { scheduledAt: opts?.order ?? "asc" },
    take: opts?.take,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      service: { select: { name: true } },
      customerPackage: {
        select: {
          package: { select: { name: true } },
          items: { select: { serviceId: true, usedSessions: true, totalSessions: true } },
        },
      },
    },
  });
  return rows.map((a): ApptRow => {
    const item = a.customerPackage?.items.find((i) => i.serviceId === a.serviceId);
    return {
      id: a.id,
      date: instantToDateStr(a.scheduledAt),
      time: instantToTimeStr(a.scheduledAt),
      status: a.status,
      note: a.note,
      customer: a.customer,
      serviceName: a.service?.name ?? null,
      packageName: a.customerPackage?.package.name ?? null,
      session: item
        ? { no: Math.min(item.usedSessions + 1, item.totalSessions), total: item.totalSessions }
        : null,
    };
  });
}

export const APPT_STATUS: Record<AppointmentStatus, { label: string; tone: "jade" | "turmeric" | "lotus" | "neutral" }> = {
  scheduled: { label: "Đã hẹn", tone: "turmeric" },
  done: { label: "Đã đến", tone: "jade" },
  cancelled: { label: "Đã huỷ", tone: "neutral" },
  no_show: { label: "Không đến", tone: "lotus" },
};
