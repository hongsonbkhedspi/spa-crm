"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentStatus } from "@prisma/client";
import { CustomerPicker } from "@/components/customer-picker";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { QuickCustomer } from "@/actions/customers";
import { getActivePackages, saveAppointment, type CustomerPackageOption } from "@/actions/appointments";
import { cn } from "@/lib/utils";

export const TIME_SLOTS = Array.from({ length: 27 }, (_, i) => {
  const m = 8 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

function plusDays(base: string, n: number) {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "scheduled", label: "Đã hẹn" },
  { value: "done", label: "Đã đến" },
  { value: "no_show", label: "Không đến" },
  { value: "cancelled", label: "Đã huỷ" },
];

export type AppointmentFormInitial = {
  id?: number;
  customer: QuickCustomer | null;
  serviceId: number | null;
  customerPackageId: number | null;
  date: string;
  time: string;
  note: string;
  status?: AppointmentStatus;
};

export function AppointmentForm({
  initial,
  services,
  today,
}: {
  initial: AppointmentFormInitial;
  services: { id: number; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [customer, setCustomer] = useState<QuickCustomer | null>(initial.customer);
  const [serviceId, setServiceId] = useState<number | null>(initial.serviceId);
  const [packages, setPackages] = useState<CustomerPackageOption[]>([]);
  const [packageId, setPackageId] = useState<number | null>(initial.customerPackageId);
  const [packageTouched, setPackageTouched] = useState(!!initial.id);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [note, setNote] = useState(initial.note);
  const [status, setStatus] = useState<AppointmentStatus | undefined>(initial.status);

  useEffect(() => {
    if (!customer) {
      setPackages([]);
      return;
    }
    let cancelled = false;
    getActivePackages(customer.id).then((p) => !cancelled && setPackages(p));
    return () => {
      cancelled = true;
    };
  }, [customer]);

  // Auto-link: the earliest-expiring active package that still has sessions for this service.
  const candidates = useMemo(
    () => packages.filter((p) => p.items.some((i) => i.serviceId === serviceId && i.used < i.total)),
    [packages, serviceId],
  );
  useEffect(() => {
    if (packageTouched) return;
    setPackageId(candidates[0]?.id ?? null);
  }, [candidates, packageTouched]);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const slots = TIME_SLOTS.includes(time) ? TIME_SLOTS : [...TIME_SLOTS, time].sort();
  const linkable = packageId && !candidates.some((c) => c.id === packageId)
    ? [...candidates, ...packages.filter((p) => p.id === packageId)]
    : candidates;

  function submit() {
    if (!customer) return void toast.error("Chọn khách");
    start(async () => {
      const r = await saveAppointment({
        id: initial.id,
        customerId: customer.id,
        serviceId,
        customerPackageId: packageId,
        date,
        time,
        note,
        status,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(initial.id ? "Đã lưu lịch hẹn" : `Đã đặt lịch ${time} ${date.split("-").reverse().join("/")}`);
      router.push(`/lich-hen?date=${date}`);
      router.refresh();
    });
  }

  return (
    <form
      className="flex max-w-xl flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          submit();
        }
      }}
    >
      <Field label="Khách" htmlFor="appt-customer" required>
        <CustomerPicker
          id="appt-customer"
          value={customer}
          autoFocus={!customer}
          onChange={(c) => {
            setCustomer(c);
            setPackageTouched(false);
          }}
        />
      </Field>

      <Field label="Dịch vụ dự kiến" htmlFor="appt-service">
        {service ? (
          <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-field)] border border-line-strong bg-surface pl-3 pr-1">
            <span className="font-medium">{service.name}</span>
            <button
              type="button"
              onClick={() => {
                setServiceId(null);
                setPackageTouched(false);
              }}
              className="grid size-11 place-items-center rounded-full text-muted hover:text-ink md:size-9"
              aria-label="Bỏ dịch vụ"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Combobox
            id="appt-service"
            items={services.map((s) => ({ value: s.id, label: s.name }))}
            placeholder="Tìm dịch vụ"
            clearOnSelect={false}
            onSelect={(i) => {
              setServiceId(i.value);
              setPackageTouched(false);
            }}
          />
        )}
      </Field>

      {linkable.length > 0 && (
        <Field label="Gắn với gói" htmlFor="appt-package">
          <Select
            id="appt-package"
            value={packageId ?? ""}
            onChange={(e) => {
              setPackageTouched(true);
              setPackageId(e.target.value ? Number(e.target.value) : null);
            }}
          >
            <option value="">Không gắn gói</option>
            {linkable.map((p) => {
              const item = p.items.find((i) => i.serviceId === serviceId);
              return (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {item ? ` — còn ${item.total - item.used}/${item.total}` : ""}
                  {p.expiryDate ? ` · HSD ${p.expiryDate.split("-").reverse().join("/")}` : ""}
                </option>
              );
            })}
          </Select>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <Field label="Ngày" htmlFor="appt-date" required>
          <Input id="appt-date" type="date" required value={date} min={initial.id ? undefined : today} onChange={(e) => setDate(e.target.value)} />
          <div className="flex gap-1.5">
            {[7, 14, 30].map((n) => {
              const d = plusDays(today, n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDate(d)}
                  className={cn(
                    "num min-h-11 flex-1 rounded-[var(--radius-field)] border text-sm font-medium md:min-h-9",
                    date === d ? "border-jade bg-jade-wash text-jade-deep" : "border-line-strong hover:border-jade",
                  )}
                >
                  +{n} ngày
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Giờ" htmlFor="appt-time" required>
          <Select id="appt-time" value={time} onChange={(e) => setTime(e.target.value)} className="num">
            {slots.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {status && (
        <Field label="Trạng thái" htmlFor="appt-status">
          <Select id="appt-status" value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Ghi chú" htmlFor="appt-note">
        <Textarea id="appt-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4rem)] -mx-4 flex gap-2 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <Button type="submit" disabled={pending} className="flex-1 md:flex-none md:px-8">
          {pending ? "Đang lưu…" : initial.id ? "Lưu lịch hẹn" : "Đặt lịch"}
        </Button>
        <Button variant="quiet" onClick={() => router.back()}>
          Quay lại
        </Button>
      </div>
    </form>
  );
}
