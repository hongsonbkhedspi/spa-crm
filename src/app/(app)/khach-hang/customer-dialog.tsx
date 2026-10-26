"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { createCustomer, updateCustomer, type CustomerInput } from "@/actions/customer-admin";

type Existing = { id: number; name: string; phone: string | null; birthday: string | null; note: string | null };

/** "Thêm khách" (create) or "Sửa" (edit) button with its dialog. */
export function CustomerDialogButton({ customer }: { customer?: Existing }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const editing = !!customer;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const input: CustomerInput = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      birthday: String(fd.get("birthday") ?? "") || null,
      note: String(fd.get("note") ?? "") || null,
    };
    start(async () => {
      if (editing) {
        const r = await updateCustomer(customer.id, input);
        if (!r.ok) return void toast.error(r.error);
        toast.success("Đã lưu thông tin khách");
        setOpen(false);
        router.refresh();
      } else {
        const r = await createCustomer(input);
        if (!r.ok) return void toast.error(r.error);
        toast.success(`Đã thêm khách ${input.name.trim()}`);
        setOpen(false);
        router.push(`/khach-hang/${r.data!.id}`);
      }
    });
  }

  return (
    <>
      {editing ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="size-4" /> Sửa
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="size-4" /> Thêm khách
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen} title={editing ? "Sửa thông tin khách" : "Thêm khách"}>
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) e.currentTarget.requestSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Tên khách" htmlFor="c-name" required>
            <Input id="c-name" name="name" defaultValue={customer?.name} autoFocus required autoComplete="off" />
          </Field>
          <Field label="SĐT" htmlFor="c-phone">
            <Input id="c-phone" name="phone" defaultValue={customer?.phone ?? ""} inputMode="tel" autoComplete="off" />
          </Field>
          <Field label="Ngày sinh" htmlFor="c-birthday">
            <Input id="c-birthday" name="birthday" type="date" defaultValue={customer?.birthday ?? ""} />
          </Field>
          <Field label="Ghi chú" htmlFor="c-note">
            <Textarea id="c-note" name="note" rows={3} defaultValue={customer?.note ?? ""} />
          </Field>
          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-line bg-surface px-5 pt-3 md:static md:mx-0 md:border-0 md:px-0">
            <Button type="submit" disabled={pending} className="flex-1 md:flex-none">
              {pending ? "Đang lưu…" : editing ? "Lưu" : "Thêm khách"}
            </Button>
            <Button variant="quiet" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
