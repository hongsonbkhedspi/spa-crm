"use client";
import { Input } from "@/components/ui/input";

const fmt = new Intl.NumberFormat("vi-VN");

/** Number input showing thousands separators ("1.250.000"); value is a plain number. */
export function MoneyInput({
  value,
  onChange,
  id,
  placeholder = "0",
  suffix = "đ",
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  id?: string;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className="num pr-8"
        placeholder={placeholder}
        value={value === null ? "" : fmt.format(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? parseInt(digits, 10) : null);
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>
    </div>
  );
}

/** Small integer input (days, sessions). */
export function NumberInput({
  value,
  onChange,
  id,
  placeholder,
  suffix,
  autoFocus,
  onKeyDown,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  id?: string;
  placeholder?: string;
  suffix?: string;
  autoFocus?: boolean;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  "aria-label"?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        className={suffix ? "num pr-14" : "num"}
        placeholder={placeholder}
        value={value === null ? "" : String(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 5);
          onChange(digits ? parseInt(digits, 10) : null);
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">{suffix}</span>
      )}
    </div>
  );
}
