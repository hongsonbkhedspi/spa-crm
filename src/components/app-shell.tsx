"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { CountBadge } from "./ui/tag";
import { TOPIC, type Topic } from "./ui/topic";
import { NavIcon } from "./nav-icon";
import { MOBILE_TABS, NAV, isActive, navFor } from "./nav";

type Counts = { packages: number; products: number };

export function AppShell({
  user,
  spaName,
  counts,
  children,
}: {
  user: { fullName: string; role: Role };
  spaName: string;
  counts: Counts;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = navFor(user.role);
  const main = items.filter((i) => i.group !== "catalog");
  const catalog = items.filter((i) => i.group === "catalog");
  const moreCount = counts.packages + counts.products;
  const onRecord = pathname.startsWith("/ghi-nhan");

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[232px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface md:flex">
        <Link href="/" className="px-5 pb-4 pt-6 text-lg font-semibold tracking-[-0.01em] text-jade-deep">
          {spaName}
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Chính">
          <ul className="flex flex-col gap-0.5">
            {main.map((n) => (
              <SideLink key={n.href} {...n} active={isActive(pathname, n.href)} count={n.badge ? counts[n.badge] : 0} />
            ))}
          </ul>
          {catalog.length > 0 && (
            <>
              <p className="mt-6 px-3 pb-1.5 text-xs font-medium text-muted">Danh mục</p>
              <ul className="flex flex-col gap-0.5">
                {catalog.map((n) => (
                  <SideLink key={n.href} {...n} active={isActive(pathname, n.href)} count={0} />
                ))}
              </ul>
            </>
          )}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/95 pt-safe backdrop-blur md:static md:border-0 md:bg-transparent">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 md:px-8">
            <Link href="/" className="truncate text-base font-semibold text-jade-deep md:invisible">
              {spaName}
            </Link>
            <Link href="/ca-nhan" className="flex min-h-11 items-center gap-2 rounded-full pl-1 pr-3 text-sm hover:bg-surface">
              <span className="grid size-8 place-items-center rounded-full bg-jade-wash text-xs font-semibold text-jade-deep">
                {initials(user.fullName)}
              </span>
              <span className="max-w-36 truncate font-medium">{user.fullName}</span>
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)] pt-2 md:px-8 md:pb-12">
          {children}
        </main>
      </div>

      {/* Phone: floating record button */}
      {!onRecord && (
        <Link
          href="/ghi-nhan"
          className="fixed right-4 z-30 flex h-13 items-center gap-1.5 rounded-full bg-jade pl-4 pr-5 font-semibold text-white shadow-[0_6px_20px_-4px_rgba(34,87,76,0.55)] md:hidden"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" }}
        >
          <Plus className="size-5" /> Ghi nhận
        </Link>
      )}

      {/* Phone: bottom tab bar */}
      <nav aria-label="Chính" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-safe backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((href) => {
            const n = NAV.find((x) => x.href === href)!;
            return <TabLink key={href} href={href} label={n.label} icon={n.icon} topic={n.topic} active={isActive(pathname, href)} />;
          })}
          <TabLink
            href="/them"
            label="Thêm"
            icon="more"
            topic="neutral"
            active={!MOBILE_TABS.some((h) => isActive(pathname, h))}
            count={moreCount}
          />
        </ul>
      </nav>
    </div>
  );
}

function SideLink({
  href,
  label,
  icon,
  topic,
  badge,
  active,
  count,
}: {
  href: string;
  label: string;
  icon: string;
  topic: Topic;
  badge?: "packages" | "products";
  active: boolean;
  count: number;
}) {
  const t = TOPIC[topic];
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-11 items-center gap-3 rounded-[var(--radius-field)] px-2 text-sm",
          active ? cn(t.wash, t.ink, "font-semibold") : "text-ink-soft hover:bg-paper hover:text-ink",
        )}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", active ? t.chip : cn(t.wash, t.ink))}>
          <NavIcon name={icon} className="size-[17px]" />
        </span>
        <span className="flex-1 truncate">{label}</span>
        <CountBadge n={count} topic={badge === "packages" ? "pkg" : badge === "products" ? "prod" : "alert"} />
      </Link>
    </li>
  );
}

function TabLink({
  href,
  label,
  icon,
  topic,
  active,
  count = 0,
}: {
  href: string;
  label: string;
  icon: string;
  topic: Topic;
  active: boolean;
  count?: number;
}) {
  const t = TOPIC[topic];
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex h-15 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
          active ? cn(t.ink, "font-semibold") : "text-muted",
        )}
      >
        <span className={cn("grid h-7 w-12 place-items-center rounded-full", active && t.wash)}>
          <NavIcon name={icon} className="size-[22px]" />
        </span>
        {label}
        {count > 0 && <CountBadge n={count} className="absolute left-1/2 top-1.5 ml-2" />}
      </Link>
    </li>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.at(-1)?.[0] ?? "?").toUpperCase();
}
