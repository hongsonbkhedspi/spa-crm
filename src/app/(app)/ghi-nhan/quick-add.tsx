"use client";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Combobox, type ComboItem } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, INFO } from "@/components/ui/field";
import { TOPIC, type Topic } from "@/components/ui/topic";
import { MoneyInput, NumberInput } from "@/app/(app)/danh-muc/_components/money-input";
import { savePackage, saveProduct, saveService } from "@/actions/catalog";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Catalog } from "./record-form";

type Service = Catalog["services"][number];
type Product = Catalog["products"][number];
type Package = Catalog["packages"][number];

// Written out in full so Tailwind can see them
const OPTION_HOVER: Partial<Record<Topic, string>> = { pkg: "hover:bg-jade-wash", prod: "hover:bg-prod-wash" };

/** "+ Dịch vụ mới: …" row at the bottom of a Combobox dropdown (owner only). */
export function QuickAddOption({ label, q, topic, onClick }: { label: string; q: string; topic: Topic; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-semibold", TOPIC[topic].ink, OPTION_HOVER[topic])}
    >
      <Plus className="size-4 shrink-0" />
      <span className="truncate">
        {label}
        {q.trim() ? `: ${q.trim()}` : ""}
      </span>
    </button>
  );
}

/** Dashed inline box: Enter saves, Esc cancels (same feel as "Khách mới"). */
function QuickBox({
  title,
  topic,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
  children,
}: {
  title: string;
  topic: Topic;
  submitLabel: string;
  pending: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-[var(--radius-field)] border border-dashed p-3", TOPIC[topic].border)}
      onKeyDown={(e) => {
        // Enter in the box saves, unless it is picking a suggestion in a nested Combobox
        if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && (e.target as HTMLElement).getAttribute("role") !== "combobox") {
          e.preventDefault();
          onSubmit();
        }
        if (e.key === "Escape") onCancel();
      }}
    >
      <p className={cn("text-sm font-semibold", TOPIC[topic].ink)}>{title}</p>
      {children}
      <div className="flex gap-2">
        <Button onClick={onSubmit} disabled={pending} className="flex-1">
          {pending ? "Đang lưu…" : submitLabel}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
    </div>
  );
}

export function QuickService({ name: initialName, onCreated, onCancel }: { name: string; onCreated: (s: Service) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState<number | null>(null);
  const [recallDays, setRecallDays] = useState<number | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const input = { name, price: price ?? 0, recallDays };
      const r = await saveService(input);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Đã thêm dịch vụ ${name.trim()}`);
      onCreated({ id: r.data!.id, name: name.trim(), price: input.price, recallDays: recallDays || null });
    });

  return (
    <QuickBox title="Dịch vụ mới" topic="pkg" submitLabel="Thêm dịch vụ" pending={pending} onSubmit={submit} onCancel={onCancel}>
      <Field label="Tên dịch vụ" htmlFor="qs-name" required>
        <Input id="qs-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Giá" htmlFor="qs-price">
          <MoneyInput id="qs-price" value={price} onChange={setPrice} />
        </Field>
        <Field label="Hẹn lại sau" htmlFor="qs-recall" info={INFO.recallDays}>
          <NumberInput id="qs-recall" suffix="ngày" value={recallDays} onChange={setRecallDays} />
        </Field>
      </div>
    </QuickBox>
  );
}

export function QuickProduct({ name: initialName, onCreated, onCancel }: { name: string; onCreated: (p: Product) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState<number | null>(null);
  const [usageDays, setUsageDays] = useState<number | null>(30);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      const input = { name, price: price ?? 0, usageDays: usageDays ?? 0 };
      const r = await saveProduct(input);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Đã thêm mỹ phẩm ${name.trim()}`);
      onCreated({ id: r.data!.id, name: name.trim(), price: input.price, usageDays: input.usageDays });
    });

  return (
    <QuickBox title="Mỹ phẩm mới" topic="prod" submitLabel="Thêm mỹ phẩm" pending={pending} onSubmit={submit} onCancel={onCancel}>
      <Field label="Tên mỹ phẩm" htmlFor="qp-name" required>
        <Input id="qp-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Giá" htmlFor="qp-price">
          <MoneyInput id="qp-price" value={price} onChange={setPrice} />
        </Field>
        <Field label="Dùng hết sau" htmlFor="qp-usage" info={INFO.usageDays} required>
          <NumberInput id="qp-usage" suffix="ngày" value={usageDays} onChange={setUsageDays} />
        </Field>
      </div>
    </QuickBox>
  );
}

