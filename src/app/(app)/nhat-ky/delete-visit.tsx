"use client";
import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteVisit } from "./actions";

export function DeleteVisit({ id, label }: { id: number; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <button
        type="button"
        aria-label="Xoá lượt"
        onClick={() => setOpen(true)}
        className="grid size-11 place-items-center rounded-full text-muted hover:bg-lotus-wash hover:text-lotus md:size-9"
      >
        <Trash2 className="size-4" />
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="Xoá lượt ghi nhận?">
        <p className="mb-4 text-sm text-ink-soft">
          {label}. Buổi đã trừ được hoàn lại vào gói, mỹ phẩm bán trong lượt này bị xoá.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Giữ lại
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteVisit(id);
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message ?? "Đã xoá");
                setOpen(false);
              })
            }
          >
            Xoá lượt
          </Button>
        </div>
      </Dialog>
    </>
  );
}
