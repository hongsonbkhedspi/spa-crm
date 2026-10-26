"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Field, INFO } from "./ui/field";
import { Input } from "./ui/input";
import { Combobox } from "./ui/combobox";
import { CustomerPicker } from "./customer-picker";
import type { QuickCustomer } from "@/actions/customers";
import { getPackageTemplates, sellPackage, type PackageTemplate } from "@/actions/packages";
import { addDays, todayStr } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";

type Customer = { id: number; name: string; phone: string | null };

export function SellPackageButton({
  customer,
  label = "Bán gói",
  variant = "primary",
}: {
  customer?: Customer | null;
  label?: string;
  variant?: "primary" | "secondary";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="size-4" /> {label}
      </Button>
      {open && <SellPackageDialog customer={customer ?? null} onClose={() => setOpen(false)} />}
    </>
  );
}

function SellPackageDialog({ customer: fixed, onClose }: { customer: Customer | null; onClose: () => void }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<PackageTemplate[] | null>(null);
  const [customer, setCustomer] = useState<QuickCustomer | null>(fixed);
  const [tpl, setTpl] = useState<PackageTemplate | null>(null);
  const [price, setPrice] = useState("");
  const [sessions, setSessions] = useState<Record<number, number>>({});
  const [purchaseDate, setPurchaseDate] = useState(todayStr());
  const [expiry, setExpiry] = useState("");
  const [expiryTouched, setExpiryTouched] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    getPackageTemplates().then(setTemplates).catch(() => toast.error("Không tải được danh sách gói"));
  }, []);

  const items = useMemo(
    () => templates?.map((t) => ({ value: t.id, label: t.name, sub: fmtMoney(t.price) })) ?? [],
    [templates],
  );

  function chooseTemplate(id: number) {
    const t = templates?.find((x) => x.id === id) ?? null;
    setTpl(t);
    if (!t) return;
    setPrice(String(t.price));
    setSessions(Object.fromEntries(t.items.map((i) => [i.serviceId, i.sessions])));
    setExpiryTouched(false);
    setExpiry(t.validityDays ? addDays(purchaseDate, t.validityDays) : "");
  }

  function changePurchase(d: string) {
    setPurchaseDate(d);
    if (!expiryTouched && tpl?.validityDays && d) setExpiry(addDays(d, tpl.validityDays));
  }

  function save() {
    if (!customer) return void toast.error("Chọn khách");
    if (!tpl) return void toast.error("Chọn gói");
    start(async () => {
      const r = await sellPackage({
        customerId: customer.id,
        packageId: tpl.id,
        paidAmount: parseInt(price.replace(/\D/g, "") || "0", 10),
        purchaseDate,
        expiryDate: expiry || null,
        items: tpl.items.map((i) => ({ serviceId: i.serviceId, sessions: sessions[i.serviceId] ?? 0 })),
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Đã bán gói ${r.data!.name} cho ${customer.name}`);
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Bán gói liệu trình">
      <div
        className="flex flex-col gap-4"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            save();
          }
        }}
      >
        <Field label="Khách" required>
          {fixed ? (
            <div className="flex min-h-11 items-center rounded-[var(--radius-field)] bg-jade-wash/60 px-3 font-semibold">
              {fixed.name}
            </div>
          ) : (
            <CustomerPicker value={customer} onChange={setCustomer} autoFocus />
          )}
        </Field>

        <Field label="Gói" required>
          {tpl ? (
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius-field)] border border-line-strong pl-3">
              <span className="font-semibold">{tpl.name}</span>
              <Button variant="ghost" size="sm" onClick={() => setTpl(null)}>
                Đổi
              </Button>
            </div>
          ) : (
            <Combobox
              items={items}
              autoFocus={!!fixed}
              placeholder={templates ? "Tìm gói" : "Đang tải…"}
              clearOnSelect={false}
              onSelect={(i) => chooseTemplate(i.value)}
            />
          )}
          {templates && templates.length === 0 && (
            <p className="text-sm text-muted">Chưa có gói nào. Chủ spa tạo gói ở Danh mục → Gói.</p>
          )}
        </Field>

        {tpl && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-ink-soft">Số buổi</span>
              <ul className="divide-y divide-line rounded-[var(--radius-field)] border border-line">
                {tpl.items.map((i) => {
                  const n = sessions[i.serviceId] ?? 0;
                  const gift = n - i.sessions;
                  return (
                    <li key={i.serviceId} className="flex items-center justify-between gap-3 px-3 py-1.5">
                      <div className="min-w-0">
                        <span className="font-medium">{i.serviceName}</span>
                        {gift !== 0 && (
                          <span className={gift > 0 ? "ml-2 text-xs text-jade-deep" : "ml-2 text-xs text-lotus"}>
                            {gift > 0 ? `tặng +${gift}` : gift}
                          </span>
                        )}
                      </div>
                      <Stepper
                        value={n}
                        onChange={(v) => setSessions({ ...sessions, [i.serviceId]: v })}
                        label={i.serviceName}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Giá bán" htmlFor="sp-price">
                <Input
                  id="sp-price"
                  inputMode="numeric"
                  value={price ? new Intl.NumberFormat("vi-VN").format(parseInt(price, 10)) : ""}
                  onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field label="Ngày mua" htmlFor="sp-date">
                <Input id="sp-date" type="date" value={purchaseDate} onChange={(e) => changePurchase(e.target.value)} />
              </Field>
              <Field label="Hạn dùng" htmlFor="sp-exp" info={INFO.expiry}>
                <Input
                  id="sp-exp"
                  type="date"
                  value={expiry}
                  onChange={(e) => {
                    setExpiry(e.target.value);
                    setExpiryTouched(true);
                  }}
                />
              </Field>
            </div>
          </>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-4 mt-1 flex justify-end gap-2 border-t border-line bg-surface px-5 py-3">
          <Button variant="quiet" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={pending || !tpl || !customer}>
            {pending ? "Đang lưu…" : "Bán gói"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`Bớt 1 buổi ${label}`}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-paper md:size-9"
      >
        <Minus className="size-4" />
      </button>
      <input
        aria-label={`Số buổi ${label}`}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.min(999, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))}
        className="num w-12 rounded-md border border-line-strong py-1.5 text-center"
      />
      <button
        type="button"
        aria-label={`Thêm 1 buổi ${label}`}
        onClick={() => onChange(Math.min(999, value + 1))}
        className="grid size-11 place-items-center rounded-full text-ink-soft hover:bg-paper md:size-9"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
