import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { db } from "./db";

const STALE_MS = 2 * 3600 * 1000;
const OVERDUE_MS = 48 * 3600 * 1000;

export type BackupView = {
  id: number;
  startedAt: Date;
  finishedAt: Date | null;
  status: "running" | "success" | "failed";
  fileName: string | null;
  sizeBytes: number | null;
  uploaded: boolean;
  errorMessage: string | null;
  trigger: "scheduled" | "manual";
};

/** "Thành công" | "Lỗi" | "Đang chạy". Backups stay on this machine only, so `uploaded` is unused. */
export function backupLabel(b: Pick<BackupView, "status">) {
  if (b.status === "running") return "Đang chạy";
  if (b.status === "failed") return "Lỗi";
  return "Thành công";
}

/** Folder holding the .zip.enc files (BACKUP_DIR in .env, default <app>/backups). */
export function backupDir() {
  return process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
}

/** Running rows older than 2h are treated as interrupted. */
async function closeStaleRuns() {
  await db.backupLog.updateMany({
    where: { status: "running", startedAt: { lt: new Date(Date.now() - STALE_MS) } },
    data: { status: "failed", finishedAt: new Date(), errorMessage: "Bị gián đoạn (quá 2 giờ không hoàn tất)" },
  });
}

export async function listBackups(take = 30): Promise<BackupView[]> {
  await closeStaleRuns();
  const rows = await db.backupLog.findMany({ orderBy: { startedAt: "desc" }, take });
  return rows.map((r) => ({ ...r, sizeBytes: r.sizeBytes === null ? null : Number(r.sizeBytes) }));
}

/** Last successful backup time, or null. */
export async function lastSuccessAt(): Promise<Date | null> {
  const r = await db.backupLog.findFirst({
    where: { status: "success" },
    orderBy: { startedAt: "desc" },
    select: { finishedAt: true, startedAt: true },
  });
  return r ? (r.finishedAt ?? r.startedAt) : null;
}

/** True when no successful backup in the last 48 hours (for the red banner on "Hôm nay"). */
export async function isBackupOverdue(): Promise<boolean> {
  const last = await lastSuccessAt();
  return !last || Date.now() - last.getTime() > OVERDUE_MS;
}

/**
 * Start scripts/backup.ps1 in the background. Returns false if a run is already in progress.
 * The log row is created here so two clicks can't start two runs.
 */
export async function startManualBackup(): Promise<{ started: boolean; reason?: string }> {
  await closeStaleRuns();
  const script = path.join(process.cwd(), "scripts", "backup.ps1");
  if (!fs.existsSync(script)) return { started: false, reason: "Không tìm thấy scripts/backup.ps1" };

  const log = await db.$transaction(
    async (tx) => {
      const running = await tx.backupLog.count({ where: { status: "running" } });
      if (running > 0) return null;
      return tx.backupLog.create({ data: { status: "running", trigger: "manual" } });
    },
    { isolationLevel: "Serializable" },
  );
  if (!log) return { started: false, reason: "Đang có một lần sao lưu chạy" };

  try {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-LogId", String(log.id), "-Trigger", "manual"],
      { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true },
    );
    child.on("error", async (e) => {
      await db.backupLog
        .update({ where: { id: log.id }, data: { status: "failed", finishedAt: new Date(), errorMessage: `Không chạy được PowerShell: ${e.message}` } })
        .catch(() => {});
    });
    child.unref();
  } catch (e) {
    await db.backupLog.update({
      where: { id: log.id },
      data: { status: "failed", finishedAt: new Date(), errorMessage: String(e) },
    });
    return { started: false, reason: "Không chạy được script sao lưu" };
  }
  return { started: true };
}
