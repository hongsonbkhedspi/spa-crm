import Link from "next/link";
import { Send } from "lucide-react";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtInstantDate } from "@/lib/dates";
import { PageHeader, Empty } from "@/components/ui/page";
import { LinkButton } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";

export const metadata = { title: "Khuyến mãi" };

export default async function CampaignsPage() {
  await requireUser();
  const [campaigns, stats] = await Promise.all([
    db.campaign.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.campaignRecipient.groupBy({ by: ["campaignId", "status"], _count: { _all: true } }),
  ]);
  const count = (id: number, status?: string) =>
    stats.filter((s) => s.campaignId === id && (!status || s.status === status)).reduce((n, s) => n + s._count._all, 0);

  return (
    <>
      <PageHeader
        title="Khuyến mãi"
        topic="money"
        icon={Send}
        actions={
          <LinkButton href="/khuyen-mai/moi">
            <Plus className="size-4" /> Tạo chiến dịch
          </LinkButton>
        }
      />
      {campaigns.length === 0 ? (
        <Empty action={<LinkButton href="/khuyen-mai/moi">Tạo chiến dịch</LinkButton>}>Chưa có chiến dịch nào.</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-panel)] border border-money/30 bg-surface">
          {campaigns.map((c) => {
            const total = count(c.id);
            const sent = count(c.id, "sent");
            const skipped = count(c.id, "skipped");
            const done = sent + skipped >= total && total > 0;
            return (
              <li key={c.id}>
                <Link href={`/khuyen-mai/${c.id}`} className="grid gap-2 px-4 py-3 hover:bg-paper md:grid-cols-[minmax(0,1fr)_14rem] md:items-center md:gap-6">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{c.title}</span>
                      {done && <Tag tone="jade">Xong</Tag>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-ink-soft">{c.content}</p>
                    <p className="num mt-0.5 text-xs text-muted">Tạo {fmtInstantDate(c.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="num text-sm">
                      Đã gửi <strong>{sent}</strong>/{total}
                    </span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-money-wash">
                      <div className="h-full bg-money" style={{ width: `${total ? (sent / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
