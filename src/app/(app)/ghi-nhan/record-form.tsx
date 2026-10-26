"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Droplet, Gift, Minus, Plus, Sparkles, Users, X, type LucideIcon } from "lucide-react";
import { CustomerPicker } from "@/components/customer-picker";
import { Combobox, type ComboboxHandle } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select, Textarea } from "@/components/ui/input";
import { Field, INFO } from "@/components/ui/field";
import { InfoTip } from "@/components/ui/info-tip";
import { Beads } from "@/components/ui/beads";
import { Tag } from "@/components/ui/tag";
import type { QuickCustomer } from "@/actions/customers";
import { addDays, fmtDate } from "@/lib/dates";
import { fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TOPIC, type Topic } from "@/components/ui/topic";
import { getCustomerPackages, saveVisit, type CustomerPackageCtx, type VisitInput } from "./actions";
import { QuickAddOption, QuickPackage, QuickProduct, QuickService } from "./quick-add";

export type Catalog = {
  services: { id: number; name: string; price: number; recallDays: number | null }[];
  products: { id: number; name: string; price: number; usageDays: number }[];
  packages: {
    id: number;
    name: string;
    price: number;
    validityDays: number | null;
    intervalDays: number | null;
    items: { serviceId: number; sessions: number }[];
  }[];
};

export type Prefill = {
  customer: QuickCustomer | null;
  appointmentId: number | null;
  serviceId: number | null;
  customerPackageId: number | null;
  appointmentLabel?: string;
};

/** "e:<itemId>" = existing package item, "n:<serviceId>" = package sold in this visit. */
type PkgChoice = string | null;
type Line = { key: number; serviceId: number; price: number; pkg: PkgChoice };
type ProductLine = { key: number; productId: number; qty: number; price: number };
type PackageSale = {
  packageId: number;
  price: number;
  expiryDate: string | null;
  items: { serviceId: number; sessions: number }[];
};
type PkgOption = {
  choice: string;
  label: string;
  remaining: number;
  total: number;
  used: number;
  expired: boolean;
  expiryDate: string | null;
  intervalDays: number | null;
  packageRef: { kind: "existing"; id: number } | { kind: "new" };
};

