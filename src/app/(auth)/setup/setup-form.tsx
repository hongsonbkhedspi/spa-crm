"use client";
import { useActionState } from "react";
import { setupOwner } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export function SetupForm() {
  const [state, action, pending] = useActionState(setupOwner, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Tên spa" htmlFor="spaName">
        <Input id="spaName" name="spaName" placeholder="VD: Hoa Sen Spa" autoFocus />
      </Field>
      <Field label="Họ tên chủ spa" htmlFor="fullName" required>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Tên đăng nhập" htmlFor="username" required info="Chữ thường không dấu, số, dấu chấm hoặc gạch dưới. VD: chuspa">
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
      </Field>
      <Field label="Mật khẩu" htmlFor="password" required info="Tối thiểu 8 ký tự.">
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {state?.error && (
        <p role="alert" className="rounded-[var(--radius-field)] bg-lotus-wash px-3 py-2 text-sm text-lotus">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Đang tạo…" : "Tạo tài khoản"}
      </Button>
    </form>
  );
}
