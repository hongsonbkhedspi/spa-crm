"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { adjustPackageSessions, cancelPackage, setPackageExpiry } from "@/actions/packages";
import type { ActionResult } from "@/lib/action";

function useSubmit(onDone: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const submit = (fn: () => Promise<ActionResult>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(ok);
      onDone();
      router.refresh();
    });
  return { pending, submit };
}

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Lý do" htmlFor="adj-reason" required>
      <Input
        id="adj-reason"
        value={value}
        maxLength={200}
        placeholder="VD: tặng khách quen, bù buổi lỗi máy"
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function Footer({ onCancel, onSave, pending, disabled, label, danger }: {
  onCancel: () => void;
  onSave: () => void;
  pending: boolean;
  disabled?: boolean;
  label: string;
  danger?: boolean;
}) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button variant="quiet" onClick={onCancel}>
        Đóng
      </Button>
      <Button variant={danger ? "danger" : "primary"} onClick={onSave} disabled={pending || disabled}>
        {pending ? "Đang lưu…" : label}
      </Button>
    </div>
  );
}

export function AdjustSessions({ itemId, serviceName, used, total }: { itemId: number; serviceName: string; used: number; total: number }) {
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("");
  const { pending, submit } = useSubmit(() => setOpen(false));
  const next = total + delta;
  const invalid = delta === 0 || next < used || next < 1 || !reason.trim();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setDelta(1); setReason(""); setOpen(true); }}>
        Điều chỉnh
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Điều chỉnh buổi · ${serviceName}`}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex gap-1.5">
              {[-1, 1, 2].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDelta(d)}
                  className={cn(
                    "num min-h-11 min-w-14 rounded-full border px-3 text-sm font-semibold md:min-h-9",
                    delta === d ? "border-jade bg-jade text-white" : "border-line-strong hover:border-jade",
                  )}
                >
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
              <Input
                aria-label="Số buổi cộng/trừ"
                inputMode="numeric"
                className="w-20"
                value={delta}
                onChange={(e) => {
                  const n = parseInt(e.target.value.replace(/[^\d-]/g, ""), 10);
                  setDelta(Number.isFinite(n) ? n : 0);
                }}
              />
            </div>
            <span className={cn("num text-sm", next < used ? "text-lotus" : "text-ink-soft")}>
              {total} → <b>{next}</b> buổi
            </span>
          </div>
          {next < used && <p className="text-xs text-lotus">Không thể ít hơn {used} buổi đã dùng</p>}
          <ReasonField value={reason} onChange={setReason} />
        </div>
        <Footer
          onCancel={() => setOpen(false)}
          pending={pending}
          disabled={invalid}
          label="Lưu điều chỉnh"
          onSave={() => submit(() => adjustPackageSessions(itemId, delta, reason), "Đã điều chỉnh số buổi")}
        />
      </Dialog>
    </>
  );
}

export function ExtendExpiry({ cpId, current }: { cpId: number; current: string | null }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(current ?? "");
  const [reason, setReason] = useState("");
  const { pending, submit } = useSubmit(() => setOpen(false));
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => { setDate(current ?? ""); setReason(""); setOpen(true); }}>
        Gia hạn
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Gia hạn gói">
        <div className="flex flex-col gap-4">
          <Field label="Hạn dùng mới" htmlFor="ext-date" info="Để trống nếu không giới hạn.">
            <Input id="ext-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <ReasonField value={reason} onChange={setReason} />
        </div>
        <Footer
          onCancel={() => setOpen(false)}
          pending={pending}
          disabled={!reason.trim() || date === (current ?? "")}
          label="Lưu hạn mới"
          onSave={() => submit(() => setPackageExpiry(cpId, date || null, reason), "Đã đổi hạn dùng")}
        />
      </Dialog>
    </>
  );
}

export function CancelPackage({ cpId }: { cpId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, submit } = useSubmit(() => setOpen(false));
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => { setReason(""); setOpen(true); }}>
        Huỷ gói
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Huỷ gói">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">Gói sẽ không trừ buổi được nữa. Lịch hẹn sắp tới của gói cũng bị huỷ.</p>
          <ReasonField value={reason} onChange={setReason} />
        </div>
        <Footer
          onCancel={() => setOpen(false)}
          pending={pending}
          disabled={!reason.trim()}
          danger
          label="Huỷ gói"
          onSave={() => submit(() => cancelPackage(cpId, reason), "Đã huỷ gói")}
        />
      </Dialog>
    </>
  );
}
