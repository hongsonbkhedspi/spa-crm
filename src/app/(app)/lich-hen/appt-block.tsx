"use client";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

/** An appointment block on the calendar grid; tapping it opens the full row (actions) in a sheet. */
export function ApptBlock({
  title,
  label,
  className,
  style,
  face,
  children,
}: {
  title: string;
  label: string;
  className: string;
  style: React.CSSProperties;
  face: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label={label} className={className} style={style} onClick={() => setOpen(true)}>
        {face}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={title}>
        {children}
      </Dialog>
    </>
  );
}
