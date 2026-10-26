"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Centered dialog on desktop, bottom sheet on phones. */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <D.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex max-h-[92dvh] flex-col bg-surface shadow-2xl focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-[20px] pb-safe",
            "md:inset-auto md:left-1/2 md:top-[12vh] md:w-full md:max-w-lg md:-translate-x-1/2 md:rounded-[var(--radius-panel)] md:pb-0",
            className,
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
            <D.Title className="text-lg font-semibold">{title}</D.Title>
            <D.Close className="grid size-11 place-items-center rounded-full text-muted hover:bg-paper" aria-label="Đóng">
              <X className="size-5" />
            </D.Close>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
