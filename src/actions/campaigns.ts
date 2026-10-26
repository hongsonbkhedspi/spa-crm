"use server";
import { revalidatePath } from "next/cache";
import type { RecipientStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { getSettings } from "@/lib/settings";
import { isDateStr, strToDate } from "@/lib/dates";
import { renderMessage } from "@/lib/messaging/render";

export type PackageFilter = "any" | "has" | "none" | "nearlyDone";

export type RecipientFilter = {
  serviceId?: number | null;
  lastVisitBefore?: string | null;
  lastVisitAfter?: string | null;
  package?: PackageFilter;
};

/** Customer ids matching the filter (all customers when empty). */
async function matchCustomers(f: RecipientFilter): Promise<{ id: number; name: string }[]> {
  let customers = await db.customer.findMany({ where: { phone: { not: null } }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  if (f.serviceId) {
    const rows = await db.visit.findMany({
      where: { items: { some: { serviceId: f.serviceId } } },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    const ids = new Set(rows.map((r) => r.customerId));
    customers = customers.filter((c) => ids.has(c.id));
  }

  if (isDateStr(f.lastVisitBefore) || isDateStr(f.lastVisitAfter)) {
    const last = await db.visit.groupBy({ by: ["customerId"], _max: { visitDate: true } });
    const map = new Map(last.map((l) => [l.customerId, l._max.visitDate?.getTime() ?? 0]));
    const before = isDateStr(f.lastVisitBefore) ? strToDate(f.lastVisitBefore).getTime() : null;
    const after = isDateStr(f.lastVisitAfter) ? strToDate(f.lastVisitAfter).getTime() : null;
    customers = customers.filter((c) => {
      const t = map.get(c.id);
      if (!t) return false;
      if (before !== null && !(t < before)) return false;
      if (after !== null && !(t >= after)) return false;
      return true;
    });
  }

  if (f.package && f.package !== "any") {
    const active = await db.customerPackage.findMany({
      where: { status: "active" },
      select: { customerId: true, items: { select: { totalSessions: true, usedSessions: true } } },
    });
    const has = new Set<number>();
    const nearly = new Set<number>();
    for (const p of active) {
      const remaining = p.items.reduce((s, i) => s + i.totalSessions - i.usedSessions, 0);
      if (remaining <= 0) continue;
      has.add(p.customerId);
      if (remaining <= 1) nearly.add(p.customerId);
    }
    customers = customers.filter((c) =>
      f.package === "has" ? has.has(c.id) : f.package === "none" ? !has.has(c.id) : nearly.has(c.id),
    );
  }

  return customers;
}

export async function countRecipients(f: RecipientFilter): Promise<ActionResult<number>> {
  return run(async () => {
    await requireUser();
    return { ok: true, data: (await matchCustomers(f)).length };
  });
}

export async function createCampaign(input: {
  title: string;
  content: string;
  filter: RecipientFilter;
}): Promise<ActionResult<{ id: number }>> {
  return run(async () => {
    const user = await requireUser();
    const title = input.title.normalize("NFC").trim();
    const content = input.content.normalize("NFC").trim();
    if (!title) throw new UserError("Nhập tiêu đề");
    if (!content) throw new UserError("Nhập nội dung tin nhắn");
    const customers = await matchCustomers(input.filter);
    if (customers.length === 0) throw new UserError("Không có khách nào khớp bộ lọc");
    const { spaName } = await getSettings();
    const campaign = await db.$transaction(async (tx) => {
      const c = await tx.campaign.create({ data: { title, content, createdBy: user.id } });
      await tx.campaignRecipient.createMany({
        data: customers.map((cu) => ({
          campaignId: c.id,
          customerId: cu.id,
          renderedMessage: renderMessage(content, { name: cu.name, spaName }),
        })),
      });
      return c;
    });
    revalidatePath("/khuyen-mai");
    return { ok: true, data: { id: campaign.id } };
  });
}

export async function markRecipient(id: number, status: RecipientStatus): Promise<ActionResult> {
  return run(async () => {
    await requireUser();
    const r = await db.campaignRecipient.findUnique({ where: { id } });
    if (!r) throw new UserError("Không tìm thấy người nhận");
    // Re-sending a message never downgrades "sent".
    if (r.status === "sent" && status !== "sent") return;
    await db.campaignRecipient.update({
      where: { id },
      data: { status, sentAt: status === "sent" ? (r.sentAt ?? new Date()) : null },
    });
    revalidatePath("/khuyen-mai");
  });
}

export async function deleteCampaign(id: number): Promise<ActionResult> {
  return run(async () => {
    await requireUser();
    await db.campaign.delete({ where: { id } });
    revalidatePath("/khuyen-mai");
  });
}
