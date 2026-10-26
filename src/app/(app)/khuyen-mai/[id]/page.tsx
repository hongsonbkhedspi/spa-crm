import { notFound } from "next/navigation";
import { Send } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtInstantDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page";
import { SendList } from "./send-list";

export const metadata = { title: "Gửi khuyến mãi" };

export default async function CampaignSendPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      recipients: {
        orderBy: { id: "asc" },
        include: { customer: { select: { name: true, phone: true } } },
      },
    },
  });
  if (!campaign) notFound();

  return (
    <>
      <PageHeader title={campaign.title} topic="money" icon={Send}>
        <p className="num mt-1 text-sm text-muted">Tạo {fmtInstantDate(campaign.createdAt)}</p>
      </PageHeader>
      {/* Messages are rendered on the server and shipped with the page, so a tap
          never has to wait for the network before copying + opening Zalo. */}
      <SendList
        campaignId={campaign.id}
        recipients={campaign.recipients.flatMap((r) =>
          // The phone may have been removed from the customer after the campaign was created
          r.customer.phone
            ? [{ id: r.id, name: r.customer.name, phone: r.customer.phone, message: r.renderedMessage, status: r.status }]
            : [],
        )}
      />
    </>
  );
}
