import Link from "next/link";
import { ChevronRight, KeyRound, LogOut } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getNavCounts } from "@/lib/nav-counts";
import { logout } from "@/app/(auth)/actions";
import { MOBILE_TABS, navFor, type NavItem } from "@/components/nav";
import { NavIcon } from "@/components/nav-icon";
import { CountBadge } from "@/components/ui/tag";
import { TOPIC } from "@/components/ui/topic";
import { cn } from "@/lib/utils";

export const metadata = { title: "Thêm" };

const row =
  "flex min-h-13 w-full items-center gap-3 px-4 text-left text-base hover:bg-paper active:bg-paper";

export default async function MorePage() {
  const me = await requireUser();
  const counts = await getNavCounts();
  const items = navFor(me.role).filter((n) => !MOBILE_TABS.includes(n.href));
  const main = items.filter((n) => n.group !== "catalog");
  const catalog = items.filter((n) => n.group === "catalog");

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Thêm</h1>
      <Group items={main} counts={counts} />
      {catalog.length > 0 && (
        <section>
          <h2 className="mb-1.5 px-1 text-sm font-medium text-muted">Danh mục</h2>
          <Group items={catalog} counts={counts} />
        </section>
      )}
      <section>
        <h2 className="mb-1.5 px-1 text-sm font-medium text-muted">{me.fullName}</h2>
        <div className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
          <Link href="/ca-nhan" className={row}>
            <KeyRound className="size-5 text-ink-soft" />
            <span className="flex-1">Đổi mật khẩu</span>
            <ChevronRight className="size-4 text-muted" />
          </Link>
          <form action={logout} className="border-t border-line">
            <button type="submit" className={`${row} text-lotus`}>
              <LogOut className="size-5" />
              <span className="flex-1">Đăng xuất</span>
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Group({ items, counts }: { items: NavItem[]; counts: { packages: number; products: number } }) {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface">
      {items.map((n) => (
        <li key={n.href}>
          <Link href={n.href} className={row}>
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", TOPIC[n.topic].wash, TOPIC[n.topic].ink)}>
              <NavIcon name={n.icon} className="size-[18px]" />
            </span>
            <span className="flex-1">{n.label}</span>
            {n.badge && <CountBadge n={counts[n.badge]} topic={n.badge === "packages" ? "pkg" : "prod"} />}
            <ChevronRight className="size-4 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
