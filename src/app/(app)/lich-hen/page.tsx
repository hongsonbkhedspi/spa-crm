import Link from "next/link";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import type { AppointmentStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { addDays, dayStart, fmtDate, instantToTimeStr, isDateStr, relativeDay, strToDate, todayStr } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { loadAppointments, APPT_STATUS } from "../_today/appointments";
import { CalendarGrid } from "./calendar-grid";

export const metadata = { title: "Lịch hẹn" };

type SP = { date?: string; view?: string; status?: string };
const STATUSES = Object.keys(APPT_STATUS) as AppointmentStatus[];

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireUser();
  const sp = await searchParams;
  const today = todayStr();
  const date = isDateStr(sp.date) ? sp.date : today;
  const view = sp.view === "week" ? "week" : sp.view === "3day" ? "3day" : "day";
  const status = STATUSES.includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus) : null;

  const from = view === "week" ? addDays(date, -((strToDate(date).getUTCDay() + 6) % 7)) : date;
  const span = view === "week" ? 7 : view === "3day" ? 3 : 1;
  const to = addDays(from, span);

  const rows = await loadAppointments({
    scheduledAt: { gte: dayStart(from), lt: dayStart(to) },
    ...(status ? { status } : {}),
  });

  const href = (p: Partial<{ date: string; view: string; status: string | null }>) => {
    const q = new URLSearchParams();
    const d = p.date ?? date;
    const v = p.view ?? view;
    const s = p.status === undefined ? status : p.status;
    if (d !== today) q.set("date", d);
    if (v !== "day") q.set("view", v);
    if (s) q.set("status", s);
    const qs = q.toString();
    return `/lich-hen${qs ? `?${qs}` : ""}`;
  };

  const days = Array.from({ length: span }, (_, i) => addDays(from, i));
  const title =
    span > 1 ? `${fmtDate(from).slice(0, 5)} – ${fmtDate(addDays(to, -1))}` : `${relativeDay(date, today)}${date === today ? `, ${fmtDate(date)}` : ""}`;
  const inRange = today >= from && today < to;

  return (
    <>
      <PageHeader
        title="Lịch hẹn"
        topic="appt"
        actions={
          <LinkButton href={`/lich-hen/moi${date > today ? `?date=${date}` : ""}`}>
            <CalendarPlus className="size-4" /> Đặt lịch
          </LinkButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-[var(--radius-field)] border border-line-strong bg-surface">
          <Link href={href({ date: addDays(date, -span) })} aria-label="Trước" className="grid size-11 place-items-center text-ink-soft hover:text-jade-deep">
            <ChevronLeft className="size-5" />
          </Link>
          <span className="num min-w-36 px-1 text-center text-sm font-semibold">{title}</span>
          <Link href={href({ date: addDays(date, span) })} aria-label="Sau" className="grid size-11 place-items-center text-ink-soft hover:text-jade-deep">
            <ChevronRight className="size-5" />
          </Link>
        </div>
        {!inRange && (
          <Link href={href({ date: today })} className="min-h-11 content-center rounded-[var(--radius-field)] px-3 text-sm font-medium text-appt-ink hover:bg-appt-wash">
            Hôm nay
          </Link>
        )}
        <form action="/lich-hen" className="contents">
          <input
            type="date"
            name="date"
            defaultValue={date}
            aria-label="Chọn ngày"
            className="min-h-11 rounded-[var(--radius-field)] border border-line-strong bg-surface px-2 text-base"
          />
          {view !== "day" && <input type="hidden" name="view" value={view} />}
          {status && <input type="hidden" name="status" value={status} />}
          <button type="submit" className="min-h-11 rounded-[var(--radius-field)] px-3 text-sm font-medium text-appt-ink hover:bg-appt-wash">
            Xem
          </button>
        </form>
        <div className="ml-auto flex rounded-[var(--radius-field)] bg-line/50 p-1">
          {(["day", "3day", "week"] as const).map((v) => (
            <Link
              key={v}
              href={href({ view: v })}
              className={cn(
                "min-h-10 md:min-h-9 content-center rounded-[8px] px-3 text-sm font-medium",
                view === v ? "bg-surface text-appt-ink shadow-sm" : "text-ink-soft",
              )}
            >
              {v === "day" ? "Ngày" : v === "3day" ? "3 ngày" : "Tuần"}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
        <Chip href={href({ status: null })} active={!status}>
          Tất cả
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} href={href({ status: s })} active={status === s}>
            {APPT_STATUS[s].label}
          </Chip>
        ))}
      </div>

      <CalendarGrid days={days} rows={rows} today={today} now={instantToTimeStr(new Date())} dayHref={(d) => href({ date: d, view: "day" })} />
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 md:min-h-9 shrink-0 items-center rounded-full border px-3 text-sm",
        active ? "border-appt bg-appt text-white" : "border-line-strong bg-surface text-ink-soft hover:border-appt",
      )}
    >
      {children}
    </Link>
  );
}
