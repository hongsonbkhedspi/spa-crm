import { cn } from "@/lib/utils";

/** jade/turmeric/lotus are status tones; appt/prod/cust/money tag an item with its topic colour. */
type Tone = "jade" | "turmeric" | "lotus" | "neutral" | "appt" | "prod" | "cust" | "money";

const tones: Record<Tone, string> = {
  jade: "bg-jade-wash text-jade-deep",
  turmeric: "bg-turmeric-wash text-turmeric",
  lotus: "bg-lotus-wash text-lotus",
  neutral: "bg-paper text-ink-soft border border-line",
  appt: "bg-appt-wash text-appt-ink",
  prod: "bg-prod-wash text-prod-ink",
  cust: "bg-cust-wash text-cust-ink",
  money: "bg-money-wash text-money-ink",
};

export function Tag({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

const badge: Record<"alert" | "appt" | "pkg" | "prod", string> = {
  alert: "bg-lotus",
  appt: "bg-appt",
  pkg: "bg-jade",
  prod: "bg-prod",
};

/** Small count bubble. Coloured by topic so a badge on "Mỹ phẩm" is pink, on "Gói" is jade. */
export function CountBadge({ n, className, topic = "alert" }: { n: number; className?: string; topic?: keyof typeof badge }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "num inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold leading-5 text-white",
        badge[topic],
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
