"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { changeOwnPassword } from "@/actions/users";

const EMPTY = { current: "", next: "", confirm: "" };

export function ChangePasswordForm() {
  const [form, setForm] = useState(EMPTY);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await changeOwnPassword(form);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? "Đã đổi mật khẩu");
          setForm(EMPTY);
        });
      }}
    >
      <Field label="Mật khẩu hiện tại" htmlFor="pw-cur" required>
        <Input id="pw-cur" type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required />
      </Field>
      <Field label="Mật khẩu mới" htmlFor="pw-new" required info="Tối thiểu 8 ký tự. Các thiết bị khác sẽ bị đăng xuất.">
        <Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required />
      </Field>
      <Field label="Nhập lại mật khẩu mới" htmlFor="pw-confirm" required>
        <Input id="pw-confirm" type="password" autoComplete="new-password" minLength={8} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
      </Field>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu…" : "Đổi mật khẩu"}
        </Button>
      </div>
    </form>
  );
}
