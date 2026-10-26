"use client";
import { useActionState } from "react";
import { login } from "../actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Tên đăng nhập" htmlFor="username">
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" autoFocus required />
      </Field>
      <Field label="Mật khẩu" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <Checkbox name="remember" defaultChecked />
        Ghi nhớ trên máy này
      </label>
      {state?.error && (
        <p role="alert" className="rounded-[var(--radius-field)] bg-lotus-wash px-3 py-2 text-sm text-lotus">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="mt-2">
        {pending ? "Đang đăng nhập…" : "Đăng nhập"}
      </Button>
    </form>
  );
}
