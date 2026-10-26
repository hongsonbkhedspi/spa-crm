"use client";
import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, INFO } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader, Empty } from "@/components/ui/page";
import { Tag } from "@/components/ui/tag";
import { fmtMoney, fold } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  deleteProduct,
  deleteService,
  saveProduct,
  saveService,
  setProductActive,
  setServiceActive,
} from "@/actions/catalog";
import { MoneyInput, NumberInput } from "./money-input";

export type CatalogRow = { id: number; name: string; price: number; days: number | null; active: boolean };

type Kind = "service" | "product";

const CFG = {
  service: {
    title: "Dịch vụ",
    noun: "dịch vụ",
    daysLabel: "Chu kỳ hẹn lại",
    daysInfo: INFO.recallDays,
    daysRequired: false,
    save: (r: Draft) => saveService({ id: r.id, name: r.name, price: r.price ?? 0, recallDays: r.days }),
    setActive: setServiceActive,
    remove: deleteService,
  },
  product: {
    title: "Mỹ phẩm",
    noun: "mỹ phẩm",
    daysLabel: "Số ngày dùng",
    daysInfo: INFO.usageDays,
    daysRequired: true,
    save: (r: Draft) => saveProduct({ id: r.id, name: r.name, price: r.price ?? 0, usageDays: r.days ?? 0 }),
    setActive: setProductActive,
    remove: deleteProduct,
  },
} as const;

type Draft = { id?: number; name: string; price: number | null; days: number | null };

export function SimpleCatalog({ kind, rows }: { kind: Kind; rows: CatalogRow[] }) {
  const cfg = CFG[kind];
  const [draft, setDraft] = useState<Draft | null>(null);
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    const f = fold(q.trim());
    return rows.filter((r) => (showInactive || r.active) && (!f || fold(r.name).includes(f)));
  }, [rows, q, showInactive]);
  const inactiveCount = rows.filter((r) => !r.active).length;

  const save = () => {
    if (!draft) return;
    start(async () => {
      const r = await cfg.save(draft);
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Đã lưu");
      setDraft(null);
    });
  };

  const act = (p: Promise<{ ok: boolean; error?: string; message?: string }>, fallback: string) =>
    start(async () => {
      const r = await p;
      if (!r.ok) toast.error(r.error);
      else toast.success(r.message ?? fallback);
    });

  return (
    <>
      <PageHeader
        title={cfg.title}
        actions={
          <Button onClick={() => setDraft({ name: "", price: null, days: null })}>
            <Plus className="size-4" /> Thêm {cfg.noun}
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder={`Tìm ${cfg.noun}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        {inactiveCount > 0 && (
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" className="size-5 accent-jade" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Hiện mục ngừng bán ({inactiveCount})
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <Empty
          action={
            rows.length === 0 && (
              <Button variant="secondary" onClick={() => setDraft({ name: "", price: null, days: null })}>
                Thêm {cfg.noun} đầu tiên
              </Button>
            )
          }
        >
          {rows.length === 0 ? `Chưa có ${cfg.noun} nào.` : "Không có mục phù hợp."}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
          <div className="hidden grid-cols-[1fr_140px_140px_220px] gap-4 border-b border-line px-4 py-2.5 text-xs font-medium text-muted md:grid">
            <span>Tên</span>
            <span className="text-right">Giá</span>
            <span className="text-right">{cfg.daysLabel}</span>
            <span />
          </div>
          <ul className="divide-y divide-line">
            {visible.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[1fr_140px_140px_220px]",
                  !r.active && "bg-paper/60",
                )}
              >
                <div className="min-w-0">
                  <span className={cn("font-medium", !r.active && "text-muted")}>{r.name}</span>
                  {!r.active && <Tag className="ml-2">Ngừng bán</Tag>}
                </div>
                <span className="num text-right font-medium md:order-none">{fmtMoney(r.price)}</span>
                <span className="num text-sm text-ink-soft md:text-right">
                  <span className="md:hidden">{cfg.daysLabel}: </span>
                  {r.days ? `${r.days} ngày` : "—"}
                </span>
                <div className="col-span-2 flex flex-wrap justify-start gap-1 md:col-span-1 md:justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setDraft({ id: r.id, name: r.name, price: r.price, days: r.days })}>
                    Sửa
                  </Button>
                  <Button
                    variant="quiet"
                    size="sm"
                    disabled={pending}
                    onClick={() => act(cfg.setActive(r.id, !r.active), r.active ? "Đã ngừng bán" : "Đã bán lại")}
                  >
                    {r.active ? "Ngừng bán" : "Bán lại"}
                  </Button>
                  <Button variant="quiet" size="sm" className="text-lotus" disabled={pending} onClick={() => act(cfg.remove(r.id), "Đã xoá")}>
                    Xoá
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title={draft?.id ? `Sửa ${cfg.noun}` : `Thêm ${cfg.noun}`}>
        {draft && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
            }}
          >
            <Field label="Tên" htmlFor="cat-name" required>
              <Input id="cat-name" autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Giá" htmlFor="cat-price">
                <MoneyInput id="cat-price" value={draft.price} onChange={(price) => setDraft({ ...draft, price })} />
              </Field>
              <Field label={cfg.daysLabel} htmlFor="cat-days" info={cfg.daysInfo} required={cfg.daysRequired}>
                <NumberInput id="cat-days" suffix="ngày" value={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
              </Field>
            </div>
            <div className="sticky bottom-0 -mx-5 mt-2 flex justify-end gap-2 border-t border-line bg-surface px-5 pt-3">
              <Button variant="quiet" onClick={() => setDraft(null)}>
                Huỷ
              </Button>
              <Button type="submit" disabled={pending}>
                Lưu
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
