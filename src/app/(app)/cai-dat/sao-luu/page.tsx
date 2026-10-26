import { requireOwnerPage } from "@/lib/auth";
import { backupDir, backupLabel, isBackupOverdue, listBackups, type BackupView } from "@/lib/backup";
import { fmtInstantDate, instantToTimeStr } from "@/lib/dates";
import { PageHeader, Panel, Empty } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { BackupNowButton } from "./backup-now";

export const metadata = { title: "Sao lưu" };
export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requireOwnerPage();
  const [rows, overdue] = await Promise.all([listBackups(30), isBackupOverdue()]);
  const running = rows.some((r) => r.status === "running");
  const last = rows.find((r) => r.status !== "running") ?? null;
  const dir = backupDir();

  return (
    <div className="max-w-3xl">
      <PageHeader title="Sao lưu" actions={<BackupNowButton running={running} />} />

      {overdue && (
        <p role="alert" className="mb-4 rounded-[var(--radius-field)] bg-lotus-wash px-4 py-3 text-sm font-medium text-lotus">
          Hơn 48 giờ chưa có bản sao lưu thành công.
        </p>
      )}

      <Panel className="mb-5">
        {last ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-ink-soft">Lần gần nhất</p>
              <p className="num mt-0.5 text-2xl font-semibold">{when(last.startedAt)}</p>
              {last.fileName && <p className="num mt-1 break-all text-xs text-muted">{last.fileName}</p>}
              <p className="mt-1 break-all text-xs text-muted">Thư mục: {dir}</p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <StatusTag b={last} />
              {last.sizeBytes !== null && <span className="num text-sm text-ink-soft">{fmtSize(last.sizeBytes)}</span>}
            </div>
            {last.errorMessage && <p className="w-full text-sm text-lotus">{last.errorMessage}</p>}
          </div>
        ) : (
          <Empty>Chưa có bản sao lưu nào. Bấm “Sao lưu ngay” để kiểm tra cấu hình.</Empty>
        )}
      </Panel>

      {rows.length > 0 && (
        <Panel title="30 lần gần nhất" bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[160px_1fr_90px_auto]">
                <span className="num font-medium">{when(r.startedAt)}</span>
                <span className="order-last col-span-2 min-w-0 truncate text-xs text-muted sm:order-none sm:col-span-1">
                  {r.trigger === "manual" ? "Bấm tay" : "Tự động"}
                  {r.errorMessage ? ` — ${r.errorMessage}` : ""}
                </span>
                <span className="num hidden text-right text-sm text-ink-soft sm:block">{r.sizeBytes !== null ? fmtSize(r.sizeBytes) : ""}</span>
                <StatusTag b={r} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function StatusTag({ b }: { b: BackupView }) {
  const label = backupLabel(b);
  const tone = label === "Thành công" ? "jade" : label === "Đang chạy" ? "neutral" : "lotus";
  return <Tag tone={tone}>{label}</Tag>;
}

function when(d: Date) {
  return `${instantToTimeStr(d)} ${fmtInstantDate(d)}`;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
