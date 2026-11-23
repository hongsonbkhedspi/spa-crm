import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { addDays } from "@/lib/dates";
import { logHref } from "./href";
import type { LogFilter } from "./filters";

/** Previous / next day, shown when the filter covers a single day. Keeps the other conditions. */
export function DateNav({ filter, today }: { filter: LogFilter; today: string }) {
  const date = filter.from;
  const go = (d: string) => logHref({ ...filter, from: d, to: d });
  const atToday = date >= today;
  return (
    <div className="flex items-center gap-1.5">
      <Link href={go(addDays(date, -1))} className={buttonClass("secondary", "icon")} aria-label="Ngày trước">
        <ChevronLeft className="size-4" />
      </Link>
      <Link
        href={go(addDays(date, 1))}
        aria-disabled={atToday}
        tabIndex={atToday ? -1 : undefined}
        className={buttonClass("secondary", "icon", atToday ? "pointer-events-none opacity-40" : "")}
        aria-label="Ngày sau"
      >
        <ChevronRight className="size-4" />
      </Link>
      {date !== today && (
        <Link href={go(today)} className={buttonClass("ghost", "sm")}>
          Hôm nay
        </Link>
      )}
    </div>
  );
}
