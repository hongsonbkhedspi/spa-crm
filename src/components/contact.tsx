import { Phone } from "lucide-react";
import { zaloLink } from "@/lib/format";
import { cn } from "@/lib/utils";

const btn =
  "inline-flex min-h-11 md:min-h-9 items-center gap-1.5 rounded-[var(--radius-field)] border border-line-strong bg-surface px-3 text-sm font-medium hover:border-jade hover:text-jade-deep";

export function ZaloButton({ phone, className }: { phone: string | null; className?: string }) {
  if (!phone) return null;
  return (
    <a href={zaloLink(phone)} target="_blank" rel="noopener" className={cn(btn, className)}>
      <span className="grid size-4 place-items-center rounded bg-[#0068ff] text-[9px] font-bold leading-none text-white">Z</span>
      Zalo
    </a>
  );
}

export function CallButton({ phone, className }: { phone: string | null; className?: string }) {
  if (!phone) return null;
  return (
    <a href={`tel:${phone}`} className={cn(btn, className)}>
      <Phone className="size-4" />
      Gọi
    </a>
  );
}

export function ContactButtons({ phone }: { phone: string | null }) {
  return (
    <>
      <ZaloButton phone={phone} />
      <CallButton phone={phone} />
    </>
  );
}
