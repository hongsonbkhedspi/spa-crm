"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { backupNow } from "@/actions/backup";

/** "Sao lưu ngay". While a run is in progress the page refreshes every 5s. */
export function BackupNowButton({ running }: { running: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [running, router]);

  return (
    <Button
      disabled={pending || running}
      onClick={() =>
        start(async () => {
          const r = await backupNow();
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? "Đã bắt đầu sao lưu");
          router.refresh();
        })
      }
    >
      <CloudUpload className="size-4" />
      {running ? "Đang sao lưu…" : "Sao lưu ngay"}
    </Button>
  );
}
