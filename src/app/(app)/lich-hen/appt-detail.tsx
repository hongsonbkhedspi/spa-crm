import Link from "next/link";
import { Pencil } from "lucide-react";
import { diffDays, fmtDate, relativeDay, weekday } from "@/lib/dates";
import { fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { ContactButtons } from "@/components/contact";
import { AppointmentButtons } from "@/components/appointment-buttons";
import { ApptService } from "../_today/appointment-row";
import { APPT_STATUS, type ApptRow } from "../_today/appointments";

/** Body of the sheet opened from a calendar block: stacked details, then the actions. */
export function ApptDetail({ a, today, late }: { a: ApptRow; today: string; late: boolean }) {
  const st = APPT_STATUS[a.status];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "num grid min-w-[4.25rem] place-items-center rounded-[12px] px-2 py-2 text-base font-semibold",
            late ? "bg-lotus-wash text-lotus" : "bg-appt-wash text-appt-ink",
          )}
        >
          {a.time}
        </span>
        <div className="min-w-0">
          <Link href={`/khach-hang/${a.customer.id}`} className="block truncate text-lg font-semibold hover:text-cust-ink hover:underline">
            {a.customer.name}
          </Link>
          {a.customer.phone && <span className="num text-sm text-ink-soft">{fmtPhone(a.customer.phone)}</span>}
        </div>
      </div>

      <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted">Ngày</dt>
        <dd className="num">
          {/* "Hôm nay, 24/10/2026" near today, otherwise "T5 29/10/2026" */}
          {diffDays(a.date, today) >= -1 && diffDays(a.date, today) <= 2 ? `${relativeDay(a.date, today)}, ` : `${weekday(a.date)} `}
          {fmtDate(a.date)}
        </dd>
        <dt className="text-muted">Dịch vụ</dt>
        <dd>
          <ApptService a={a} />
        </dd>
        {a.packageName && (
          <>
            <dt className="text-muted">Gói</dt>
            <dd>{a.packageName}</dd>
          </>
        )}
        <dt className="text-muted">Trạng thái</dt>
        <dd>
          <Tag tone={late ? "lotus" : st.tone}>{late ? "Quá giờ, chưa ghi nhận" : st.label}</Tag>
        </dd>
        {a.note && (
          <>
            <dt className="text-muted">Ghi chú</dt>
            <dd className="whitespace-pre-line break-words">{a.note}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-col gap-2 border-t border-line pt-4">
        {a.status === "scheduled" && <AppointmentButtons id={a.id} />}
        <div className="flex flex-wrap gap-1.5">
          <ContactButtons phone={a.customer.phone} />
          <LinkButton href={`/lich-hen/${a.id}`} variant="secondary" size="sm">
            <Pencil className="size-4" /> Sửa lịch
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
