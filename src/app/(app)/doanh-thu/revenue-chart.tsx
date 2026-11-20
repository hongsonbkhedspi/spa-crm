"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/format";
import type { Bucket, Source } from "@/lib/revenue";
import { SOURCE_META } from "./sources";

/** Stack order bottom → top. Jade and rose are never adjacent (they collide for red-green colour blindness). */
const ORDER: Source[] = ["pkg", "svc", "prod"];

const vn1 = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
/** 1250000 → "1,3tr" for axis ticks. */
function compact(n: number) {
  if (n >= 1e9) return `${vn1.format(n / 1e9)} tỷ`;
  if (n >= 1e6) return `${vn1.format(n / 1e6)}tr`;
  if (n >= 1e3) return `${vn1.format(n / 1e3)}k`;
  return String(n);
}

function niceMax(v: number) {
  if (v <= 0) return 1_000_000;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

const sum = (b: Bucket) => b.amounts.pkg + b.amounts.svc + b.amounts.prod;

export function RevenueChart({ buckets }: { buckets: Bucket[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...buckets.map(sum)));
  const ticks = [max, max / 2, 0];
  // Show at most ~8 x labels so they never collide at 414px.
  const every = Math.max(1, Math.ceil(buckets.length / 8));
  const shown = sel !== null ? buckets[sel] : null;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft" aria-label="Chú thích">
        {[...ORDER].reverse().map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-[3px]", SOURCE_META[s].fill)} aria-hidden />
            {SOURCE_META[s].label}
          </li>
        ))}
      </ul>

      {/* Readout of the tapped / hovered bar */}
      <div className="min-h-[4.25rem] rounded-xl bg-paper px-3 py-2 text-sm" aria-live="polite">
        {shown ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{shown.title}</span>
              <span className="num font-semibold">{fmtMoney(sum(shown))}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft">
              {[...ORDER].reverse().map((s) => (
                <span key={s} className="flex items-center gap-1">
                  <span className={cn("size-2 rounded-[2px]", SOURCE_META[s].fill)} aria-hidden />
                  {SOURCE_META[s].label} <span className="num text-ink">{fmtMoney(shown.amounts[s])}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <span className="text-muted">Chạm vào một cột để xem chi tiết</span>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        {/* y axis */}
        <div className="relative h-48 w-10 text-right text-[11px] text-muted">
          {ticks.map((t, i) => (
            <span key={i} className="num absolute right-0 -translate-y-1/2" style={{ top: `${(i / 2) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative h-48" onPointerLeave={(e) => e.pointerType === "mouse" && setSel(null)}>
          {ticks.map((_, i) => (
            <div
              key={i}
              className={cn("absolute inset-x-0 border-t", i === 2 ? "border-line-strong" : "border-dashed border-line")}
              style={{ top: `${(i / 2) * 100}%` }}
              aria-hidden
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {buckets.map((b, i) => {
              const total = sum(b);
              const parts = ORDER.filter((s) => b.amounts[s] > 0);
              return (
                <button
                  key={b.key}
                  type="button"
                  aria-label={`${b.title}: ${fmtMoney(total)}`}
                  onClick={() => setSel(i)}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setSel(i)}
                  onFocus={() => setSel(i)}
                  className={cn(
                    "group flex h-full min-w-0 flex-1 flex-col justify-end rounded-t-md px-[1px]",
                    sel === i && "bg-money-wash/70",
                  )}
                >
                  <span
                    className="flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px]"
                    style={{ height: `${(total / max) * 100}%` }}
                  >
                    {parts.map((s) => (
                      <span
                        key={s}
                        className={cn("w-full shrink-0", SOURCE_META[s].fill, sel !== null && sel !== i && "opacity-45")}
                        style={{ flexGrow: b.amounts[s], flexBasis: 0, minHeight: 2 }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <div />
        <div className="mt-1.5 flex gap-[2px] text-[11px] text-muted">
          {buckets.map((b, i) => (
            <span key={b.key} className="num min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
              {i % every === 0 ? b.label : ""}
            </span>
          ))}
        </div>
      </div>

      <details className="group text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-medium text-money-ink">Xem bảng số liệu</summary>
        <div className="overflow-x-auto">
          <table className="num w-full text-right text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="py-2 text-left font-medium">Thời gian</th>
                {ORDER.map((s) => (
                  <th key={s} className="py-2 pl-2 font-medium">
                    {SOURCE_META[s].label}
                  </th>
                ))}
                <th className="py-2 pl-2 font-medium">Tổng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {buckets.map((b) => (
                <tr key={b.key}>
                  <td className="py-1.5 text-left">{b.label}</td>
                  {ORDER.map((s) => (
                    <td key={s} className="py-1.5 pl-2">
                      {compact(b.amounts[s])}
                    </td>
                  ))}
                  <td className="py-1.5 pl-2 font-semibold">{compact(sum(b))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