const TIMES = Array.from({ length: 28 }, (_, i) => {
  const m = 7 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

function defaultTime() {
  const now = new Date();
  const vn = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const m = Math.ceil((vn.getHours() * 60 + vn.getMinutes()) / 30) * 30;
  const clamped = Math.min(Math.max(m, 8 * 60), 20 * 60 + 30);
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

let keySeq = 1;

export function RecordForm({
  catalog: initialCatalog,
  prefill,
  today,
  canEditCatalog,
}: {
  catalog: Catalog;
  prefill: Prefill;
  today: string;
  /** Owner only: "+ Dịch vụ / Mỹ phẩm / Gói mới" in the search dropdowns. */
  canEditCatalog: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const serviceRef = useRef<ComboboxHandle>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Local copy so items added inline are usable at once; replaced by the server's list on refresh.
  const [catalog, setCatalog] = useState(initialCatalog);
  useEffect(() => setCatalog(initialCatalog), [initialCatalog]);
  const [quick, setQuick] = useState<{ kind: "service" | "product" | "package"; name: string } | null>(null);

  const [customer, setCustomer] = useState<QuickCustomer | null>(prefill.customer);
  const [packages, setPackages] = useState<CustomerPackageCtx[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<ProductLine[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [sale, setSale] = useState<PackageSale | null>(null);
  const [showSale, setShowSale] = useState(false);
  const [visitDate, setVisitDate] = useState(today);
  const [note, setNote] = useState("");
  const [allowExpired, setAllowExpired] = useState(false);

  const [nextOn, setNextOn] = useState(true);
  const [nextTouched, setNextTouched] = useState(false);
  const [nextDate, setNextDate] = useState(addDays(today, 14));
  const [nextTime, setNextTime] = useState(defaultTime);
  const [nextServiceId, setNextServiceId] = useState<number | null>(null);
  const [nextNote, setNextNote] = useState("");

  const services = useMemo(() => new Map(catalog.services.map((s) => [s.id, s])), [catalog.services]);
  const productMap = useMemo(() => new Map(catalog.products.map((p) => [p.id, p])), [catalog.products]);
  const packageMap = useMemo(() => new Map(catalog.packages.map((p) => [p.id, p])), [catalog.packages]);

  // Load the customer's packages whenever the customer changes.
  useEffect(() => {
    setPackages([]);
    setAllowExpired(false);
    if (!customer) return;
    let alive = true;
    getCustomerPackages(customer.id).then((p) => {
      if (!alive) return;
      setPackages(p);
      // Coming from an appointment: add its service once packages are known.
      if (prefill.serviceId && customer.id === prefill.customer?.id) {
        setLines((ls) => (ls.length ? ls : [makeLine(prefill.serviceId!, p, [], null, prefill.customerPackageId)]));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.id]);

  useEffect(() => {
    if (customer) serviceRef.current?.focus();
  }, [customer]);

  /** All package options for a service, with remaining counts after this form's other lines. */
  function optionsFor(serviceId: number, pkgs: CustomerPackageCtx[], currentLines: Line[], s: PackageSale | null, exceptKey?: number): PkgOption[] {
    const usedInForm = (choice: string) => currentLines.filter((l) => l.pkg === choice && l.key !== exceptKey).length;
    const opts: PkgOption[] = [];
    for (const cp of pkgs) {
      for (const it of cp.items) {
        if (it.serviceId !== serviceId) continue;
        const choice = `e:${it.id}`;
        const used = it.used + usedInForm(choice);
        opts.push({
          choice,
          label: cp.name,
          remaining: it.total - used,
          total: it.total,
          used,
          expired: cp.status === "expired" || (!!cp.expiryDate && cp.expiryDate < visitDate),
          expiryDate: cp.expiryDate,
          intervalDays: cp.intervalDays,
          packageRef: { kind: "existing", id: cp.id },
        });
      }
    }
    if (s) {
      const it = s.items.find((i) => i.serviceId === serviceId);
      const tpl = packageMap.get(s.packageId);
      if (it && tpl) {
        const choice = `n:${serviceId}`;
        const used = usedInForm(choice);
        opts.push({
          choice,
          label: `${tpl.name} (mới)`,
          remaining: it.sessions - used,
          total: it.sessions,
          used,
          expired: false,
          expiryDate: s.expiryDate,
          intervalDays: tpl.intervalDays,
          packageRef: { kind: "new" },
        });
      }
    }
    return opts;
  }

  function makeLine(serviceId: number, pkgs: CustomerPackageCtx[], current: Line[], s: PackageSale | null, preferPackageId?: number | null): Line {
    const svc = services.get(serviceId);
    const opts = optionsFor(serviceId, pkgs, current, s).filter((o) => o.remaining > 0);
    const preferred =
      (preferPackageId && opts.find((o) => o.packageRef.kind === "existing" && o.packageRef.id === preferPackageId)) ||
      opts.find((o) => !o.expired); // earliest expiry first (server order)
    return { key: keySeq++, serviceId, price: svc?.price ?? 0, pkg: preferred ? preferred.choice : null };
  }

  function addService(serviceId: number) {
    setLines((ls) => [...ls, makeLine(serviceId, packages, ls, sale)]);
  }

  function updateLine(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  /** `tpl` is passed for a package created inline, before `packageMap` has it. */
  function chooseSale(packageId: number, tpl = packageMap.get(packageId)) {
    if (!tpl) return;
    const s: PackageSale = {
      packageId,
      price: tpl.price,
      expiryDate: tpl.validityDays ? addDays(visitDate, tpl.validityDays) : null,
      items: tpl.items.map((i) => ({ ...i })),
    };
    setSale(s);
    // First session of the new package can be deducted right away.
    setLines((ls) =>
      ls.map((l) => (l.pkg === null && s.items.some((i) => i.serviceId === l.serviceId) ? { ...l, pkg: `n:${l.serviceId}` } : l)),
    );
  }

  function removeSale() {
    setSale(null);
    setShowSale(false);
    setQuick((q) => (q?.kind === "package" ? null : q));
    setLines((ls) => ls.map((l) => (l.pkg?.startsWith("n:") ? { ...l, pkg: null } : l)));
  }

  // ---- Derived values -----------------------------------------------------

  const lineOptions = useMemo(
    () => new Map(lines.map((l) => [l.key, optionsFor(l.serviceId, packages, lines, sale, l.key)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, packages, sale, visitDate],
  );
  const chosenOption = (l: Line) => (l.pkg ? lineOptions.get(l.key)?.find((o) => o.choice === l.pkg) ?? null : null);
  const usesExpired = lines.some((l) => chosenOption(l)?.expired);

  const total =
    lines.reduce((s, l) => s + (l.pkg ? 0 : l.price), 0) +
    products.reduce((s, p) => s + p.price, 0) +
    (sale?.price ?? 0);

  // Suggested next appointment: package interval if a session came from a package, else smallest recall.
  const suggestion = useMemo(() => {
    const pkgLine = lines.find((l) => l.pkg);
    const opt = pkgLine ? chosenOption(pkgLine) : null;
    if (pkgLine && opt?.intervalDays) {
      return { days: opt.intervalDays, serviceId: pkgLine.serviceId, why: `cách buổi ${opt.intervalDays} ngày của gói` };
    }
    const recalls = lines
      .map((l) => ({ l, d: services.get(l.serviceId)?.recallDays }))
      .filter((x): x is { l: Line; d: number } => !!x.d);
    if (recalls.length) {
      const min = recalls.reduce((a, b) => (b.d < a.d ? b : a));
      return { days: min.d, serviceId: min.l.serviceId, why: `chu kỳ ${min.d} ngày của dịch vụ` };
    }
    return { days: 14, serviceId: lines[0]?.serviceId ?? null, why: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, lineOptions, services]);

  useEffect(() => {
    if (nextTouched) return;
    setNextDate(addDays(visitDate, suggestion.days));
    setNextServiceId(suggestion.serviceId);
  }, [suggestion, visitDate, nextTouched]);

  /** The package the next appointment should be tied to (if the planned service comes from one). */
  function nextPackageRef(): VisitInput["next"] extends infer N ? (N extends { pkg: infer P } ? P : never) : never {
    if (!nextServiceId) return null;
    const line = lines.find((l) => l.serviceId === nextServiceId && l.pkg);
    const opt = line ? chosenOption(line) : null;
    if (opt) {
      if (opt.packageRef.kind === "new") return { kind: "new" };
      // Only link when sessions will remain after today.
      if (opt.remaining - 1 > 0) return { kind: "existing", id: opt.packageRef.id };
      return null;
    }
    const cp = packages.find((p) => p.items.some((i) => i.serviceId === nextServiceId && i.used < i.total));
    if (cp) return { kind: "existing", id: cp.id };
    if (sale?.items.some((i) => i.serviceId === nextServiceId)) return { kind: "new" };
    return null;
  }

  // ---- Save ---------------------------------------------------------------

  function reset() {
    setQuick(null);
    setCustomer(null);
    setLines([]);
    setProducts([]);
    setShowProducts(false);
    setSale(null);
    setShowSale(false);
    setNote("");
    setAllowExpired(false);
    setNextOn(true);
    setNextTouched(false);
    setNextNote("");
    setVisitDate(today);
    window.scrollTo({ top: 0 });
  }

  function save() {
    if (pending) return;
    if (!customer) return void toast.error("Chọn khách trước");
    if (!lines.length && !products.length && !sale) return void toast.error("Chọn ít nhất một dịch vụ");
    if (usesExpired && !allowExpired) return void toast.error("Xác nhận trừ buổi của gói đã hết hạn");
    for (const l of lines) {
      const o = chosenOption(l);
      if (l.pkg && o && o.remaining <= 0) return void toast.error(`${services.get(l.serviceId)?.name}: gói đã hết buổi`);
    }
    const payload: VisitInput = {
      customerId: customer.id,
      visitDate,
      note,
      appointmentId: prefill.appointmentId,
      allowExpired,
      lines: lines.map((l) => ({
        serviceId: l.serviceId,
        price: l.pkg ? 0 : l.price,
        pkg: !l.pkg
          ? null
          : l.pkg.startsWith("e:")
            ? { kind: "existing", itemId: Number(l.pkg.slice(2)) }
            : { kind: "new", serviceId: Number(l.pkg.slice(2)) },
      })),
      products: products.map((p) => ({ productId: p.productId, quantity: p.qty, price: p.price })),
      packageSale: sale,
      next: nextOn
        ? { date: nextDate, time: nextTime, serviceId: nextServiceId, pkg: nextPackageRef(), note: nextNote }
        : null,
    };
    start(async () => {
      const r = await saveVisit(payload);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Đã lưu");
      if (prefill.appointmentId) router.push("/");
      else {
        reset();
        router.refresh();
      }
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const serviceItems = useMemo(
    () => catalog.services.map((s) => ({ value: s.id, label: s.name, sub: fmtMoney(s.price) })),
    [catalog.services],
  );
  const productItems = useMemo(
    () => catalog.products.map((p) => ({ value: p.id, label: p.name, sub: fmtMoney(p.price) })),
    [catalog.products],
  );
  const packageItems = useMemo(
    () => catalog.packages.map((p) => ({ value: p.id, label: p.name, sub: fmtMoney(p.price) })),
    [catalog.packages],
  );

  // ---- Render -------------------------------------------------------------

  return (
    <div ref={formRef} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex flex-col gap-5">
        {/* Customer */}
        <Section title="Khách" topic="cust" icon={Users}>
          {prefill.appointmentLabel && (
            <Tag tone="jade" className="mb-2">
              {prefill.appointmentLabel}
            </Tag>
          )}
          <CustomerPicker id="customer" value={customer} onChange={setCustomer} autoFocus={!prefill.customer} />
          {packages.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {packages.map((cp) => (
                <PackageCard key={cp.id} cp={cp} visitDate={visitDate} />
              ))}
            </ul>
          )}
        </Section>

        {/* Services */}
        <Section title="Dịch vụ" topic="pkg" icon={Sparkles}>
          {quick?.kind === "service" ? (
            <QuickService
              name={quick.name}
              onCancel={() => setQuick(null)}
              onCreated={(s) => {
                setQuick(null);
                setCatalog((c) => ({ ...c, services: [...c.services, s].sort((a, b) => a.name.localeCompare(b.name, "vi")) }));
                // A brand-new service is in no package yet, so no package choice to make
                setLines((ls) => [...ls, { key: keySeq++, serviceId: s.id, price: s.price, pkg: null }]);
              }}
            />
          ) : (
            <Combobox
              ref={serviceRef}
              items={serviceItems}
              onSelect={(i) => addService(i.value)}
              placeholder="Tìm dịch vụ"
              id="service"
              footer={
                canEditCatalog
                  ? (q, close) => (
                      <QuickAddOption label="Dịch vụ mới" q={q} topic="pkg" onClick={() => (close(), setQuick({ kind: "service", name: q.trim() }))} />
                    )
                  : undefined
              }
            />
          )}
          {lines.length > 0 && (
            <ul className="mt-3 divide-y divide-line rounded-[var(--radius-field)] border border-line">
              {lines.map((l) => {
                const opts = lineOptions.get(l.key) ?? [];
                const available = opts.filter((o) => o.remaining > 0 || o.choice === l.pkg);
                const chosen = chosenOption(l);
                return (
                  <li key={l.key} className="flex flex-col gap-2 p-3">
                    <div className="flex items-center gap-2">
                      <span className="flex-1 font-medium">{services.get(l.serviceId)?.name}</span>
                      <MoneyInput
                        aria-label="Giá"
                        className="w-32"
                        value={l.pkg ? 0 : l.price}
                        disabled={!!l.pkg}
                        onChange={(v) => updateLine(l.key, { price: v })}
                      />
                      <RemoveButton onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} />
                    </div>
                    {available.length > 0 && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                        <label className="flex min-h-9 items-center gap-2">
                          <Checkbox
                            checked={!!l.pkg}
                            onChange={(e) =>
                              updateLine(l.key, {
                                pkg: e.target.checked ? (available.find((o) => !o.expired) ?? available[0]).choice : null,
                                price: services.get(l.serviceId)?.price ?? l.price,
                              })
                            }
                          />
                          Trừ buổi gói
                        </label>
                        <InfoTip text={INFO.usePackage} />
                        {available.length > 1 && l.pkg ? (
                          <Select
                            aria-label="Chọn gói"
                            value={l.pkg}
                            onChange={(e) => updateLine(l.key, { pkg: e.target.value })}
                            className="min-h-9 w-auto py-1 text-sm"
                          >
                            {available.map((o) => (
                              <option key={o.choice} value={o.choice}>
                                {o.label} · còn {o.remaining}/{o.total}
                                {o.expiryDate ? ` · HSD ${fmtDate(o.expiryDate)}` : ""}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          chosen && (
                            <span className="text-ink-soft">
                              {chosen.label} · buổi {chosen.used + 1}/{chosen.total}
                            </span>
                          )
                        )}
                        {chosen?.expired && <Tag tone="lotus">Gói đã hết hạn</Tag>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {usesExpired && (
            <label className="mt-3 flex items-start gap-2 rounded-[var(--radius-field)] bg-lotus-wash p-3 text-sm text-lotus">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span className="flex-1">Có buổi trừ vào gói đã hết hạn.</span>
              <span className="flex items-center gap-2 font-medium">
                <Checkbox checked={allowExpired} onChange={(e) => setAllowExpired(e.target.checked)} />
                Vẫn trừ
              </span>
            </label>
          )}
        </Section>

        {/* Products */}
        {showProducts || products.length ? (
          <Section title="Mỹ phẩm" topic="prod" icon={Droplet} onClose={products.length ? undefined : () => (setShowProducts(false), setQuick((q) => (q?.kind === "product" ? null : q)))}>
            {quick?.kind === "product" ? (
              <QuickProduct
                name={quick.name}
                onCancel={() => setQuick(null)}
                onCreated={(p) => {
                  setQuick(null);
                  setCatalog((c) => ({ ...c, products: [...c.products, p].sort((a, b) => a.name.localeCompare(b.name, "vi")) }));
                  setProducts((ps) => [...ps, { key: keySeq++, productId: p.id, qty: 1, price: p.price }]);
                }}
              />
            ) : (
              <Combobox
                items={productItems}
                autoFocus={products.length === 0}
                onSelect={(i) => {
                  const p = productMap.get(i.value)!;
                  setProducts((ps) => [...ps, { key: keySeq++, productId: p.id, qty: 1, price: p.price }]);
                }}
                placeholder="Tìm mỹ phẩm"
                footer={
                  canEditCatalog
                    ? (q, close) => (
                        <QuickAddOption label="Mỹ phẩm mới" q={q} topic="prod" onClick={() => (close(), setQuick({ kind: "product", name: q.trim() }))} />
                      )
                    : undefined
                }
              />
            )}
            {products.length > 0 && (
              <ul className="mt-3 divide-y divide-line rounded-[var(--radius-field)] border border-line">
                {products.map((p) => {
                  const prod = productMap.get(p.productId)!;
                  return (
                    <li key={p.key} className="flex flex-wrap items-center gap-2 p-3">
                      <span className="min-w-0 basis-full font-medium sm:basis-auto sm:flex-1">{prod.name}</span>
                      <Stepper
                        value={p.qty}
                        onChange={(qty) =>
                          setProducts((ps) => ps.map((x) => (x.key === p.key ? { ...x, qty, price: prod.price * qty } : x)))
                        }
                      />
                      <MoneyInput
                        aria-label="Thành tiền"
                        className="w-0 min-w-0 flex-1 sm:w-32 sm:flex-none"
                        value={p.price}
                        onChange={(v) => setProducts((ps) => ps.map((x) => (x.key === p.key ? { ...x, price: v } : x)))}
                      />
                      <RemoveButton onClick={() => setProducts((ps) => ps.filter((x) => x.key !== p.key))} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        ) : null}

        {/* Package sale */}
        {showSale || sale ? (
          <Section title="Bán gói liệu trình" topic="pkg" icon={Gift} onClose={removeSale}>
            {!sale && quick?.kind === "package" ? (
              <QuickPackage
                name={quick.name}
                services={catalog.services}
                initialServiceIds={lines.map((l) => l.serviceId)}
                onCancel={() => setQuick(null)}
                onCreated={(p) => {
                  setQuick(null);
                  setCatalog((c) => ({ ...c, packages: [...c.packages, p].sort((a, b) => a.name.localeCompare(b.name, "vi")) }));
                  chooseSale(p.id, p);
                }}
              />
            ) : !sale ? (
              <Combobox
                items={packageItems}
                autoFocus
                onSelect={(i) => chooseSale(i.value)}
                placeholder="Chọn gói"
                footer={
                  canEditCatalog
                    ? (q, close) => (
                        <QuickAddOption label="Gói mới" q={q} topic="pkg" onClick={() => (close(), setQuick({ kind: "package", name: q.trim() }))} />
                      )
                    : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{packageMap.get(sale.packageId)?.name}</span>
                  <Button variant="quiet" size="sm" onClick={() => setSale(null)}>
                    Đổi gói
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Giá bán">
                    <MoneyInput value={sale.price} onChange={(v) => setSale({ ...sale, price: v })} />
                  </Field>
                  <Field label="Hạn dùng" info={INFO.expiry}>
                    <Input
                      type="date"
                      value={sale.expiryDate ?? ""}
                      onChange={(e) => setSale({ ...sale, expiryDate: e.target.value || null })}
                    />
                  </Field>
                </div>
                <ul className="divide-y divide-line rounded-[var(--radius-field)] border border-line">
                  {sale.items.map((it, idx) => (
                    <li key={it.serviceId} className="flex items-center gap-2 p-3">
                      <span className="flex-1">{services.get(it.serviceId)?.name ?? "Dịch vụ"}</span>
                      <Stepper
                        value={it.sessions}
                        suffix="buổi"
                        onChange={(n) =>
                          setSale({ ...sale, items: sale.items.map((x, i) => (i === idx ? { ...x, sessions: n } : x)) })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        ) : null}

        {(!showProducts && !products.length) || (!showSale && !sale) ? (
          <div className="flex flex-wrap gap-2">
            {!showProducts && !products.length && (
              <Button variant="secondary" className="border-prod/40 text-prod-ink hover:border-prod hover:text-prod-ink" onClick={() => setShowProducts(true)}>
                <Plus className="size-4" /> Mỹ phẩm
              </Button>
            )}
            {!showSale && !sale && (
              <Button variant="secondary" className="border-jade/40 text-jade-deep" onClick={() => setShowSale(true)}>
                <Plus className="size-4" /> Bán gói
              </Button>
            )}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="Ngày" htmlFor="visitDate">
            <Input id="visitDate" type="date" value={visitDate} max={today} onChange={(e) => setVisitDate(e.target.value || today)} />
          </Field>
          <Field label="Ghi chú" htmlFor="note">
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Right column: next appointment + save */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4">
        <section className="overflow-hidden rounded-[var(--radius-panel)] border border-appt/25 bg-surface">
          <label className="flex min-h-14 items-center justify-between gap-3 bg-appt-wash px-4">
            <span className="flex items-center gap-2.5 text-base font-semibold text-appt-ink">
              <SectionChip topic="appt" icon={CalendarDays} />
              Hẹn lần tới
            </span>
            <Toggle checked={nextOn} onChange={setNextOn} label="Hẹn lần tới" />
          </label>
          {nextOn && (
            <div className="flex flex-col gap-3 p-4">
              <Field label="Ngày" htmlFor="nextDate" info={suggestion.why ? `Gợi ý theo ${suggestion.why}.` : undefined}>
                <Input
                  id="nextDate"
                  type="date"
                  value={nextDate}
                  min={visitDate}
                  onChange={(e) => {
                    setNextTouched(true);
                    setNextDate(e.target.value);
                  }}
                />
              </Field>
              <div className="flex gap-1.5">
                {[7, 14, 30].map((d) => (
                  <Button
                    key={d}
                    variant="secondary"
                    size="sm"
                    className={cn("flex-1", nextDate === addDays(visitDate, d) && "border-appt bg-appt text-white hover:bg-appt hover:text-white")}
                    onClick={() => {
                      setNextTouched(true);
                      setNextDate(addDays(visitDate, d));
                    }}
                  >
                    +{d} ngày
                  </Button>
                ))}
              </div>
              <Field label="Giờ" htmlFor="nextTime">
                <Select id="nextTime" value={nextTime} onChange={(e) => setNextTime(e.target.value)}>
                  {TIMES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Dịch vụ dự kiến" htmlFor="nextService">
                <Select
                  id="nextService"
                  value={nextServiceId ?? ""}
                  onChange={(e) => {
                    setNextTouched(true);
                    setNextServiceId(e.target.value ? Number(e.target.value) : null);
                  }}
                >
                  <option value="">—</option>
                  {catalog.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Input aria-label="Ghi chú lịch hẹn" placeholder="Ghi chú lịch hẹn" value={nextNote} onChange={(e) => setNextNote(e.target.value)} />
            </div>
          )}
        </section>

        {/* Save bar: pinned above the tab bar on phones, in the column on desktop */}
        <div className="fixed inset-x-0 z-20 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-2.5 backdrop-blur [bottom:calc(env(safe-area-inset-bottom)+3.75rem)] md:static md:flex-col md:items-stretch md:rounded-[var(--radius-panel)] md:border md:border-money/30 md:bg-money-wash md:p-4">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between">
            <span className="text-xs font-medium text-money-ink md:text-sm">Tổng thu</span>
            <span className="num text-lg font-semibold text-money-ink md:text-xl">{fmtMoney(total)}</span>
          </div>
          <Button className="flex-1 md:w-full" onClick={save} disabled={pending}>
            {pending ? "Đang lưu…" : "Lưu"}
            <kbd className="ml-2 hidden rounded bg-white/15 px-1.5 text-xs font-normal md:inline">Ctrl+Enter</kbd>
          </Button>
        </div>
        {/* Room so the pinned bar never covers the last field on phones */}
        <div className="h-16 md:hidden" aria-hidden />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Section({
  title,
  topic,
  icon,
  children,
  onClose,
}: {
  title: string;
  topic: Topic;
  icon: LucideIcon;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const t = TOPIC[topic];
  return (
    <section className={cn("rounded-[var(--radius-panel)] border bg-surface", t.border)}>
      {/* No overflow-hidden: the Combobox dropdowns inside must spill past the section */}
      <div className={cn("flex min-h-14 items-center justify-between rounded-t-[calc(var(--radius-panel)-1px)] px-4", t.wash)}>
        <h2 className={cn("flex items-center gap-2.5 text-base font-semibold", t.ink)}>
          <SectionChip topic={topic} icon={icon} />
          {title}
        </h2>
        {onClose && <RemoveButton onClick={onClose} label={`Bỏ ${title.toLowerCase()}`} />}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function SectionChip({ topic, icon: Icon }: { topic: Topic; icon: LucideIcon }) {
  return (
    <span className={cn("grid size-7 place-items-center rounded-full", TOPIC[topic].chip)} aria-hidden>
      <Icon className="size-3.5" strokeWidth={2.2} />
    </span>
  );
}

function PackageCard({ cp, visitDate }: { cp: CustomerPackageCtx; visitDate: string }) {
  const expired = cp.status === "expired" || (!!cp.expiryDate && cp.expiryDate < visitDate);
  return (
    <li className={cn("rounded-[var(--radius-field)] px-3 py-2.5", expired ? "bg-lotus-wash/60" : "bg-jade-wash/60")}>
      {cp.items.map((it) => (
        <div key={it.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">
            {cp.items.length > 1 ? `${cp.name} · ${it.serviceName}` : cp.name}
          </span>
          <span className="num text-sm text-ink-soft">
            còn {it.total - it.used}/{it.total}
          </span>
          {cp.expiryDate && (
            <span className={cn("num text-sm", expired ? "font-medium text-lotus" : "text-ink-soft")}>
              HSD {fmtDate(cp.expiryDate)}
            </span>
          )}
          <Beads used={it.used} total={it.total} size="sm" className="basis-full" />
        </div>
      ))}
    </li>
  );
}

function MoneyInput({
  value,
  onChange,
  className,
  ...rest
}: { value: number; onChange: (v: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <Input
      {...rest}
      inputMode="numeric"
      className={cn("num text-right", className)}
      value={value ? value.toLocaleString("vi-VN") : "0"}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => onChange(parseInt(e.target.value.replace(/\D/g, "") || "0", 10))}
    />
  );
}

function Stepper({ value, onChange, suffix }: { value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Giảm"
        onClick={() => onChange(Math.max(1, value - 1))}
        className="grid size-11 place-items-center rounded-full border border-line-strong md:size-9"
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        aria-label="Số lượng"
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => onChange(Math.max(1, parseInt(e.target.value.replace(/\D/g, "") || "1", 10)))}
        className="num h-11 w-12 rounded-[var(--radius-field)] border border-line-strong text-center md:h-9"
      />
      <button
        type="button"
        aria-label="Tăng"
        onClick={() => onChange(value + 1)}
        className="grid size-11 place-items-center rounded-full border border-line-strong md:size-9"
      >
        <Plus className="size-4" />
      </button>
      {suffix && <span className="ml-1 text-sm text-ink-soft">{suffix}</span>}
    </div>
  );
}

function RemoveButton({ onClick, label = "Xoá" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-paper hover:text-lotus md:size-9"
    >
      <X className="size-4" />
    </button>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-appt" : "bg-line-strong")}
    >
      <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-[left]", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}
