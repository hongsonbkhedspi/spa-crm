import {
  BookOpen,
  CalendarDays,
  Droplet,
  Gift,
  Layers,
  Settings,
  Sparkles,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * One colour family per kind of information (see globals.css). Use the same topic for a
 * block, its nav item and its tags so the owner can read "what is this" by colour alone.
 * Class strings are written out in full so Tailwind can see them.
 */
export type Topic = "appt" | "pkg" | "prod" | "cust" | "money" | "alert" | "warn" | "neutral";

export const TOPIC: Record<
  Topic,
  { chip: string; wash: string; ink: string; border: string; text: string; ring: string }
> = {
  appt: {
    chip: "bg-appt text-white",
    wash: "bg-appt-wash",
    ink: "text-appt-ink",
    border: "border-appt/25",
    text: "text-appt",
    ring: "ring-appt/40",
  },
  pkg: {
    chip: "bg-jade text-white",
    wash: "bg-jade-wash",
    ink: "text-jade-deep",
    border: "border-jade/25",
    text: "text-jade",
    ring: "ring-jade/40",
  },
  prod: {
    chip: "bg-prod text-white",
    wash: "bg-prod-wash",
    ink: "text-prod-ink",
    border: "border-prod/25",
    text: "text-prod",
    ring: "ring-prod/40",
  },
  cust: {
    chip: "bg-cust text-white",
    wash: "bg-cust-wash",
    ink: "text-cust-ink",
    border: "border-cust/25",
    text: "text-cust",
    ring: "ring-cust/40",
  },
  money: {
    chip: "bg-money text-white",
    wash: "bg-money-wash",
    ink: "text-money-ink",
    border: "border-money/30",
    text: "text-money",
    ring: "ring-money/40",
  },
  alert: {
    chip: "bg-lotus text-white",
    wash: "bg-lotus-wash",
    ink: "text-lotus",
    border: "border-lotus/30",
    text: "text-lotus",
    ring: "ring-lotus/40",
  },
  warn: {
    chip: "bg-turmeric-bright text-white",
    wash: "bg-turmeric-wash",
    ink: "text-turmeric",
    border: "border-turmeric-bright/30",
    text: "text-turmeric-bright",
    ring: "ring-turmeric-bright/40",
  },
  neutral: {
    chip: "bg-ink-soft text-white",
    wash: "bg-paper",
    ink: "text-ink",
    border: "border-line",
    text: "text-ink-soft",
    ring: "ring-line-strong",
  },
};

/** Default icon per topic, so blocks and nav agree. */
export const TOPIC_ICON: Record<Topic, LucideIcon> = {
  appt: CalendarDays,
  pkg: Layers,
  prod: Droplet,
  cust: Users,
  money: Wallet,
  alert: TriangleAlert,
  warn: TriangleAlert,
  neutral: Settings,
};

/** Extra icons some pages use for their own topic. */
export const ICONS = { BookOpen, Gift, Sparkles };
