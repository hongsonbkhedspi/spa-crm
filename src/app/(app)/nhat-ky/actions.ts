"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { refundSession } from "@/lib/packages";

/** Owner only: delete a visit, give package sessions back, drop its product sales. */
export async function deleteVisit(id: number): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    let refunded = 0;
    await db.$transaction(async (tx) => {
      const v = await tx.visit.findUnique({ where: { id }, include: { items: true } });
      if (!v) throw new UserError("Lượt ghi nhận không còn tồn tại");
      for (const it of v.items) {
        if (it.customerPackageItemId) {
          await refundSession(tx, it.customerPackageItemId);
          refunded++;
        }
      }
      await tx.productSale.deleteMany({ where: { visitId: id } });
      await tx.visit.delete({ where: { id } });
    });
    revalidatePath("/", "layout");
    return { ok: true, message: refunded ? `Đã xoá · hoàn ${refunded} buổi vào gói` : "Đã xoá lượt ghi nhận" };
  });
}
