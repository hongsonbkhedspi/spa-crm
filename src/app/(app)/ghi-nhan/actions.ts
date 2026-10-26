"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { dateToStr, isDateStr, isTimeStr, strToDate, toInstant, todayStr } from "@/lib/dates";
import { deductSession, expireOverduePackages } from "@/lib/packages";
import { computeRunOut } from "@/lib/products";

export type CustomerPackageCtx = {
  id: number;
  name: string;
  status: "active" | "expired";
  expiryDate: string | null;
  intervalDays: number | null;
  items: { id: number; serviceId: number; serviceName: string; used: number; total: number }[];
};

/** Packages with sessions left (active, or expired but still holding sessions). */
export async function getCustomerPackages(customerId: number): Promise<CustomerPackageCtx[]> {
  await requireUser();
  await expireOverduePackages();
  const rows = await db.customerPackage.findMany({
    where: { customerId, status: { in: ["active", "expired"] } },
    include: {
      package: { select: { name: true, intervalDays: true } },
      items: { include: { service: { select: { name: true } } }, orderBy: { id: "asc" } },
    },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { id: "asc" }],
  });
  return rows
    .filter((cp) => cp.items.some((i) => i.usedSessions < i.totalSessions))
    .map((cp) => ({
      id: cp.id,
      name: cp.package.name,
      status: cp.status === "expired" ? "expired" : "active",
      expiryDate: cp.expiryDate ? dateToStr(cp.expiryDate) : null,
      intervalDays: cp.package.intervalDays,
      items: cp.items.map((i) => ({
        id: i.id,
        serviceId: i.serviceId,
        serviceName: i.service.name,
        used: i.usedSessions,
        total: i.totalSessions,
      })),
    }));
}

const PkgRef = z.union([
  z.object({ kind: z.literal("existing"), itemId: z.number().int() }),
  z.object({ kind: z.literal("new"), serviceId: z.number().int() }),
]);

const VisitInput = z.object({
  customerId: z.number().int(),
  visitDate: z.string().refine(isDateStr),
  note: z.string().max(1000).optional(),
  appointmentId: z.number().int().nullable().optional(),
  allowExpired: z.boolean().default(false),
  lines: z.array(
    z.object({
      serviceId: z.number().int(),
      price: z.number().int().min(0),
      pkg: PkgRef.nullable(),
    }),
  ),
  products: z.array(
    z.object({
      productId: z.number().int(),
      quantity: z.number().int().min(1).max(99),
      price: z.number().int().min(0),
    }),
  ),
  packageSale: z
    .object({
      packageId: z.number().int(),
      price: z.number().int().min(0),
      expiryDate: z.string().refine(isDateStr).nullable(),
      items: z.array(z.object({ serviceId: z.number().int(), sessions: z.number().int().min(1).max(500) })).min(1),
    })
    .nullable(),
  next: z
    .object({
      date: z.string().refine(isDateStr),
      time: z.string().refine(isTimeStr),
      serviceId: z.number().int().nullable(),
      pkg: z.union([z.object({ kind: z.literal("existing"), id: z.number().int() }), z.object({ kind: z.literal("new") })]).nullable(),
      note: z.string().max(500).optional(),
    })
    .nullable(),
});

export type VisitInput = z.input<typeof VisitInput>;

