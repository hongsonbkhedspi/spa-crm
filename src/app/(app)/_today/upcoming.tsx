"use client";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ApptRow } from "./appointments";

export type UpcomingDay = { date: string; label: string; sub: string; items: ApptRow[] };

/** Next three days: tabs on phones, three columns on desktop. */
export function Upcoming({ days }: { days: UpcomingDay[] }) {
  const [tab, setTab] = useState(0);
  return (
    <div>
      <div role="tablist" className="mb-3 grid grid-cols-3 gap-1 rounded-[var(--radius-field)] bg-appt-wash p-1 md:hidden">
        {days.map((d, i) => (
          <button
            key={d.date}
            role="tab"
            type="button"
            aria-selected={tab === i}
            onClick={() => setTab(i)}
            className={cn(
              "min-h-11 rounded-[8px] text-sm font-medium",
              tab === i ? "bg-surface text-appt-ink shadow-sm" : "text-ink-soft",
            )}
          >
            {d.label}
            <span className="num ml-1 text-xs text-muted">{d.items.length}</span>
          </button>
        ))}
      </div>
      <div className="md:grid md:grid-cols-3 md:gap-6">
        {days.map((d, i) => (
          <div key={d.date} role="tabpanel" className={cn(tab === i ? "block" : "hidden", "md:block")}>
            <div className="mb-2 hidden items-baseline justify-between md:flex">
              <Link href={`/lich-hen?date=${d.date}`} className="font-semibold hover:text-appt-ink">
                {d.label}
              </Link>
              <span className="num text-xs text-muted">{d.sub}</span>
            </div>
            {d.items.length === 0 ? (
              <p className="py-3 text-sm text-muted">Chưa có lịch hẹn</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.items.map((a) => (
                  <li key={a.id}>
                    <Link href={`/lich-hen/${a.id}`} className="flex min-h-11 items-baseline gap-3 py-2 hover:text-appt-ink">
                      <span className="num w-12 shrink-0 rounded-md bg-appt-wash py-0.5 text-center font-semibold text-appt-ink">{a.time}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{a.customer.name}</span>
                        <span className="block truncate text-xs text-ink-soft">
                          {a.serviceName ?? "Chưa chọn dịch vụ"}
                          {a.session && ` · buổi ${a.session.no}/${a.session.total}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
