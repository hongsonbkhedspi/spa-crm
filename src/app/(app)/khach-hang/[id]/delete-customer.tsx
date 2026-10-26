"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCustomer } from "@/actions/customer-admin";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

export function DeleteCustomerButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="size-4" /> Xoá khách
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Xoá khách">
        <p className="mb-4">
          Xoá <strong>{name}</strong> khỏi danh sách khách? Chỉ xoá được khách chưa có giao dịch nào.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await deleteCustomer(id);
                if (!r.ok) return void toast.error(r.error);
                toast.success(`Đã xoá khách ${name}`);
                router.push("/khach-hang");
              })
            }
          >
            Xoá khách
          </Button>
          <Button variant="quiet" onClick={() => setOpen(false)}>
            Giữ lại
          </Button>
        </div>
      </Dialog>
    </>
  );
}
