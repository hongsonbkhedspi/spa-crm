import { cn } from "@/lib/utils";

/**
 * Package progress as a string of beads: filled = used, hollow = remaining.
 * Long packages (> 20 sessions) collapse to a slim bar so the row never wraps badly.
 */
export function Beads({
  used,
  total,
  size = "md",
  tone = "jade",
  className,
}: {
  used: number;
  total: number;
  size?: "sm" | "md";
  tone?: "jade" | "muted";
  className?: string;
}) {
  const label = `Đã dùng ${used}/${total} buổi`;
  const fill = tone === "jade" ? "bg-jade" : "bg-muted";
  const ring = tone === "jade" ? "border-jade/45" : "border-line-strong";
  if (total > 20) {
    return (
      <div role="img" aria-label={label} className={cn("flex h-2.5 w-full min-w-24 overflow-hidden rounded-full border", ring, className)}>
        <div className={fill} style={{ width: `${Math.min(100, (used / total) * 100)}%` }} />
      </div>
    );
  }
  const dot = size === "sm" ? "size-2" : "size-2.5";
  return (
    <div role="img" aria-label={label} className={cn("flex flex-wrap items-center gap-[3px]", className)}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(dot, "rounded-full border", i < used ? cn(fill, "border-transparent") : cn("bg-surface", ring))}
        />
      ))}
    </div>
  );
}

/** Beads plus the "6/10" count. */
export function SessionProgress({ used, total, size }: { used: number; total: number; size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-2">
      <Beads used={used} total={total} size={size} />
      <span className="num text-xs font-semibold text-ink-soft">
        {used}/{total}
      </span>
    </div>
  );
}
