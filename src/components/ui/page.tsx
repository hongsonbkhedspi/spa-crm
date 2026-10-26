import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOPIC, TOPIC_ICON, type Topic } from "./topic";

/** Round icon chip in the topic colour. */
export function TopicChip({
  topic,
  icon,
  size = "md",
  className,
}: {
  topic: Topic;
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const Icon = icon ?? TOPIC_ICON[topic];
  const box = size === "lg" ? "size-11" : size === "sm" ? "size-7" : "size-9";
  const glyph = size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : "size-[18px]";
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", box, TOPIC[topic].chip, className)} aria-hidden>
      <Icon className={glyph} strokeWidth={2.2} />
    </span>
  );
}

export function PageHeader({
  title,
  topic,
  icon,
  actions,
  children,
  className,
}: {
  title: string;
  /** Colours the icon chip so the page matches its nav item and blocks. */
  topic?: Topic;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {topic && <TopicChip topic={topic} icon={icon} size="lg" />}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
          {children}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * A titled block. With a `topic`, the header is tinted in the topic colour with an icon chip
 * and an optional big `count`, so the block can be recognised at a glance.
 */
export function Panel({
  title,
  topic,
  icon,
  count,
  aside,
  children,
  className,
  bodyClassName,
  id,
  clip = true,
}: {
  title?: React.ReactNode;
  topic?: Topic;
  icon?: LucideIcon;
  /** Big number at the right of the header (e.g. how many items are in the block). */
  count?: number;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  /** false when the body holds a dropdown (Combobox) that must spill outside the panel. */
  clip?: boolean;
}) {
  const t = topic ? TOPIC[topic] : null;
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-20 rounded-[var(--radius-panel)] border bg-surface",
        clip && "overflow-hidden",
        t ? t.border : "border-line",
        className,
      )}
    >
      {title && (
        <div
          className={cn(
            "flex min-h-14 items-center justify-between gap-3 rounded-t-[calc(var(--radius-panel)-1px)] px-4 py-2.5",
            t ? t.wash : "border-b border-line",
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {topic && <TopicChip topic={topic} icon={icon} size="sm" />}
            <h2 className={cn("truncate text-base font-semibold", t?.ink)}>{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {aside}
            {count !== undefined && (
              <span className={cn("num text-2xl font-semibold leading-none", t ? t.ink : "text-ink")}>{count}</span>
            )}
          </div>
        </div>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 py-6 text-sm text-muted">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** Link styled for a block header ("Xem tất cả"), in the block's topic colour. */
export function headerLinkClass(topic?: Topic) {
  return cn("text-sm font-medium underline-offset-2 hover:underline", topic ? TOPIC[topic].ink : "text-jade-deep");
}
