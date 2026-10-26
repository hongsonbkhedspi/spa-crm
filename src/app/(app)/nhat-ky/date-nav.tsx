"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonClass } from "@/components/ui/button";
import { addDays } from "@/lib/dates";

export function DateNav({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const go = (d: string) => `/nhat-ky?date=${d}`;
  const atToday = date >= today;
  return (
    <div className="flex items-center gap-1.5">
      <Link href={go(addDays(date, -1))} className={buttonClass("secondary", "icon")} aria-label="Ngày trước">
        <ChevronLeft className="size-4" />
      </Link>
      <Input
        type="date"
        aria-label="Chọn ngày"
        value={date}
        max={today}
        onChange={(e) => e.target.value && router.push(go(e.target.value))}
        className="w-40"
      />
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
        <Link href="/nhat-ky" className={buttonClass("ghost", "sm")}>
          Hôm nay
        </Link>
      )}
    </div>
  );
}
