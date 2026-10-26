"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import { deletePackage, setPackageActive } from "@/actions/catalog";

export function PackageRowActions({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  const act = (p: () => Promise<{ ok: boolean; error?: string; message?: string }>, fallback: string) =>
    start(async () => {
      const r = await p();
      if (!r.ok) toast.error(r.error);
      else toast.success(r.message ?? fallback);
    });
  return (
    <div className="-mx-1 mt-auto flex flex-wrap gap-1 border-t border-line pt-2">
      <LinkButton href={`/danh-muc/goi/${id}`} variant="ghost" size="sm">
        Sửa
      </LinkButton>
      <Button variant="quiet" size="sm" disabled={pending} onClick={() => act(() => setPackageActive(id, !active), active ? "Đã ngừng bán" : "Đã bán lại")}>
        {active ? "Ngừng bán" : "Bán lại"}
      </Button>
      <Button variant="quiet" size="sm" className="text-lotus" disabled={pending} onClick={() => act(() => deletePackage(id), "Đã xoá")}>
        Xoá
      </Button>
    </div>
  );
}
