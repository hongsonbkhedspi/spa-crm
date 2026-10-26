"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { saveSettings, type Settings } from "@/lib/settings";

export async function updateSettings(input: Settings): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    const spaName = input.spaName.normalize("NFC").trim();
    if (!spaName) throw new UserError("Nhập tên spa");
    const days = (n: number, label: string) => {
      if (!Number.isInteger(n) || n < 0 || n > 365) throw new UserError(`${label}: nhập số ngày từ 0 đến 365`);
      return n;
    };
    await saveSettings({
      spaName,
      productRemindDays: days(input.productRemindDays, "Nhắc mỹ phẩm trước"),
      packageExpiryDays: days(input.packageExpiryDays, "Nhắc gói sắp hết hạn"),
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Đã lưu cài đặt" };
  });
}
