import Link from "next/link";
import { fmtDate, relativeDay, weekday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { APPT_STATUS, type ApptRow } from "../_today/appointments";
import { ApptBlock } from "./appt-block";
import { ApptDetail } from "./appt-detail";

/** 1px per minute. Appointments have no duration, so each block is drawn as one hour. */
const HOUR_PX = 60;
const BLOCK_MIN = 60;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

type Placed = { a: ApptRow; start: number; col: number; cols: number };

/** Google-Calendar-style overlap layout: overlapping blocks share the column width side by side. */
function layout(rows: ApptRow[]): Placed[] {
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) p.cols = ends.length;
    out.push(...cluster);
    cluster = [];
    ends = [];
  };
  for (const a of [...rows].sort((x, y) => x.time.localeCompare(y.time))) {
    const start = toMin(a.time);
    if (start >= clusterEnd) flush();
    let col = ends.findIndex((e) => e <= start);
    if (col < 0) col = ends.length;
    ends[col] = start + BLOCK_MIN;
    clusterEnd = Math.max(clusterEnd, start + BLOCK_MIN);
    cluster.push({ a, start, col, cols: 1 });
  }
  flush();
  return out;
}

function blockTone(a: ApptRow, late: boolean) {
  if (a.status === "done") return "border-jade bg-jade-wash text-jade-deep";
  if (a.status === "cancelled") return "border-line-strong bg-paper text-muted line-through";
  if (a.status === "no_show") return "border-lotus bg-lotus-wash/60 text-lotus opacity-75";
  return late ? "border-lotus bg-lotus-wash text-lotus" : "border-appt bg-appt-wash text-appt-ink";
}

