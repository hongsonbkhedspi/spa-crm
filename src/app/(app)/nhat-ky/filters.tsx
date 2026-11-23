"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Combobox, type ComboItem } from "@/components/ui/combobox";
import { searchCustomers } from "@/lib/client-api";
import { Button, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * `cust` / `it` = a customer / catalog item picked from the suggestions (exact match);
 * otherwise `q` / `item` are free-text searches.
 */
export type LogFilter = { from: string; to: string; q: string; cust: string; by: string; item: string; it: string };

/** `ref` = kind letter + id: s = service, p = product, k = package. */
export type CatalogOption = { ref: string; name: string; active: boolean };
const KIND: Record<string, string> = { s: "Dịch vụ", p: "Mỹ phẩm", k: "Gói" };

/** GET form: the URL holds the filter, so results can be bookmarked and the back button works. */
export function LogFilters({
  filter,
  today,
  users,
  catalog,
  dirty,
}: {
  filter: LogFilter;
  today: string;
  users: { id: number; fullName: string }[];
  catalog: CatalogOption[];
  dirty: boolean;
}) {
  const extra = [filter.q, filter.by, filter.item].filter(Boolean).length;
  const [open, setOpen] = useState(extra > 0);
  const label = "text-xs font-medium text-ink-soft";
  const formRef = useRef<HTMLFormElement>(null);
  const custRef = useRef<HTMLInputElement>(null);
  const itRef = useRef<HTMLInputElement>(null);
  const catalogItems = useMemo<ComboItem[]>(
    () => catalog.map((c, i) => ({ value: i, label: c.name, sub: c.active ? KIND[c.ref[0]] : `${KIND[c.ref[0]]} · ngừng` })),
    [catalog],
  );
  return (
    <form ref={formRef} action="/nhat-ky" className="mb-4 rounded-[var(--radius-panel)] border border-money/30 bg-surface p-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-[10rem_10rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label className="flex flex-col gap-1">
          <span className={label}>Từ ngày</span>
          <Input type="date" name="from" defaultValue={filter.from} max={today} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={label}>Đến ngày</span>
          <Input type="date" name="to" defaultValue={filter.to} max={today} />
        </label>
        <div className={cn("col-span-2 grid-cols-2 gap-3 md:contents", open ? "grid" : "hidden")}>
          <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
            <label htmlFor="log-q" className={label}>
              Khách
            </label>
            <input ref={custRef} type="hidden" name="cust" defaultValue={filter.cust} />
            <Combobox
              id="log-q"
              name="q"
              defaultQuery={filter.q}
              placeholder="Tên hoặc SĐT"
              load={searchCustomers}
              clearOnSelect={false}
              onQueryChange={() => {
                if (custRef.current) custRef.current.value = "";
              }}
              onSelect={(c) => {
                if (custRef.current) custRef.current.value = String(c.value);
                // Let the combobox write the name into the input, then apply at once.
                setTimeout(() => formRef.current?.requestSubmit(), 0);
              }}
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1 md:col-span-1">
            <label htmlFor="log-item" className={label}>
              Dịch vụ / mỹ phẩm / gói
            </label>
            <input ref={itRef} type="hidden" name="it" defaultValue={filter.it} />
            <Combobox
              id="log-item"
              name="item"
              defaultQuery={filter.item}
              placeholder="Tên dịch vụ, mỹ phẩm, gói"
              items={catalogItems}
              clearOnSelect={false}
              onQueryChange={() => {
                if (itRef.current) itRef.current.value = "";
              }}
              onSelect={(c) => {
                if (itRef.current) itRef.current.value = catalog[c.value].ref;
                setTimeout(() => formRef.current?.requestSubmit(), 0);
              }}
            />
          </div>
          <label className="col-span-2 flex flex-col gap-1 md:col-span-1">
            <span className={label}>Người nhập</span>
            <Select name="by" defaultValue={filter.by}>
              <option value="">Tất cả</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="submit">Lọc</Button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={buttonClass("secondary", "md", "md:hidden")}
        >
          <SlidersHorizontal className="size-4" />
          {open ? "Ẩn bớt" : "Thêm điều kiện"}
          {!open && extra > 0 && <span className="num">({extra})</span>}
        </button>
        {dirty && (
          <Link href="/nhat-ky" className={buttonClass("ghost")}>
            Xoá lọc
          </Link>
        )}
      </div>
    </form>
  );
}
