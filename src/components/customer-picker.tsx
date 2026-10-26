"use client";
import { useRef, useState, useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Combobox, type ComboboxHandle } from "./ui/combobox";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { quickCreateCustomer, type QuickCustomer } from "@/actions/customers";
import { searchCustomers } from "@/lib/client-api";
import { fmtPhone } from "@/lib/format";

/**
 * Pick a customer by name/phone, or create one in place with a name and an optional phone.
 * Controlled: `value` is the selected customer or null.
 */
export function CustomerPicker({
  value,
  onChange,
  autoFocus,
  id,
}: {
  value: QuickCustomer | null;
  onChange: (c: QuickCustomer | null) => void;
  autoFocus?: boolean;
  id?: string;
}) {
  const comboRef = useRef<ComboboxHandle>(null);
  const [creating, setCreating] = useState<{ name: string; phone: string } | null>(null);
  const [pending, start] = useTransition();

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-field)] border border-jade/40 bg-jade-wash/60 pl-3 pr-1">
        <div className="min-w-0">
          <span className="font-semibold">{value.name}</span>
          <span className="num ml-2 text-sm text-ink-soft">{fmtPhone(value.phone)}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setTimeout(() => comboRef.current?.focus(), 0);
          }}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:text-ink md:size-9"
          aria-label="Đổi khách"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (creating) {
    const submit = () =>
      start(async () => {
        const r = await quickCreateCustomer(creating);
        if (!r.ok) return void toast.error(r.error);
        toast.success(`Đã thêm khách ${r.data!.name}`);
        setCreating(null);
        onChange(r.data!);
      });
    return (
      <div
        className="grid gap-2 rounded-[var(--radius-field)] border border-dashed border-jade/50 p-3 sm:grid-cols-[1fr_1fr_auto]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setCreating(null);
        }}
      >
        <Input
          aria-label="Tên khách mới"
          placeholder="Tên khách"
          autoFocus
          value={creating.name}
          onChange={(e) => setCreating({ ...creating, name: e.target.value })}
        />
        <Input
          aria-label="SĐT khách mới"
          placeholder="SĐT (không bắt buộc)"
          inputMode="tel"
          autoComplete="off"
          value={creating.phone}
          onChange={(e) => setCreating({ ...creating, phone: e.target.value })}
        />
        <div className="flex gap-2">
          <Button onClick={submit} disabled={pending} className="flex-1">
            Thêm khách
          </Button>
          <Button variant="quiet" onClick={() => setCreating(null)}>
            Huỷ
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Combobox
      ref={comboRef}
      id={id}
      load={searchCustomers}
      autoFocus={autoFocus}
      placeholder="Tên hoặc SĐT khách"
      clearOnSelect={false}
      onSelect={(item) => onChange({ id: item.value, name: item.label, phone: item.keywords ?? null })}
      footer={(q, close) => (
        <button
          type="button"
          onClick={() => {
            close();
            const digits = /^[\d\s.+]+$/.test(q.trim());
            setCreating({ name: digits ? "" : q.trim(), phone: digits ? q.trim() : "" });
          }}
          className="flex min-h-11 w-full items-center gap-2 px-3 text-sm font-semibold text-jade-deep hover:bg-jade-wash"
        >
          <UserPlus className="size-4" /> Khách mới{q.trim() ? `: ${q.trim()}` : ""}
        </button>
      )}
    />
  );
}