export async function saveVisit(raw: VisitInput): Promise<ActionResult<{ visitId: number | null }>> {
  return run(async () => {
    const user = await requireUser();
    const input = VisitInput.parse(raw);
    if (!input.lines.length && !input.products.length && !input.packageSale) {
      throw new UserError("Chọn ít nhất một dịch vụ, mỹ phẩm hoặc gói");
    }
    const customer = await db.customer.findUnique({ where: { id: input.customerId } });
    if (!customer) throw new UserError("Không tìm thấy khách");

    const summary: string[] = [];

    const visitId = await db.$transaction(async (tx) => {
      // 1. Visit row (always — the log shows every counter interaction)
      const visit = await tx.visit.create({
        data: {
          customerId: customer.id,
          visitDate: strToDate(input.visitDate),
          note: input.note?.trim() || null,
          createdBy: user.id,
        },
      });

      // 2. Package sold in this visit
      const newItemByService = new Map<number, number>();
      let newPackageId: number | null = null;
      if (input.packageSale) {
        const tpl = await tx.package.findUnique({ where: { id: input.packageSale.packageId } });
        if (!tpl) throw new UserError("Không tìm thấy gói");
        const cp = await tx.customerPackage.create({
          data: {
            customerId: customer.id,
            packageId: tpl.id,
            purchaseDate: strToDate(input.visitDate),
            paidAmount: input.packageSale.price,
            expiryDate: input.packageSale.expiryDate ? strToDate(input.packageSale.expiryDate) : null,
            createdBy: user.id,
            visitId: visit.id,
            items: {
              create: input.packageSale.items.map((i) => ({ serviceId: i.serviceId, totalSessions: i.sessions })),
            },
          },
          include: { items: true },
        });
        newPackageId = cp.id;
        for (const it of cp.items) if (!newItemByService.has(it.serviceId)) newItemByService.set(it.serviceId, it.id);
        summary.push(`Đã bán ${tpl.name}`);
      }

      // 3. Services, deducting package sessions where chosen
      for (const line of input.lines) {
        let itemId: number | null = null;
        if (line.pkg?.kind === "existing") itemId = line.pkg.itemId;
        if (line.pkg?.kind === "new") {
          itemId = newItemByService.get(line.pkg.serviceId) ?? null;
          if (!itemId) throw new UserError("Gói mới không có dịch vụ này");
        }
        let sessionNo: number | null = null;
        if (itemId) {
          const item = await tx.customerPackageItem.findUnique({
            where: { id: itemId },
            include: { customerPackage: true, service: true },
          });
          if (!item || item.customerPackage.customerId !== customer.id || item.serviceId !== line.serviceId) {
            throw new UserError("Gói không khớp với khách hoặc dịch vụ");
          }
          sessionNo = await deductSession(tx, itemId, input.allowExpired);
          summary.push(`${item.service.name} còn ${item.totalSessions - sessionNo}/${item.totalSessions} buổi`);
        }
        await tx.visitItem.create({
          data: {
            visitId: visit.id,
            serviceId: line.serviceId,
            price: itemId ? 0 : line.price,
            customerPackageItemId: itemId,
            sessionNo,
          },
        });
      }

      // 4. Products
      if (input.products.length) {
        const products = await tx.product.findMany({ where: { id: { in: input.products.map((p) => p.productId) } } });
        const byId = new Map(products.map((p) => [p.id, p]));
        for (const p of input.products) {
          const prod = byId.get(p.productId);
          if (!prod) throw new UserError("Không tìm thấy mỹ phẩm");
          await tx.productSale.create({
            data: {
              customerId: customer.id,
              productId: prod.id,
              visitId: visit.id,
              quantity: p.quantity,
              price: p.price,
              saleDate: strToDate(input.visitDate),
              runOutDate: strToDate(computeRunOut(input.visitDate, prod.usageDays, p.quantity)),
              createdBy: user.id,
            },
          });
        }
        if (!summary.length) summary.push(`${input.products.length} mỹ phẩm`);
      }

      // 5. Next appointment
      if (input.next) {
        const scheduledAt = toInstant(input.next.date, input.next.time);
        let customerPackageId: number | null = null;
        if (input.next.pkg?.kind === "existing") customerPackageId = input.next.pkg.id;
        if (input.next.pkg?.kind === "new") customerPackageId = newPackageId;
        await tx.appointment.create({
          data: {
            customerId: customer.id,
            serviceId: input.next.serviceId,
            customerPackageId,
            scheduledAt,
            note: input.next.note?.trim() || null,
            sourceVisitId: visit.id,
            createdBy: user.id,
          },
        });
        summary.push(`hẹn ${input.next.date.split("-").reverse().slice(0, 2).join("/")} ${input.next.time}`);
      }

      // 6. Close the appointment the customer came for
      if (input.appointmentId) {
        await tx.appointment.updateMany({
          where: { id: input.appointmentId, customerId: customer.id },
          data: { status: "done" },
        });
      }

      return visit.id;
    });

    revalidatePath("/", "layout");
    return { ok: true, data: { visitId }, message: ["Đã lưu", ...summary].join(" · ") };
  });
}

/** Today's date for the client default (server clock, Vietnam time). */
export async function serverToday() {
  return todayStr();
}
