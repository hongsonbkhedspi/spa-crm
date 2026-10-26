"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { isDateStr, strToDate } from "@/lib/dates";

export type ProductOption = { id: number; name: string; price: number; usageDays: number };

export async function getActiveProducts(): Promise<ProductOption[]> {
  await requireUser();
  return db.product.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, price: true, usageDays: true },
  });
}

export type ProductSaleInput = {
  customerId: number;
  productId: number;
  quantity: number;
  price: number;
  saleDate: string;
  runOutDate: string;
};

export async function createProductSale(input: ProductSaleInput): Promise<ActionResult<{ productName: string }>> {
  return run(async () => {
    const user = await requireUser();
    if (!input.customerId) throw new UserError("Chọn khách");
    const product = await db.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new UserError("Chọn mỹ phẩm");
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 999)
      throw new UserError("Số lượng không hợp lệ");
    if (!Number.isFinite(input.price) || input.price < 0) throw new UserError("Giá không hợp lệ");
    if (!isDateStr(input.saleDate) || !isDateStr(input.runOutDate)) throw new UserError("Ngày không hợp lệ");
    if (input.runOutDate < input.saleDate) throw new UserError("Ngày dự kiến hết phải sau ngày mua");
    await db.productSale.create({
      data: {
        customerId: input.customerId,
        productId: product.id,
        quantity: input.quantity,
        price: Math.round(input.price),
        saleDate: strToDate(input.saleDate),
        runOutDate: strToDate(input.runOutDate),
        createdBy: user.id,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { productName: product.name } };
  });
}

export type FollowUpResult = "repurchased" | "contacted" | "not_interested";

/** "Đã hỏi": record the outcome; the row leaves the due list. */
export async function markFollowUp(saleId: number, result: FollowUpResult, note: string): Promise<ActionResult> {
  return run(async () => {
    await requireUser();
    if (!["repurchased", "contacted", "not_interested"].includes(result)) throw new UserError("Chọn kết quả");
    await db.productSale.update({
      where: { id: saleId },
      data: {
        followUpStatus: result,
        followUpNote: note.trim().normalize("NFC").slice(0, 300) || null,
        contactedAt: new Date(),
      },
    });
    revalidatePath("/", "layout");
  });
}
