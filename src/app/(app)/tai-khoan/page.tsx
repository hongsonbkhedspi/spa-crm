import { db } from "@/lib/db";
import { requireOwnerPage } from "@/lib/auth";
import { fmtInstantDate, instantToTimeStr } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page";
import { AccountsView, type AccountRow } from "./accounts-view";

export const metadata = { title: "Tài khoản" };

export default async function AccountsPage() {
  const me = await requireOwnerPage();
  const users = await db.user.findMany({
    orderBy: [{ role: "asc" }, { active: "desc" }, { fullName: "asc" }],
    include: {
      sessions: { where: { expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } },
    },
  });
  const when = (d: Date) => `${instantToTimeStr(d)} ${fmtInstantDate(d)}`;

  const rows: AccountRow[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    active: u.active,
    isMe: u.id === me.id,
    lastLogin: u.lastLoginAt ? when(u.lastLoginAt) : null,
    sessions: u.sessions.map((s) => ({
      id: s.id,
      device: describeAgent(s.userAgent),
      ip: s.ip ?? "",
      lastSeen: when(s.lastSeenAt),
      current: s.id === me.sessionId,
    })),
  }));

  return (
    <>
      <PageHeader title="Tài khoản" />
      <AccountsView rows={rows} />
    </>
  );
}

/** "iPhone · Safari", "Windows · Chrome" from a user-agent string. */
function describeAgent(ua: string | null): string {
  if (!ua) return "Không rõ thiết bị";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : "Thiết bị khác";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Zalo/i.test(ua)
      ? "Zalo"
      : /CriOS|Chrome\//.test(ua)
        ? "Chrome"
        : /FxiOS|Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Trình duyệt";
  return `${os}, ${browser}`;
}
