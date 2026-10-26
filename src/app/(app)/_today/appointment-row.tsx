import Link from "next/link";
import { Pencil } from "lucide-react";
import { fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/ui/tag";
import { ContactButtons } from "@/components/contact";
import { AppointmentButtons } from "@/components/appointment-buttons";
import { APPT_STATUS, type ApptRow } from "./appointments";

/** Service name plus "buổi 6/10" when tied to a package. */
export function ApptService({ a }: { a: ApptRow }) {
  if (!a.serviceName) return <span className="text-muted">Chưa chọn dịch vụ</span>;
  return (
    <span>
      {a.serviceName}
      {a.session && (
        <span className="num ml-1.5 whitespace-nowrap rounded-full bg-jade-wash px-1.5 py-0.5 text-xs font-semibold text-jade-deep">
          buổi {a.session.no}/{a.session.total}
        </span>
      )}
    </span>
  );
}

/**
 * One appointment: a card on phones, a single grid row on desktop.
 * The time sits in a lavender chip (red when the customer is late or the date is shown for an
 * overdue list); "buổi N/M" of a package is jade, matching the package colour.
 */
export function AppointmentRow({ a, showDate, lateIfPast }: { a: ApptRow; showDate?: string; lateIfPast?: boolean }) {
  const st = APPT_STATUS[a.status];
  const inactive = a.status === "cancelled" || a.status === "no_show";
  const late = a.status === "scheduled" && (lateIfPast || !!showDate);
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 py-3 md:grid-cols-[4.75rem_minmax(0,1.2fr)_minmax(0,1.2fr)_auto] md:gap-x-4",
        inactive && "opacity-60",
      )}
    >
      <div
        className={cn(
          "num flex min-w-[4.25rem] flex-col items-center justify-center rounded-[12px] px-2 py-1.5 font-semibold leading-tight",
          late ? "bg-lotus-wash text-lotus" : "bg-appt-wash text-appt-ink",
        )}
      >
        {showDate && <span className="text-[11px] font-medium">{showDate}</span>}
        <span className="text-base">{a.time}</span>
      </div>
      <div className="min-w-0">
        <Link href={`/khach-hang/${a.customer.id}`} className="font-semibold hover:text-cust-ink hover:underline">
          {a.customer.name}
        </Link>
        <span className="num ml-2 whitespace-nowrap text-sm text-ink-soft">{fmtPhone(a.customer.phone)}</span>
        {/* Service under the name on phones */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm md:hidden">
          <ApptService a={a} />
          {a.status !== "scheduled" && <Tag tone={st.tone}>{st.label}</Tag>}
        </div>
      </div>
      <div className="hidden min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm md:flex">
        <ApptService a={a} />
        {a.status !== "scheduled" && <Tag tone={st.tone}>{st.label}</Tag>}
        {a.note && <span className="w-full truncate text-xs text-muted">{a.note}</span>}
      </div>
      {a.note && <p className="col-span-2 truncate text-xs text-muted md:hidden">{a.note}</p>}
      <div className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:justify-end">
        {/* Phones: [Khách đã đến][Zalo][Gọi] on one row, quieter actions below. */}
        {a.status === "scheduled" && <AppointmentButtons id={a.id} bare />}
        {a.status === "scheduled" && (
          <>
            <span className="order-2 flex gap-1.5 md:hidden">
              <ContactButtons phone={a.customer.phone} />
            </span>
            <span className="order-2 h-0 basis-full md:hidden" aria-hidden />
          </>
        )}
        <Link
          href={`/lich-hen/${a.id}`}
          aria-label={`Sửa lịch hẹn của ${a.customer.name}`}
          className="order-3 grid size-11 place-items-center rounded-[var(--radius-field)] text-muted hover:bg-appt-wash hover:text-appt-ink md:size-9"
        >
          <Pencil className="size-4" />
        </Link>
      </div>
    </div>
  );
}
