"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner, requireUser } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { appendNote, refreshPackageStatus } from "@/lib/packages";
import { dateToStr, fmtDate, isDateStr, strToDate } from "@/lib/dates";

export type PackageTemplate = {
  id: number;
  name: string;
  price: number;
  validityDays: number | null;
  intervalDays: number | null;
  items: { serviceId: number; serviceName: string; sessions: number }[];
};

/** Active package templates with their services, for the sell dialog. */
export async function getPackageTemplates(): Promise<PackageTemplate[]> {
  await requireUser();
  const rows = await db.package.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { items: { include: { service: { select: { name: true } } }, orderBy: { id: "asc" } } },
  });
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    validityDays: p.validityDays,
    intervalDays: p.intervalDays,
    items: p.items.map((i) => ({ serviceId: i.serviceId, serviceName: i.service.name, sessions: i.sessions })),
  }));
}

export type SellPackageInput = {
  customerId: number;
  packageId: number;
  paidAmount: number;
  purchaseDate: string;
  expiryDate: string | null;
  items: { serviceId: number; sessions: number }[];
  note?: string;
};

export async function sellPackage(input: SellPackageInput): Promise<ActionResult<{ id: number; name: string }>> {
  return run(async () => {
    const user = await requireUser();
    if (!input.customerId) throw new UserError("Chọn khách");
    if (!input.packageId) throw new UserError("Chọn gói");
    if (!isDateStr(input.purchaseDate)) throw new UserError("Ngày mua không hợp lệ");
    if (input.expiryDate && !isDateStr(input.expiryDate)) throw new UserError("Hạn dùng không hợp lệ");
    if (input.expiryDate && input.expiryDate < input.purchaseDate) throw new UserError("Hạn dùng phải sau ngày mua");
    if (!Number.isFinite(input.paidAmount) || input.paidAmount < 0) throw new UserError("Giá không hợp lệ");
    const items = input.items.filter((i) => i.sessions > 0);
    if (items.length === 0) throw new UserError("Gói phải có ít nhất 1 buổi");
    if (items.some((i) => !Number.isInteger(i.sessions) || i.sessions > 999)) throw new UserError("Số buổi không hợp lệ");

    const pkg = await db.package.findUnique({ where: { id: input.packageId } });
    if (!pkg) throw new UserError("Không tìm thấy gói");

    const cp = await db.$transaction(async (tx) =>
      tx.customerPackage.create({
        data: {
          customerId: input.customerId,
          packageId: input.packageId,
          purchaseDate: strToDate(input.purchaseDate),
          paidAmount: Math.round(input.paidAmount),
          expiryDate: input.expiryDate ? strToDate(input.expiryDate) : null,
          note: input.note?.trim().normalize("NFC") || null,
          createdBy: user.id,
          items: { create: items.map((i) => ({ serviceId: i.serviceId, totalSessions: i.sessions })) },
        },
      }),
    );
    revalidatePath("/", "layout");
    return { ok: true, data: { id: cp.id, name: pkg.name } };
  });
}

function reasonOf(reason: string) {
  const r = reason.trim().normalize("NFC");
  if (!r) throw new UserError("Nhập lý do điều chỉnh");
  return r.slice(0, 200);
}

/** Owner: add or remove sessions on one service of a customer package. */
export async function adjustPackageSessions(itemId: number, delta: number, reason: string): Promise<ActionResult> {
  return run(async () => {
    const user = await requireOwner();
    const why = reasonOf(reason);
    if (!Number.isInteger(delta) || delta === 0) throw new UserError("Số buổi điều chỉnh không hợp lệ");
    await db.$transaction(async (tx) => {
      const item = await tx.customerPackageItem.findUnique({
        where: { id: itemId },
        include: { service: true, customerPackage: true },
      });
      if (!item) throw new UserError("Không tìm thấy dịch vụ trong gói");
      if (item.customerPackage.status === "cancelled") throw new UserError("Gói đã huỷ");
      const total = item.totalSessions + delta;
      if (total < item.usedSessions) throw new UserError(`Không thể ít hơn số buổi đã dùng (${item.usedSessions})`);
      if (total < 1) throw new UserError("Phải còn ít nhất 1 buổi");
      await tx.customerPackageItem.update({ where: { id: itemId }, data: { totalSessions: total } });
      const line = `${delta > 0 ? "Cộng" : "Trừ"} ${Math.abs(delta)} buổi ${item.service.name} (${item.totalSessions} → ${total}). Lý do: ${why}`;
      await tx.customerPackage.update({
        where: { id: item.customerPackageId },
        data: { note: appendNote(item.customerPackage.note, line, user.fullName) },
      });
      await refreshPackageStatus(tx, item.customerPackageId);
    });
    revalidatePath("/", "layout");
  });
}

/** Owner: change expiry date (extend). Empty = no limit. */
export async function setPackageExpiry(cpId: number, expiry: string | null, reason: string): Promise<ActionResult> {
  return run(async () => {
    const user = await requireOwner();
    const why = reasonOf(reason);
    if (expiry && !isDateStr(expiry)) throw new UserError("Ngày không hợp lệ");
    await db.$transaction(async (tx) => {
      const cp = await tx.customerPackage.findUnique({ where: { id: cpId } });
      if (!cp) throw new UserError("Không tìm thấy gói");
      if (cp.status === "cancelled") throw new UserError("Gói đã huỷ");
      const before = cp.expiryDate ? fmtDate(dateToStr(cp.expiryDate)) : "không hạn";
      const after = expiry ? fmtDate(expiry) : "không hạn";
      // Re-opening an expired package: let refreshPackageStatus recompute from scratch.
      await tx.customerPackage.update({
        where: { id: cpId },
        data: {
          expiryDate: expiry ? strToDate(expiry) : null,
          status: cp.status === "expired" ? "active" : cp.status,
          note: appendNote(cp.note, `Đổi hạn dùng ${before} → ${after}. Lý do: ${why}`, user.fullName),
        },
      });
      await refreshPackageStatus(tx, cpId);
    });
    revalidatePath("/", "layout");
  });
}

/** Owner: cancel a package. Future appointments tied to it are cancelled too. */
export async function cancelPackage(cpId: number, reason: string): Promise<ActionResult> {
  return run(async () => {
    const user = await requireOwner();
    const why = reasonOf(reason);
    await db.$transaction(async (tx) => {
      const cp = await tx.customerPackage.findUnique({ where: { id: cpId } });
      if (!cp) throw new UserError("Không tìm thấy gói");
      if (cp.status === "cancelled") throw new UserError("Gói đã huỷ trước đó");
      await tx.customerPackage.update({
        where: { id: cpId },
        data: { status: "cancelled", note: appendNote(cp.note, `Huỷ gói. Lý do: ${why}`, user.fullName) },
      });
      await tx.appointment.updateMany({
        where: { customerPackageId: cpId, status: "scheduled", scheduledAt: { gte: new Date() } },
        data: { status: "cancelled" },
      });
    });
    revalidatePath("/", "layout");
  });
}
