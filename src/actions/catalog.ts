"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";

type ServiceInput = { id?: number; name: string; price: number; recallDays: number | null };
type ProductInput = { id?: number; name: string; price: number; usageDays: number };
type PackageInput = {
  id?: number;
  name: string;
  price: number;
  validityDays: number | null;
  intervalDays: number | null;
  items: { serviceId: number; sessions: number }[];
};

function cleanName(s: string) {
  const n = s.normalize("NFC").trim();
  if (!n) throw new UserError("Nhập tên");
  return n;
}
function nonNeg(n: number | null | undefined, label: string) {
  if (n === null || n === undefined) return null;
  if (!Number.isFinite(n) || n < 0) throw new UserError(`${label} không hợp lệ`);
  return Math.round(n);
}

/** On create: refuse a name that is already on sale (case-insensitive), e.g. added again from the Ghi nhận search. */
async function assertNewName(kind: "service" | "product" | "package", name: string) {
  const where = { active: true, name: { equals: name, mode: "insensitive" as const } };
  const found =
    kind === "service"
      ? await db.service.findFirst({ where })
      : kind === "product"
        ? await db.product.findFirst({ where })
        : await db.package.findFirst({ where });
  if (found) throw new UserError(`Danh mục đã có “${found.name}”`);
}

function revalidateCatalog() {
  revalidatePath("/danh-muc", "layout");
  revalidatePath("/ghi-nhan");
}

// ---------------- Services ----------------

export async function saveService(input: ServiceInput): Promise<ActionResult<{ id: number }>> {
  return run(async () => {
    await requireOwner();
    const data = {
      name: cleanName(input.name),
      price: nonNeg(input.price, "Giá") ?? 0,
      recallDays: nonNeg(input.recallDays, "Chu kỳ hẹn lại") || null,
    };
    if (!input.id) await assertNewName("service", data.name);
    const { id } = input.id
      ? await db.service.update({ where: { id: input.id }, data })
      : await db.service.create({ data });
    revalidateCatalog();
    return { ok: true, data: { id }, message: input.id ? "Đã lưu dịch vụ" : "Đã thêm dịch vụ" };
  });
}

export async function setServiceActive(id: number, active: boolean): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    await db.service.update({ where: { id }, data: { active } });
    revalidateCatalog();
  });
}

export async function deleteService(id: number): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    const used =
      (await db.visitItem.count({ where: { serviceId: id } })) +
      (await db.packageItem.count({ where: { serviceId: id } })) +
      (await db.customerPackageItem.count({ where: { serviceId: id } })) +
      (await db.appointment.count({ where: { serviceId: id } }));
    if (used > 0) {
      await db.service.update({ where: { id }, data: { active: false } });
      revalidateCatalog();
      return { ok: true, message: "Đã ngừng bán (đã có giao dịch)" };
    }
    await db.service.delete({ where: { id } });
    revalidateCatalog();
    return { ok: true, message: "Đã xoá dịch vụ" };
  });
}

// ---------------- Products ----------------

export async function saveProduct(input: ProductInput): Promise<ActionResult<{ id: number }>> {
  return run(async () => {
    await requireOwner();
    const usageDays = nonNeg(input.usageDays, "Số ngày dùng");
    if (!usageDays) throw new UserError("Nhập số ngày dùng");
    const data = { name: cleanName(input.name), price: nonNeg(input.price, "Giá") ?? 0, usageDays };
    if (!input.id) await assertNewName("product", data.name);
    const { id } = input.id
      ? await db.product.update({ where: { id: input.id }, data })
      : await db.product.create({ data });
    revalidateCatalog();
    return { ok: true, data: { id }, message: input.id ? "Đã lưu mỹ phẩm" : "Đã thêm mỹ phẩm" };
  });
}

export async function setProductActive(id: number, active: boolean): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    await db.product.update({ where: { id }, data: { active } });
    revalidateCatalog();
  });
}

export async function deleteProduct(id: number): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    if ((await db.productSale.count({ where: { productId: id } })) > 0) {
      await db.product.update({ where: { id }, data: { active: false } });
      revalidateCatalog();
      return { ok: true, message: "Đã ngừng bán (đã có giao dịch)" };
    }
    await db.product.delete({ where: { id } });
    revalidateCatalog();
    return { ok: true, message: "Đã xoá mỹ phẩm" };
  });
}

// ---------------- Packages ----------------

export async function savePackage(input: PackageInput): Promise<ActionResult<{ id: number }>> {
  return run(async () => {
    await requireOwner();
    const name = cleanName(input.name);
    const price = nonNeg(input.price, "Giá");
    if (price === null) throw new UserError("Nhập giá gói");
    const items = input.items.filter((i) => i.serviceId && i.sessions > 0);
    if (items.length === 0) throw new UserError("Thêm ít nhất 1 dịch vụ cho gói");
    const ids = new Set<number>();
    for (const i of items) {
      if (ids.has(i.serviceId)) throw new UserError("Một dịch vụ chỉ nên có 1 dòng trong gói");
      ids.add(i.serviceId);
    }
    const data = {
      name,
      price,
      validityDays: nonNeg(input.validityDays, "Hạn dùng") || null,
      intervalDays: nonNeg(input.intervalDays, "Khoảng cách buổi") || null,
    };
    if (!input.id) await assertNewName("package", name);
    const id = await db.$transaction(async (tx) => {
      if (input.id) {
        await tx.package.update({ where: { id: input.id }, data });
        await tx.packageItem.deleteMany({ where: { packageId: input.id } });
        await tx.packageItem.createMany({
          data: items.map((i) => ({ packageId: input.id!, serviceId: i.serviceId, sessions: Math.round(i.sessions) })),
        });
        return input.id;
      }
      const p = await tx.package.create({
        data: { ...data, items: { create: items.map((i) => ({ serviceId: i.serviceId, sessions: Math.round(i.sessions) })) } },
      });
      return p.id;
    });
    revalidateCatalog();
    return { ok: true, data: { id }, message: input.id ? "Đã lưu gói" : "Đã thêm gói" };
  });
}

export async function setPackageActive(id: number, active: boolean): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    await db.package.update({ where: { id }, data: { active } });
    revalidateCatalog();
  });
}

export async function deletePackage(id: number): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    if ((await db.customerPackage.count({ where: { packageId: id } })) > 0) {
      await db.package.update({ where: { id }, data: { active: false } });
      revalidateCatalog();
      return { ok: true, message: "Đã ngừng bán (đã có giao dịch)" };
    }
    await db.package.delete({ where: { id } });
    revalidateCatalog();
    return { ok: true, message: "Đã xoá gói" };
  });
}
