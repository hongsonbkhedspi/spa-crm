import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getNavCounts } from "@/lib/nav-counts";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [settings, counts] = await Promise.all([getSettings(), getNavCounts()]);
  return (
    <AppShell user={{ fullName: user.fullName, role: user.role }} spaName={settings.spaName} counts={counts}>
      {children}
    </AppShell>
  );
}
