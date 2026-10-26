import { zaloLink } from "@/lib/format";

export type OutgoingMessage = { phone: string; text: string };

export type SendOutcome = {
  /** The message reached the customer (auto) or was handed to the user (manual). */
  ok: boolean;
  /** Manual only: the text is on the clipboard. */
  copied?: boolean;
};

/**
 * How a campaign message leaves the app. The send screen and campaign_recipients
 * table only talk to this interface, so a different channel can be added without
 * changing the UI or the database.
 *
 * - "manual": runs in the browser inside the user's tap. It MUST be synchronous —
 *   iOS Safari blocks clipboard writes and window.open after an `await`.
 * - "auto": runs on the server (API call), the user doesn't leave the app.
 */
export interface MessageSender {
  kind: "manual" | "auto";
  /** Button label on the send screen. */
  actionLabel: string;
  send(msg: OutgoingMessage): SendOutcome;
}

/** Copy the text, open the customer's Zalo chat; the user pastes and presses Enter. */
export class ManualZaloSender implements MessageSender {
  kind = "manual" as const;
  actionLabel = "Gửi";

  send(msg: OutgoingMessage): SendOutcome {
    const copied = copyTextSync(msg.text);
    window.open(zaloLink(msg.phone), "_blank", "noopener");
    return { ok: true, copied };
  }
}

/*
 * Phase 2: ZaloOaZnsSender — sends through a verified Zalo Official Account using
 * ZNS templates (paid, templates must be approved). It will be kind "auto" and its
 * send() will call a server action that posts to the ZNS API, then mark the
 * recipient "sent". Swap it in via getSender() below; nothing else changes.
 */

export function getSender(): MessageSender {
  return new ManualZaloSender();
}

/** Synchronous clipboard write that works inside a tap handler on iOS Safari and desktop. */
export function copyTextSync(text: string): boolean {
  let ok = false;
  // Fallback first: execCommand runs synchronously and works on http and older Safari.
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;font-size:16px;pointer-events:none";
    document.body.appendChild(ta);
    ta.focus({ preventScroll: true });
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
    document.body.removeChild(ta);
  } catch {
    ok = false;
  }
  // Async Clipboard API, called synchronously in the same gesture (no await before it).
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => {},
      () => {},
    );
    ok = true;
  }
  return ok;
}
