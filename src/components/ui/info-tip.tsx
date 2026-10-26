"use client";
import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Info } from "lucide-react";

const canHover = () => typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

/** ⓘ next to a label. Opens on hover with a mouse, on tap on a phone. */
export function InfoTip({ text, label = "Giải thích" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        aria-label={label}
        className="inline-grid size-7 -my-1.5 place-items-center rounded-full text-muted hover:text-jade data-[state=open]:text-jade"
        onMouseEnter={() => canHover() && setOpen(true)}
        onMouseLeave={() => canHover() && setOpen(false)}
      >
        <Info className="size-4" strokeWidth={2} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          sideOffset={6}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="z-50 max-w-72 rounded-xl bg-ink px-3 py-2 text-xs leading-relaxed text-white shadow-lg"
        >
          {text}
          <Popover.Arrow className="fill-ink" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
