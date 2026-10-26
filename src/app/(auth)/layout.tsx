import { Beads } from "@/components/ui/beads";

// Login/setup depend on the database (first-run check), never prerender them.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center px-4 pt-[max(12vh,env(safe-area-inset-top))] pb-safe">
      <div className="w-full max-w-sm">
        <Beads used={7} total={10} className="mb-6" />
        {children}
      </div>
    </main>
  );
}
