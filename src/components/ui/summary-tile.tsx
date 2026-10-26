import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopicChip } from "./page";
import { TOPIC, type Topic } from "./topic";

/**
 * A tinted "at a glance" tile: topic colour, label, one big value and a short note.
 * Use a row of these at the top of a page; each links to the block with the detail.
 */
export function SummaryTile({
  topic,
  icon,
  href,
  value,
  label,
  note,
  small,
}: {
  topic: Topic;
  icon?: LucideIcon;
  href: string;
  value: React.ReactNode;
  label: string;
  note?: React.ReactNode;
  /** Smaller value text, for money or dates that are wider than a count. */
  small?: boolean;
}) {
  const t = TOPIC[topic];
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-28 flex-col justify-between gap-2 rounded-[18px] border p-3.5 transition-shadow hover:ring-2 md:p-4",
        t.wash,
        t.border,
        t.ring,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-sm font-semibold leading-snug", t.ink)}>{label}</span>
        <TopicChip topic={topic} icon={icon} size="sm" />
      </div>
      <div className="min-w-0">
        <p className={cn("num font-semibold leading-tight tracking-[-0.02em]", t.ink, small ? "text-xl md:text-2xl" : "text-[2.5rem] leading-none")}>
          {value}
        </p>
        {note && <p className="mt-1.5 truncate text-xs text-ink-soft">{note}</p>}
      </div>
    </Link>
  );
}

export function SummaryRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <nav aria-label={label} className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
      {children}
    </nav>
  );
}
