"use client";
import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { setAppointmentStatus } from "@/actions/appointments";
import { Button, buttonClass } from "./ui/button";

/** "Khách đã đến" / "Huỷ" / "Không đến" for a scheduled appointment. */
/** `bare` renders the buttons without a wrapper so the parent can lay them out (with flex `order`). */
export function AppointmentButtons({ id, compact, bare }: { id: number; compact?: boolean; bare?: boolean }) {
  const [pending, start] = useTransition();
  const set = (status: "cancelled" | "no_show", msg: string) =>
    start(async () => {
      const r = await setAppointmentStatus(id, status);
      if (r.ok) toast.success(msg);
      else toast.error(r.error);
    });
  return (
    <div className={bare ? "contents" : "flex flex-wrap gap-1.5"}>
      <Link href={`/ghi-nhan?appointmentId=${id}`} className={buttonClass("primary", "sm", bare ? "order-1 flex-1 md:flex-none" : "")}>
        Khách đã đến
      </Link>
      <Button variant="quiet" size="sm" className={bare ? "order-3" : ""} disabled={pending} onClick={() => set("no_show", "Đã đánh dấu không đến")}>
        Không đến
      </Button>
      {!compact && (
        <Button variant="quiet" size="sm" className={bare ? "order-3" : ""} disabled={pending} onClick={() => set("cancelled", "Đã huỷ lịch hẹn")}>
          Huỷ
        </Button>
      )}
    </div>
  );
}
