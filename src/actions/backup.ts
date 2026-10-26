"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";
import { run, UserError, type ActionResult } from "@/lib/action";
import { startManualBackup } from "@/lib/backup";

export async function backupNow(): Promise<ActionResult> {
  return run(async () => {
    await requireOwner();
    const r = await startManualBackup();
    if (!r.started) throw new UserError(r.reason ?? "Không bắt đầu được sao lưu");
    revalidatePath("/cai-dat/sao-luu");
    return { ok: true, message: "Đã bắt đầu sao lưu" };
  });
}