/** New package template. Starts with the services already on this visit, 10 sessions each. */
export function QuickPackage({
  name: initialName,
  services,
  initialServiceIds,
  onCreated,
  onCancel,
}: {
  name: string;
  services: Service[];
  initialServiceIds: number[];
  onCreated: (p: Package) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState<number | null>(null);
  const [validityDays, setValidityDays] = useState<number | null>(null);
  const [intervalDays, setIntervalDays] = useState<number | null>(null);
  const [items, setItems] = useState(() => [...new Set(initialServiceIds)].map((serviceId) => ({ serviceId, sessions: 10 as number | null })));
  const [pending, start] = useTransition();
  const byId = new Map(services.map((s) => [s.id, s]));
  const serviceItems: ComboItem[] = services.map((s) => ({ value: s.id, label: s.name, sub: fmtMoney(s.price) }));

  const submit = () =>
    start(async () => {
      if (price === null) return void toast.error("Nhập giá gói");
      const clean = items.map((i) => ({ serviceId: i.serviceId, sessions: i.sessions ?? 0 }));
      const r = await savePackage({ name, price, validityDays, intervalDays, items: clean });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Đã thêm gói ${name.trim()}`);
      onCreated({
        id: r.data!.id,
        name: name.trim(),
        price,
        validityDays: validityDays || null,
        intervalDays: intervalDays || null,
        items: clean.filter((i) => i.sessions > 0),
      });
    });

  return (
    <QuickBox title="Gói mới" topic="pkg" submitLabel="Thêm gói" pending={pending} onSubmit={submit} onCancel={onCancel}>
      <Field label="Tên gói" htmlFor="qk-name" required>
        <Input id="qk-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Trị mụn 10 buổi" />
      </Field>
      <Field label="Giá gói" htmlFor="qk-price" required>
        <MoneyInput id="qk-price" value={price} onChange={setPrice} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Hạn dùng" htmlFor="qk-validity" info={INFO.validityDays}>
          <NumberInput id="qk-validity" suffix="ngày" placeholder="Không hạn" value={validityDays} onChange={setValidityDays} />
        </Field>
        <Field label="Cách buổi" htmlFor="qk-interval" info={INFO.intervalDays}>
          <NumberInput id="qk-interval" suffix="ngày" value={intervalDays} onChange={setIntervalDays} />
        </Field>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-soft">
          Dịch vụ trong gói<span className="text-lotus"> *</span>
        </span>
        {items.length > 0 && (
          <ul className="divide-y divide-line rounded-[var(--radius-field)] border border-line">
            {items.map((it, idx) => (
              <li key={it.serviceId} className="flex items-center gap-2 py-1.5 pl-3 pr-1">
                <span className="min-w-0 flex-1 truncate">{byId.get(it.serviceId)?.name}</span>
                <div className="w-28">
                  <NumberInput
                    aria-label={`Số buổi ${byId.get(it.serviceId)?.name ?? ""}`}
                    suffix="buổi"
                    value={it.sessions}
                    onChange={(n) => setItems(items.map((x, i) => (i === idx ? { ...x, sessions: n } : x)))}
                  />
                </div>
                <button
                  type="button"
                  aria-label="Bỏ dịch vụ"
                  onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:text-lotus md:size-9"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Combobox
          items={serviceItems}
          exclude={items.map((i) => i.serviceId)}
          onSelect={(i) => setItems([...items, { serviceId: i.value, sessions: 10 }])}
          placeholder={items.length ? "Thêm dịch vụ khác" : "Chọn dịch vụ"}
        />
      </div>
    </QuickBox>
  );
}
