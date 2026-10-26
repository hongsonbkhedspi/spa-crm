"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { RecipientStatus } from "@prisma/client";
import { deleteCampaign, markRecipient } from "@/actions/campaigns";
import { getSender } from "@/lib/messaging/sender";
import { fmtPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Tag } from "@/components/ui/tag";

type Recipient = { id: number; name: string; phone: string; message: string; status: RecipientStatus };

export function SendList({ campaignId, recipients }: { campaignId: number; recipients: Recipient[] }) {
  const router = useRouter();
  const sender = useMemo(() => getSender(), []);
  const [statuses, setStatuses] = useState<Record<number, RecipientStatus>>(() =>
    Object.fromEntries(recipients.map((r) => [r.id, r.status])),
  );
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, start] = useTransition();
  const buttons = useRef(new Map<number, HTMLButtonElement>());

  const total = recipients.length;
  const sent = recipients.filter((r) => statuses[r.id] === "sent").length;
  const skipped = recipients.filter((r) => statuses[r.id] === "skipped").length;
  const nextPending = recipients.find((r) => statuses[r.id] === "pending");

  const persist = (id: number, status: RecipientStatus) =>
    start(async () => {
      const r = await markRecipient(id, status);
      if (!r.ok) toast.error(r.error);
    });

  /**
   * Must stay synchronous up to sender.send(): iOS Safari only allows clipboard
   * writes and window.open inside the original tap, before any await.
   */
  function onSend(r: Recipient) {
    const outcome = sender.send({ phone: r.phone, text: r.message });
    if (!outcome.copied) toast.error("Không chép được tin nhắn, hãy chép tay");
    setLastSent(r.id);
    if (statuses[r.id] !== "sent") {
      setStatuses((s) => ({ ...s, [r.id]: "sent" }));
      persist(r.id, "sent");
    }
  }

  function onSkip(r: Recipient) {
    setStatuses((s) => ({ ...s, [r.id]: "skipped" }));
    persist(r.id, "skipped");
    focusNext(r.id);
  }

  const focusNext = useCallback(
    (afterId?: number) => {
      const list = afterId ? recipients.slice(recipients.findIndex((x) => x.id === afterId) + 1) : recipients;
      const next = list.find((x) => statuses[x.id] === "pending" && x.id !== afterId) ?? recipients.find((x) => statuses[x.id] === "pending" && x.id !== afterId);
      if (!next) return;
      const btn = buttons.current.get(next.id);
      if (!btn) return;
      btn.closest("li")?.scrollIntoView({ block: "center", behavior: "smooth" });
      btn.focus({ preventScroll: true });
    },
    [recipients, statuses],
  );

  // Back from Zalo: jump to the next customer still waiting.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") focusNext();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [focusNext]);

  return (
    <>
      <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-10 -mx-4 mb-4 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur md:top-0 md:mx-0 md:rounded-[var(--radius-panel)] md:border md:bg-surface">
        <div className="flex items-baseline justify-between gap-3">
          <p className="num text-base" aria-live="polite">
            Đã gửi <strong>{sent}</strong>/{total}
            {skipped > 0 && <span className="text-sm text-muted"> · bỏ qua {skipped}</span>}
          </p>
          {!nextPending && total > 0 && <Tag tone="jade">Đã xử lý hết</Tag>}
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-jade-wash" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={sent}>
          <div className="bg-jade transition-[width]" style={{ width: `${total ? (sent / total) * 100 : 0}%` }} />
          <div className="bg-line-strong" style={{ width: `${total ? (skipped / total) * 100 : 0}%` }} />
        </div>
      </div>

      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
        {recipients.map((r) => {
          const st = statuses[r.id];
          return (
            <li
              key={r.id}
              className={cn(
                "grid gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[13rem_minmax(0,1fr)_auto] md:items-center",
                st !== "pending" && "bg-paper/50",
                lastSent === r.id && "bg-jade-wash/50",
              )}
            >
              <div className="flex items-center justify-between gap-2 md:block">
                <div className="min-w-0">
                  <p className={cn("truncate font-semibold", st !== "pending" && "text-ink-soft")}>{r.name}</p>
                  <p className="num text-sm text-muted">{fmtPhone(r.phone)}</p>
                </div>
                <span className="md:hidden">
                  <StatusTag status={st} />
                </span>
              </div>
              <p className={cn("line-clamp-2 text-sm whitespace-pre-line break-words", st === "pending" ? "text-ink-soft" : "text-muted")}>
                {r.message}
              </p>
              <div className="flex items-center gap-2 md:justify-end">
                <span className="hidden md:inline">
                  <StatusTag status={st} />
                </span>
                {st === "pending" ? (
                  <>
                    <Button
                      ref={(el) => {
                        if (el) buttons.current.set(r.id, el);
                        else buttons.current.delete(r.id);
                      }}
                      onClick={() => onSend(r)}
                      className="flex-1 md:flex-none"
                    >
                      {sender.actionLabel}
                    </Button>
                    <Button variant="quiet" onClick={() => onSkip(r)}>
                      Bỏ qua
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => onSend(r)}>
                    Gửi lại
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-8">
        <Button variant="quiet" size="sm" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" /> Xoá chiến dịch
        </Button>
      </div>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Xoá chiến dịch">
        <p className="mb-4">Xoá chiến dịch này và danh sách người nhận? Tin đã gửi qua Zalo không bị ảnh hưởng.</p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() =>
              start(async () => {
                const r = await deleteCampaign(campaignId);
                if (!r.ok) return void toast.error(r.error);
                toast.success("Đã xoá chiến dịch");
                router.push("/khuyen-mai");
              })
            }
          >
            Xoá chiến dịch
          </Button>
          <Button variant="quiet" onClick={() => setConfirmDelete(false)}>
            Giữ lại
          </Button>
        </div>
      </Dialog>
    </>
  );
}

function StatusTag({ status }: { status: RecipientStatus }) {
  if (status === "sent")
    return (
      <Tag tone="jade">
        <Check className="size-3" /> Đã gửi
      </Tag>
    );
  if (status === "skipped") return <Tag>Bỏ qua</Tag>;
  return null;
}
