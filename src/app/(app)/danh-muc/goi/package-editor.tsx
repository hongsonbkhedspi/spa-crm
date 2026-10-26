"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxHandle, type ComboItem } from "@/components/ui/combobox";
import { Field, INFO } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/page";
import { Beads } from "@/components/ui/beads";
import { fmtMoney } from "@/lib/format";
import { savePackage } from "@/actions/catalog";
import { MoneyInput, NumberInput } from "../_components/money-input";

type Row = { key: number; serviceId: number; serviceName: string; sessions: number | null };

export type PackageDraft = {
  id?: number;
  name: string;
  price: number | null;
  validityDays: number | null;
  intervalDays: number | null;
  items: { serviceId: number; serviceName: string; sessions: number }[];
};

export function PackageEditor({
  initial,
  services,
}: {
  initial: PackageDraft;
  services: { id: number; name: string; price: number }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initial.name);
  const [price, setPrice] = useState<number | null>(initial.price);
  const [validityDays, setValidityDays] = useState<number | null>(initial.validityDays);
  const [intervalDays, setIntervalDays] = useState<number | null>(initial.intervalDays);
  const keyRef = useRef(0);
  const [rows, setRows] = useState<Row[]>(() =>
    initial.items.map((i) => ({ key: ++keyRef.current, serviceId: i.serviceId, serviceName: i.serviceName, sessions: i.sessions })),
  );
  const addRef = useRef<ComboboxHandle>(null);
  const sessionRefs = useRef(new Map<number, HTMLInputElement | null>());

  const serviceItems: ComboItem[] = services.map((s) => ({ value: s.id, label: s.name, sub: fmtMoney(s.price) }));
  const totalSessions = rows.reduce((s, r) => s + (r.sessions ?? 0), 0);
  const retail = rows.reduce((s, r) => s + (services.find((x) => x.id === r.serviceId)?.price ?? 0) * (r.sessions ?? 0), 0);

  function addService(item: ComboItem) {
    const key = ++keyRef.current;
    setRows((rs) => [...rs, { key, serviceId: item.value, serviceName: item.label, sessions: null }]);
    // Focus the new row's session count so the flow is: pick → type number → Enter → next service.
    setTimeout(() => sessionRefs.current.get(key)?.focus(), 0);
  }

  function save() {
    start(async () => {
      const r = await savePackage({
        id: initial.id,
        name,
        price: price ?? 0,
        validityDays,
        intervalDays,
        items: rows.map((r) => ({ serviceId: r.serviceId, sessions: r.sessions ?? 0 })),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Đã lưu gói");
      router.push("/danh-muc/goi");
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-5 lg:grid-cols-[1fr_320px]"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          save();
        }
      }}
    >
      <div className="flex flex-col gap-5">
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên gói" htmlFor="pk-name" required className="sm:col-span-2">
              <Input id="pk-name" autoFocus={!initial.id} value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Trị mụn 10 buổi" required />
            </Field>
            <Field label="Giá gói" htmlFor="pk-price" required>
              <MoneyInput id="pk-price" value={price} onChange={setPrice} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Hạn dùng" htmlFor="pk-validity" info={INFO.validityDays}>
                <NumberInput id="pk-validity" suffix="ngày" placeholder="Không hạn" value={validityDays} onChange={setValidityDays} />
              </Field>
              <Field label="Khoảng cách buổi" htmlFor="pk-interval" info={INFO.intervalDays}>
                <NumberInput id="pk-interval" suffix="ngày" value={intervalDays} onChange={setIntervalDays} />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel title="Dịch vụ trong gói" clip={false}>
          {rows.length > 0 && (
            <ul className="mb-3 divide-y divide-line">
              {rows.map((r) => (
                <li key={r.key} className="grid grid-cols-[1fr_120px_auto] items-center gap-3 py-2">
                  <span className="truncate font-medium">{r.serviceName}</span>
                  <div ref={(el) => void sessionRefs.current.set(r.key, el?.querySelector("input") ?? null)}>
                    <NumberInput
                      aria-label={`Số buổi ${r.serviceName}`}
                      suffix="buổi"
                      value={r.sessions}
                      onChange={(n) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, sessions: n } : x)))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
                          e.preventDefault();
                          addRef.current?.focus();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Bỏ ${r.serviceName}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                    className="grid size-11 place-items-center rounded-full text-muted hover:bg-lotus-wash hover:text-lotus md:size-9"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Combobox
            ref={addRef}
            items={serviceItems}
            exclude={rows.map((r) => r.serviceId)}
            onSelect={addService}
            placeholder={rows.length ? "Thêm dịch vụ khác" : "Chọn dịch vụ"}
          />
        </Panel>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <Panel>
          <p className="text-sm text-ink-soft">{name || "Gói mới"}</p>
          <p className="num mt-1 text-2xl font-semibold">{fmtMoney(price ?? 0)}</p>
          {totalSessions > 0 && (
            <>
              <Beads used={0} total={totalSessions} className="mt-4" />
              <p className="num mt-2 text-sm text-ink-soft">{totalSessions} buổi</p>
              {retail > 0 && price !== null && retail > price && (
                <p className="num mt-1 text-xs text-muted">Giá lẻ {fmtMoney(retail)}, khách tiết kiệm {fmtMoney(retail - price)}</p>
              )}
            </>
          )}
        </Panel>
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] flex gap-2 md:static">
          <Button variant="secondary" onClick={() => router.push("/danh-muc/goi")} className="flex-1 lg:flex-none">
            Huỷ
          </Button>
          <Button type="submit" disabled={pending} className="flex-1">
            {pending ? "Đang lưu…" : "Lưu gói"}
          </Button>
        </div>
      </aside>
    </form>
  );
}
