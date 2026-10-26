"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { isValidPhone, normalizePhone } from "@/lib/format";

export type QuickCustomer = { id: number; name: string; phone: string | null };

/** Create a customer with just a name and an optional phone (used inline in forms). */
export async function quickCreateCustomer(input: { name: string; phone: string }): Promise<ActionResult<QuickCustomer>> {
  return run(async () => {
    await requireUser();
    const name = input.name.trim();
    const phone = normalizePhone(input.phone) || null;
    if (!name) throw new UserError("Nhập tên khách");
    if (phone && !isValidPhone(phone)) throw new UserError("SĐT không hợp lệ");
    const existing = phone ? await db.customer.findUnique({ where: { phone } }) : null;
    if (existing) throw new UserError(`SĐT này đã có: ${existing.name}`);
    const c = await db.customer.create({ data: { name, phone }, select: { id: true, name: true, phone: true } });
    revalidatePath("/khach-hang");
    return { ok: true, data: c };
  });
}
