import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "md" | "sm" | "icon";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none transition-colors disabled:opacity-50 disabled:pointer-events-none rounded-[var(--radius-field)]";

const variants: Record<Variant, string> = {
  primary: "bg-jade text-white hover:bg-jade-deep active:bg-jade-deep",
  secondary: "bg-surface text-ink border border-line-strong hover:border-jade hover:text-jade-deep",
  ghost: "text-jade-deep hover:bg-jade-wash",
  quiet: "text-ink-soft hover:bg-line/60 hover:text-ink",
  danger: "bg-surface text-lotus border border-lotus/40 hover:bg-lotus-wash",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm",
  sm: "min-h-11 md:min-h-9 px-3 text-sm",
  icon: "size-11 md:size-9",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...props} />;
});

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
