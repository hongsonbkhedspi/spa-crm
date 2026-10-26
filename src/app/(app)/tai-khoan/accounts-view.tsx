"use client";
import { useState, useTransition } from "react";
import { Monitor, Plus, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import { createStaff, resetPassword, revokeAllSessions, revokeSession, setUserActive } from "@/actions/users";

export type AccountRow = {
  id: number;
  username: string;
  fullName: string;
  role: "owner" | "staff";
  active: boolean;
  isMe: boolean;
  lastLogin: string | null;
  sessions: { id: string; device: string; ip: string; lastSeen: string; current: boolean }[];
};

type Result = { ok: boolean; error?: string; message?: string };

export function AccountsView({ rows }: { rows: AccountRow[] }) {
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<AccountRow | null>(null);

  const act = (fn: () => Promise<Result>, fallback = "Đã lưu") =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else toast.success(r.message ?? fallback);
    });

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Thêm nhân viên
        </Button>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((u) => (
          <li key={u.id} className={cn("rounded-[var(--radius-panel)] border border-line bg-surface", !u.active && "bg-paper/60")}>
            <div className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("text-base font-semibold", !u.active && "text-muted")}>{u.fullName}</span>
                  <Tag tone={u.role === "owner" ? "jade" : "neutral"}>{u.role === "owner" ? "Chủ spa" : "Nhân viên"}</Tag>
                  {!u.active && <Tag tone="lotus">Đã khoá</Tag>}
                  {u.isMe && <Tag>Bạn</Tag>}
                </div>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {u.username}
                  <span className="text-muted"> — đăng nhập lần cuối {u.lastLogin ?? "chưa có"}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => setResetFor(u)}>
                  Đặt lại mật khẩu
                </Button>
                {!u.isMe && (
                  <Button
                    variant="quiet"
                    size="sm"
                    className={u.active ? "text-lotus" : undefined}
                    disabled={pending}
                    onClick={() => act(() => setUserActive(u.id, !u.active))}
                  >
                    {u.active ? "Khoá" : "Mở khoá"}
                  </Button>
                )}
              </div>
            </div>

            {u.sessions.length > 0 && (
              <div className="border-t border-line px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-ink-soft">Đang đăng nhập trên {u.sessions.length} thiết bị</p>
                  {(u.sessions.length > 1 || !u.isMe) && (
                    <Button variant="quiet" size="sm" disabled={pending} onClick={() => act(() => revokeAllSessions(u.id))}>
                      {u.isMe ? "Đăng xuất các máy khác" : "Đăng xuất tất cả"}
                    </Button>
                  )}
                </div>
                <ul className="flex flex-col divide-y divide-line">
                  {u.sessions.map((s) => {
                    const phone = /iPhone|Android|iPad/.test(s.device);
                    const Icon = phone ? Smartphone : Monitor;
                    return (
                      <li key={s.id} className="flex items-center justify-between gap-3 py-2">
                        <div className="flex min-w-0 items-center gap-3">
                          <Icon className="size-4 shrink-0 text-muted" />
                          <div className="min-w-0 text-sm">
                            <p className="font-medium">
                              {s.device}
                              {s.current && <span className="ml-2 text-xs font-normal text-jade-deep">máy này</span>}
                            </p>
                            <p className="num truncate text-xs text-muted">
                              {s.ip} — hoạt động {s.lastSeen}
                            </p>
                          </div>
                        </div>
                        {!s.current && (
                          <Button variant="quiet" size="sm" disabled={pending} onClick={() => act(() => revokeSession(s.id))}>
                            Đăng xuất
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>

      <AddStaffDialog open={adding} onClose={() => setAdding(false)} />
      <ResetPasswordDialog user={resetFor} onClose={() => setResetFor(null)} />
    </>
  );
}

function AddStaffDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ fullName: "", username: "", password: "" });
  const submit = () =>
    start(async () => {
      const r = await createStaff(form);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Đã thêm nhân viên");
      setForm({ fullName: "", username: "", password: "" });
      onClose();
    });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Thêm nhân viên">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Họ tên" htmlFor="st-name" required>
          <Input id="st-name" autoFocus value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
        </Field>
        <Field label="Tên đăng nhập" htmlFor="st-user" required info="Chữ thường không dấu, số, dấu chấm hoặc gạch dưới. VD: lan.letan">
          <Input
            id="st-user"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
        </Field>
        <Field label="Mật khẩu ban đầu" htmlFor="st-pw" required info="Tối thiểu 8 ký tự. Nhân viên nên tự đổi sau lần đăng nhập đầu.">
          <Input id="st-pw" type="text" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="quiet" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={pending}>
            Thêm nhân viên
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: AccountRow | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const submit = () =>
    user &&
    start(async () => {
      const r = await resetPassword(user.id, pw);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Đã đặt lại mật khẩu");
      setPw("");
      onClose();
    });
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()} title={`Đặt lại mật khẩu: ${user?.fullName ?? ""}`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Mật khẩu mới" htmlFor="rp-pw" required info="Tối thiểu 8 ký tự. Tài khoản này sẽ bị đăng xuất khỏi mọi thiết bị.">
          <Input id="rp-pw" type="text" autoFocus autoComplete="new-password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </Field>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button variant="quiet" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" disabled={pending}>
            Đặt lại mật khẩu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
