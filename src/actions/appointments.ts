"use server";
import { revalidatePath } from "next/cache";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { dateToStr, isDateStr, isTimeStr, toInstant } from "@/lib/dates";

const STATUSES: AppointmentStatus[] = ["scheduled", "done", "cancelled", "no_show"];

export async function setAppointmentStatus(id: number, status: AppointmentStatus): Promise<ActionResult> {
  return run(async () => {
    await requireUser();
    if (!STATUSES.includes(status)) throw new UserError("Trạng thái không hợp lệ");
    await db.appointment.update({ where: { id }, data: { status } });
    revalidatePath("/", "layout");
  });
}

export type CustomerPackageOption = {
  id: number;
  name: string;
  expiryDate: string | null;
  items: { serviceId: number; used: number; total: number }[];
};

/** Active packages of a customer, earliest expiry first (for auto-linking an appointment). */
export async function getActivePackages(customerId: number): Promise<CustomerPackageOption[]> {
  await requireUser();
  const rows = await db.customerPackage.findMany({
    where: { customerId, status: "active" },
    include: { package: { select: { name: true } }, items: true },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  });
  return rows.map((cp) => ({
    id: cp.id,
    name: cp.package.name,
    expiryDate: cp.expiryDate ? dateToStr(cp.expiryDate) : null,
    items: cp.items.map((i) => ({ serviceId: i.serviceId, used: i.usedSessions, total: i.totalSessions })),
  }));
}

export type AppointmentInput = {
  id?: number;
  customerId: number;
  serviceId: number | null;
  customerPackageId: number | null;
  date: string;
  time: string;
  note: string;
  status?: AppointmentStatus;
};

export async function saveAppointment(input: AppointmentInput): Promise<ActionResult<{ id: number }>> {
  return run(async () => {
    const user = await requireUser();
    if (!input.customerId) throw new UserError("Chọn khách");
    if (!isDateStr(input.date)) throw new UserError("Chọn ngày hẹn");
    if (!isTimeStr(input.time)) throw new UserError("Chọn giờ hẹn");
    if (input.status && !STATUSES.includes(input.status)) throw new UserError("Trạng thái không hợp lệ");

    if (input.customerPackageId) {
      const cp = await db.customerPackage.findUnique({ where: { id: input.customerPackageId } });
      if (!cp || cp.customerId !== input.customerId) throw new UserError("Gói không thuộc khách này");
    }
    const data = {
      customerId: input.customerId,
      serviceId: input.serviceId,
      customerPackageId: input.customerPackageId,
      scheduledAt: toInstant(input.date, input.time),
      note: input.note.trim() || null,
    };
    const appt = input.id
      ? await db.appointment.update({
          where: { id: input.id },
          data: { ...data, ...(input.status ? { status: input.status } : {}) },
        })
      : await db.appointment.create({ data: { ...data, createdBy: user.id } });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: appt.id } };
  });
}
