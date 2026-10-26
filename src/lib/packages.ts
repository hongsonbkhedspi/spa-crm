import "server-only";
import { Prisma, type PackageStatus } from "@prisma/client";
import { db } from "./db";
import { addDays, dateToStr, diffDays, instantToDateStr, strToDate, todayStr } from "./dates";
import { UserError } from "./action";

type Tx = Prisma.TransactionClient;

/**
 * Deduct one session from a customer package item. Atomic: the row is only
 * incremented while used < total, so two counters saving at once cannot
 * over-deduct. Returns the session ordinal ("buổi N").
 */
export async function deductSession(tx: Tx, itemId: number, allowExpired: boolean): Promise<number> {
  const item = await tx.customerPackageItem.findUnique({
    where: { id: itemId },
    include: { customerPackage: true, service: true },
  });
  if (!item) throw new UserError("Không tìm thấy gói để trừ buổi");
  const cp = item.customerPackage;
  if (cp.status === "cancelled") throw new UserError("Gói đã huỷ, không trừ buổi được");
  const expired =
    cp.status === "expired" || (cp.expiryDate !== null && dateToStr(cp.expiryDate) < todayStr());
  if (expired && !allowExpired) {
    throw new UserError(`Gói có ${item.service.name} đã hết hạn. Xác nhận để vẫn trừ buổi.`);
  }
  const updated = await tx.$executeRaw`
    UPDATE customer_package_items
       SET used_sessions = used_sessions + 1
     WHERE id = ${itemId} AND used_sessions < total_sessions`;
  if (updated !== 1) {
    throw new UserError(`${item.service.name}: gói đã dùng hết buổi`);
  }
  await refreshPackageStatus(tx, cp.id);
  return item.usedSessions + 1;
}

/** Give a session back (visit deleted or item removed). */
export async function refundSession(tx: Tx, itemId: number) {
  const item = await tx.customerPackageItem.findUnique({ where: { id: itemId } });
  if (!item) return;
  await tx.$executeRaw`
    UPDATE customer_package_items
       SET used_sessions = GREATEST(used_sessions - 1, 0)
     WHERE id = ${itemId}`;
  await refreshPackageStatus(tx, item.customerPackageId);
}

/** Recompute active / completed / expired from the items and expiry date. */
export async function refreshPackageStatus(tx: Tx, cpId: number) {
  const cp = await tx.customerPackage.findUnique({ where: { id: cpId }, include: { items: true } });
  if (!cp || cp.status === "cancelled") return;
  const allUsed = cp.items.length > 0 && cp.items.every((i) => i.usedSessions >= i.totalSessions);
  let status: PackageStatus = "active";
  if (allUsed) status = "completed";
  else if (cp.expiryDate && dateToStr(cp.expiryDate) < todayStr()) status = "expired";
  if (status !== cp.status) {
    await tx.customerPackage.update({ where: { id: cpId }, data: { status } });
  }
}

let lastExpireRun = "";

/** Mark active packages past their expiry date (with sessions left) as expired. Runs at most once per day per process. */
export async function expireOverduePackages(force = false) {
  const today = todayStr();
  if (!force && lastExpireRun === today) return;
  await db.$executeRaw`
    UPDATE customer_packages cp
       SET status = 'expired'
     WHERE cp.status = 'active'
       AND cp.expiry_date IS NOT NULL
       AND cp.expiry_date < ${strToDate(today)}::date
       AND EXISTS (SELECT 1 FROM customer_package_items i
                    WHERE i.customer_package_id = cp.id AND i.used_sessions < i.total_sessions)`;
  lastExpireRun = today;
}

/** Append a dated line to a package's adjustment history. */
export function appendNote(note: string | null, line: string, who: string) {
  const entry = `[${todayStr().split("-").reverse().join("/")} · ${who}] ${line}`;
  return note ? `${note}\n${entry}` : entry;
}

// ---------------------------------------------------------------------------
// Overview used by "Hôm nay", "Gói liệu trình" and nav badges
// ---------------------------------------------------------------------------

export type PackageFlag = "noSchedule" | "expiringSoon" | "nearlyDone";

export type PackageOverview = {
  id: number;
  status: PackageStatus;
  customer: { id: number; name: string; phone: string | null };
  packageName: string;
  purchaseDate: string;
  expiryDate: string | null;
  used: number;
  total: number;
  remaining: number;
  items: { id: number; serviceId: number; serviceName: string; used: number; total: number }[];
  lastUsedDate: string | null;
  nextAppointment: { id: number; date: string; at: Date } | null;
  flags: PackageFlag[];
  /** Has sessions left but hasn't come in for more than 30 days. */
  dormant: boolean;
};

export async function loadPackageOverview(opts: {
  expiryDays: number;
  statuses?: PackageStatus[];
  customerId?: number;
}): Promise<PackageOverview[]> {
  await expireOverduePackages();
  const today = todayStr();
  const now = new Date();
  const rows = await db.customerPackage.findMany({
    where: {
      status: { in: opts.statuses ?? ["active"] },
      ...(opts.customerId ? { customerId: opts.customerId } : {}),
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      package: { select: { name: true } },
      items: {
        include: {
          service: { select: { name: true } },
          visitItems: {
            select: { visit: { select: { visitDate: true } } },
            orderBy: { visit: { visitDate: "desc" } },
            take: 1,
          },
        },
        orderBy: { id: "asc" },
      },
      appointments: {
        where: { status: "scheduled", scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { id: true, scheduledAt: true },
      },
    },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  });

  return rows.map((cp) => {
    const used = cp.items.reduce((s, i) => s + i.usedSessions, 0);
    const total = cp.items.reduce((s, i) => s + i.totalSessions, 0);
    const remaining = total - used;
    const lastUsedDate =
      cp.items
        .map((i) => i.visitItems[0]?.visit.visitDate)
        .filter((d): d is Date => !!d)
        .map(dateToStr)
        .sort()
        .at(-1) ?? null;
    const appt = cp.appointments[0];
    const expiryDate = cp.expiryDate ? dateToStr(cp.expiryDate) : null;
    const isActive = cp.status === "active" && remaining > 0;
    const dormant =
      isActive && diffDays(today, lastUsedDate ?? dateToStr(cp.purchaseDate)) > 30;

    const flags: PackageFlag[] = [];
    if (isActive && (!appt || dormant)) flags.push("noSchedule");
    if (isActive && expiryDate && expiryDate <= addDays(today, opts.expiryDays)) flags.push("expiringSoon");
    if (isActive && remaining <= 1) flags.push("nearlyDone");

    return {
      id: cp.id,
      status: cp.status,
      customer: cp.customer,
      packageName: cp.package.name,
      purchaseDate: dateToStr(cp.purchaseDate),
      expiryDate,
      used,
      total,
      remaining,
      items: cp.items.map((i) => ({
        id: i.id,
        serviceId: i.serviceId,
        serviceName: i.service.name,
        used: i.usedSessions,
        total: i.totalSessions,
      })),
      lastUsedDate,
      nextAppointment: appt
        ? { id: appt.id, date: instantToDateStr(appt.scheduledAt), at: appt.scheduledAt }
        : null,
      flags,
      dormant,
    };
  });
}

export const FLAG_LABEL: Record<PackageFlag, string> = {
  noSchedule: "Chưa có lịch",
  expiringSoon: "Sắp hết hạn",
  nearlyDone: "Sắp xong",
};

export const STATUS_LABEL: Record<PackageStatus, string> = {
  active: "Đang dùng",
  completed: "Đã xong",
  expired: "Hết hạn",
  cancelled: "Đã huỷ",
};