export function CalendarGrid({
  days,
  rows,
  today,
  now,
  dayHref,
}: {
  days: string[];
  rows: ApptRow[];
  today: string;
  /** Current time HH:mm in Vietnam. */
  now: string;
  dayHref: (d: string) => string;
}) {
  // 1 day: roomy blocks; 3 days: full name + service; 7 days: narrow columns, given name only on phones
  const multi = days.length > 1;
  const week = days.length === 7;
  const nowMin = toMin(now);
  // 08:00–22:00 by default (the booking slots end at 21:00), widened to fit any odd-hour appointment
  const startH = Math.min(8, ...rows.map((r) => Math.floor(toMin(r.time) / 60)));
  const endH = Math.max(22, ...rows.map((r) => Math.ceil((toMin(r.time) + BLOCK_MIN) / 60)));
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);
  const height = hours.length * HOUR_PX;
  const cols = week
    ? "grid-cols-[2.5rem_repeat(7,minmax(0,1fr))]"
    : multi
      ? "grid-cols-[2.5rem_repeat(3,minmax(0,1fr))]"
      : "grid-cols-[2.75rem_minmax(0,1fr)]";

  return (
    <div className="rounded-[var(--radius-panel)] border border-appt/25 bg-surface">
      {multi && (
        <div
          className={cn(
            "sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 grid rounded-t-[var(--radius-panel)] border-b border-line bg-surface md:top-0",
            cols,
          )}
        >
          <span />
          {days.map((d) => {
            const n = rows.filter((r) => r.date === d && r.status !== "cancelled").length;
            return (
              <Link
                key={d}
                href={dayHref(d)}
                aria-label={`${relativeDay(d, today)} ${fmtDate(d)}: ${n} lịch`}
                className="flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5 hover:bg-appt-wash"
              >
                <span className={cn("text-[11px] font-medium", d === today ? "text-appt-ink" : "text-muted")}>{weekday(d)}</span>
                <span
                  className={cn(
                    "num grid size-7 place-items-center rounded-full text-sm font-semibold",
                    d === today ? "bg-appt text-white" : "text-ink",
                  )}
                >
                  {Number(d.slice(8, 10))}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <div className={cn("grid pb-2 pt-3", cols)}>
        {/* Hour labels */}
        <div className="relative" style={{ height }}>
          {hours.map((h, i) => (
            <span
              key={h}
              className="num absolute right-1.5 -translate-y-1/2 text-[11px] text-muted"
              style={{ top: i * HOUR_PX }}
            >
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>

        {days.map((d) => {
          const placed = layout(rows.filter((r) => r.date === d));
          const canBook = d >= today;
          return (
            <div key={d} className="relative border-l border-line" style={{ height }}>
              {/* Hour and half-hour lines */}
              {hours.map((h, i) => (
                <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line" style={{ top: i * HOUR_PX }}>
                  <div className="border-t border-dashed border-line/60" style={{ marginTop: HOUR_PX / 2 - 1 }} />
                </div>
              ))}

              {/* Empty half-hour slots: tap to book at that time */}
              {canBook &&
                hours.flatMap((h) =>
                  [0, 30].map((m) => {
                    const t = toTime(h * 60 + m);
                    if (d === today && h * 60 + m < nowMin - 30) return null;
                    return (
                      <Link
                        key={t}
                        href={`/lich-hen/moi?date=${d}&time=${t}`}
                        aria-label={`Đặt lịch ${t} ${fmtDate(d)}`}
                        className="absolute inset-x-0 hover:bg-appt-wash/60"
                        style={{ top: (h - startH) * HOUR_PX + (m / 60) * HOUR_PX, height: HOUR_PX / 2 }}
                      />
                    );
                  }),
                )}

              {placed.map(({ a, start, col, cols: n }) => {
                const late = a.status === "scheduled" && (d < today || (d === today && start < nowMin));
                return (
                  <ApptBlock
                    key={a.id}
                    title="Lịch hẹn"
                    label={`${a.time} ${a.customer.name}${a.serviceName ? `, ${a.serviceName}` : ""}, ${APPT_STATUS[a.status].label}`}
                    className={cn(
                      "absolute overflow-hidden rounded-[6px] border-l-[3px] text-left shadow-[0_0_0_1px_var(--color-surface)]",
                      week ? "px-1 py-0.5 text-[11px] leading-tight" : multi ? cn("py-1 text-xs leading-tight", n > 1 ? "px-1" : "px-1.5") : "px-2 py-1 text-sm leading-snug",
                      blockTone(a, late),
                    )}
                    style={{
                      top: (start - startH * 60) * (HOUR_PX / 60),
                      height: BLOCK_MIN * (HOUR_PX / 60) - 2,
                      left: `calc(${(col / n) * 100}% + 1px)`,
                      width: `calc(${100 / n}% - 3px)`,
                    }}
                    face={
                      week || multi ? (
                        <>
                          <span className="num block overflow-hidden whitespace-nowrap font-semibold tracking-tight">{a.time}</span>
                          <span className="block truncate font-semibold">
                            {/* Phones: the given name ("Hương") fits a narrow column; desktop has room for the full name */}
                            <span className="md:hidden">{a.customer.name.trim().split(/\s+/).pop()}</span>
                            <span className="hidden md:inline">{a.customer.name}</span>
                          </span>
                          {!week && a.serviceName && <span className="block truncate opacity-80">{a.serviceName}</span>}
                        </>
                      ) : (
                        <>
                          <span className="block truncate font-semibold">
                            <span className="num mr-1.5">{a.time}</span>
                            {a.customer.name}
                          </span>
                          {a.serviceName && (
                            <span className="block truncate opacity-80">
                              {a.serviceName}
                              {a.session && ` · buổi ${a.session.no}/${a.session.total}`}
                            </span>
                          )}
                        </>
                      )
                    }
                  >
                    <ApptDetail a={a} today={today} late={late} />
                  </ApptBlock>
                );
              })}

              {/* Now line */}
              {d === today && nowMin >= startH * 60 && nowMin < endH * 60 && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[1] border-t-2 border-lotus"
                  style={{ top: (nowMin - startH * 60) * (HOUR_PX / 60) }}
                >
                  <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-lotus" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
